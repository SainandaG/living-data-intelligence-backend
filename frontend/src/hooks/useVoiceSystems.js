import { useReducer, useCallback, useEffect, useRef } from 'react';
import { useVoiceRecognition } from './useVoiceRecognition';
import { agentService } from '../services/agentService';
import { parseLocalCommand } from '../services/commandParser';
import { useCommandRegistry } from '../context/CommandRegistryContext';
import { logger } from '../utils/logger';

const initialVoiceState = {
    status: 'idle',  // 'idle' | 'listening' | 'processing' | 'success' | 'error'
    message: '',
    thought: '',
    lastIntent: null,
    showChat: false,
    chatInput: '',
    isMinimized: false,
};

function voiceReducer(state, action) {
    switch (action.type) {
        case 'SET_STATUS':      return { ...state, status: action.payload };
        case 'SET_MESSAGE':     return { ...state, message: action.payload };
        case 'SET_THOUGHT':     return { ...state, thought: action.payload };
        case 'SET_LAST_INTENT': return { ...state, lastIntent: action.payload };
        case 'TOGGLE_CHAT':     return { ...state, showChat: !state.showChat };
        case 'SET_CHAT_INPUT':  return { ...state, chatInput: action.payload };
        case 'TOGGLE_MINIMIZED': return { ...state, isMinimized: !state.isMinimized };
        case 'RESET':           return { ...initialVoiceState };
        case 'PROCESSING_START': return { ...state, status: 'processing', message: action.payload || 'Processing...' };
        case 'PROCESSING_DONE':  return { ...state, status: 'success', message: action.payload || 'Done', thought: '' };
        case 'ERROR':            return { ...state, status: 'error', message: action.payload || 'Error' };
        default: return state;
    }
}

export const useVoiceSystems = (onActionTriggered, uiContext = {}) => {
    const [state, dispatch] = useReducer(voiceReducer, initialVoiceState);
    const { executeCommand } = useCommandRegistry();
    // Track all pending reset timers so we can cancel them on unmount
    const timerIdsRef = useRef([]);

    useEffect(() => {
        return () => { timerIdsRef.current.forEach(clearTimeout); };
    }, []);

    const scheduleReset = useCallback((ms) => {
        const id = setTimeout(() => dispatch({ type: 'RESET' }), ms);
        timerIdsRef.current.push(id);
    }, []);

    const handleVoiceResult = useCallback(async (text) => {
        if (!text) return;

        dispatch({ type: 'SET_STATUS', payload: 'processing' });
        dispatch({ type: 'SET_THOUGHT', payload: 'Analyzing context...' });
        dispatch({ type: 'SET_MESSAGE', payload: `"${text}"` });

        try {
            const localNodes = uiContext.nodes || [];
            const localCommand = parseLocalCommand(text, localNodes);

            if (localCommand) {
                if (localCommand.type === 'VOICE_NO_MATCH') throw new Error(localCommand.message);

                if (localCommand.type === 'LOCAL_MATCH') {
                    dispatch({ type: 'SET_LAST_INTENT', payload: localCommand });
                    dispatch({ type: 'SET_THOUGHT', payload: localCommand.message });
                    
                    const executionResult = executeCommand(localCommand.action, localCommand.parameters);

                    if (executionResult.success) {
                        dispatch({ type: 'SET_STATUS', payload: 'success' });
                        dispatch({ type: 'SET_MESSAGE', payload: localCommand.message });
                        if (onActionTriggered) onActionTriggered(executionResult);
                        scheduleReset(4000);
                        return;
                    } else {
                        throw new Error(executionResult.error || 'Execution failed locally');
                    }
                }
            }

            const intentResult = await agentService.processIntent(text, uiContext);

            if (intentResult.success) {
                dispatch({ type: 'SET_LAST_INTENT', payload: intentResult });
                if (intentResult.reasoning) dispatch({ type: 'SET_THOUGHT', payload: intentResult.reasoning });

                const executionResult = await agentService.executeAction(
                    intentResult.command_id,
                    intentResult.action,
                    intentResult.parameters
                );

                if (executionResult.success) {
                    if (intentResult.action) executeCommand(intentResult.action, intentResult.parameters);
                    dispatch({ type: 'SET_STATUS', payload: 'success' });
                    dispatch({ type: 'SET_MESSAGE', payload: intentResult.reasoning || `Executed: ${intentResult.intent}` });
                    if (onActionTriggered) onActionTriggered(executionResult);
                    scheduleReset(4000);
                } else {
                    throw new Error(executionResult.error || 'Execution failed');
                }
            } else {
                throw new Error(intentResult.error || 'Could not understand intent');
            }
        } catch (error) {
            logger.error('Voice Systems Error:', error);
            dispatch({ type: 'ERROR', payload: error.message });
            scheduleReset(5000);
        }
    }, [onActionTriggered, uiContext, executeCommand]);

    const voice = useVoiceRecognition(handleVoiceResult);

    useEffect(() => {
        if (voice.isListening) dispatch({ type: 'SET_STATUS', payload: 'listening' });
        else if (state.status === 'listening') dispatch({ type: 'SET_STATUS', payload: 'idle' });
    }, [voice.isListening]);

    useEffect(() => {
        if (voice.error) {
            if (voice.error === 'no-speech' || voice.error === 'aborted') {
                if (state.status === 'listening') dispatch({ type: 'SET_STATUS', payload: 'idle' });
                return;
            }
            dispatch({ type: 'ERROR', payload: voice.error });
        }
    }, [voice.error]);

    const toggleListening = useCallback(() => {
        if (voice.isListening) voice.stopListening();
        else voice.startListening();
    }, [voice]);

    const handleChatSubmit = useCallback((input) => {
        if (input.trim()) {
            handleVoiceResult(input);
        }
    }, [handleVoiceResult]);

    return {
        state,
        voice,
        toggleListening,
        handleChatSubmit,
        dispatch
    };
};
