import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Loader2, X, CheckCircle2, AlertCircle, ChevronUp, Keyboard, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVoiceRecognition } from '../../hooks/useVoiceRecognition';
import { agentService } from '../../services/agentService';
import { parseLocalCommand } from '../../services/commandParser';
import { useCommandRegistry } from '../../context/CommandRegistryContext';
import { cn } from '../../utils/cn';

// --- STABLE VARIANTS ---
const panelVariants = {
    initial: { opacity: 0, y: 50, scale: 0.9 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: 30, scale: 0.95 }
};

const micBadgeVariants = {
    initial: { opacity: 0, scale: 0.5 },
    animate: { opacity: 1, scale: 1 }
};

const barVariants = {
    animate: (i) => ({
        height: [8, 24, 8],
        backgroundColor: ['#4285F4', '#EA4335', '#FBBC05', '#34A853'][i % 4]
    }),
    transition: (i) => ({
        duration: 0.6,
        repeat: Infinity,
        delay: i * 0.1
    })
};

const ringVariants = {
    animate: {
        scale: [1, 1.2, 1],
        opacity: [0.3, 0.6, 0.3],
        rotate: [0, 180, 360]
    },
    transition: {
        duration: 4,
        repeat: Infinity,
        ease: "linear"
    }
};

const textFadeVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
};

const micButtonVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 10 }
};

const chatFormVariants = {
    initial: { opacity: 0, y: 20, height: 0 },
    animate: { opacity: 1, y: 0, height: 'auto' },
    exit: { opacity: 0, y: 20, height: 0 }
};

const VoiceControl = ({ onActionTriggered, uiContext = {} }) => {
    const [status, setStatus] = useState('idle'); // idle, listening, processing, success, error
    const [message, setMessage] = useState('');
    const [thought, setThought] = useState('');
    const [lastIntent, setLastIntent] = useState(null);
    const [showChat, setShowChat] = useState(false);
    const [chatInput, setChatInput] = useState('');
    const [isMinimized, setIsMinimized] = useState(false);

    const { executeCommand } = useCommandRegistry();

    const handleVoiceResult = useCallback(async (text) => {
        if (!text) return;

        setStatus('processing');
        setThought('Analyzing context...');
        setMessage(`"${text}"`);

        try {
            // 1. Attempt Local Parsing first (Bypass AI Agent for strict UI commands)
            const localNodes = uiContext.nodes || []; // Requires App.jsx to pass nodes, or will fallback to exact match if empty
            const localCommand = parseLocalCommand(text, localNodes);

            if (localCommand) {
                if (localCommand.type === 'VOICE_NO_MATCH') {
                    // Local parser explicitly rejected (e.g., fuzzy match failed)
                    throw new Error(localCommand.message);
                }

                // Execute Local Match directly
                if (localCommand.type === 'LOCAL_MATCH') {
                    console.log("[VoiceControl] Executing Local Command Override:", localCommand);
                    setLastIntent(localCommand);
                    setThought(localCommand.message);
                    
                    const executionResult = executeCommand(localCommand.action, localCommand.parameters);

                    if (executionResult.success) {
                        setStatus('success');
                        setMessage(localCommand.message);

                        if (onActionTriggered) onActionTriggered(executionResult);

                        setTimeout(() => {
                            setStatus('idle');
                            setMessage('');
                            setThought('');
                        }, 4000);
                        return; // Exit early!
                    } else {
                        throw new Error(executionResult.error || 'Execution failed locally');
                    }
                }
            }


            // 2. Fallback to T0/T1 AI Services if no strict local match
            const intentResult = await agentService.processIntent(text, uiContext);

            if (intentResult.success) {
                setLastIntent(intentResult);
                if (intentResult.reasoning) {
                    setThought(intentResult.reasoning);
                } else {
                    setThought(`Recognized: ${intentResult.intent}`);
                }

                // T1: Execute action
                const executionResult = await agentService.executeAction(
                    intentResult.command_id,
                    intentResult.action,
                    intentResult.parameters
                );

                // Re-route AI actions through standard CommandRegistry as well for unified behavior
                if (executionResult.success) {
                    if (intentResult.action) {
                       executeCommand(intentResult.action, intentResult.parameters);
                    }

                    setStatus('success');
                    setMessage(intentResult.reasoning || `Executed: ${intentResult.intent}`);

                    // Trigger the actual UI/Graph action (passed from parent)
                    if (onActionTriggered) {
                        onActionTriggered(executionResult);
                    }

                    // Reset after delay
                    setTimeout(() => {
                        setStatus('idle');
                        setMessage('');
                        setThought('');
                    }, 4000);
                } else {
                    throw new Error(executionResult.error || 'Execution failed');
                }
            } else {
                throw new Error(intentResult.error || 'Could not understand intent');
            }
        } catch (error) {
            console.error('Voice Control Error:', error);
            setStatus('error');
            setMessage(error.message);
            setThought('Request failed');

            setTimeout(() => {
                setStatus('idle');
                setMessage('');
                setThought('');
            }, 5000);
        }
    }, [onActionTriggered, uiContext, executeCommand]);

    const { isListening, transcript, error: speechError, startListening, stopListening } =
        useVoiceRecognition(handleVoiceResult);

    useEffect(() => {
        if (isListening) setStatus('listening');
        else if (status === 'listening') setStatus('idle');
    }, [isListening]);

    useEffect(() => {
        if (speechError) {
            // Ignore benign errors (timeouts or manual stop)
            if (speechError === 'no-speech' || speechError === 'aborted') {
                console.warn(`[Voice] Ignored benign error: ${speechError}`);
                if (status === 'listening') setStatus('idle');
                return;
            }

            // User-friendly error messages
            let errorMessage = `Speech Error: ${speechError}`;
            if (speechError === 'microphone-permission-denied') {
                errorMessage = 'Microphone access denied. Please allow microphone permissions in your browser settings.';
            } else if (speechError === 'no-microphone-found') {
                errorMessage = 'No microphone detected. Please connect a microphone and try again.';
            } else if (speechError === 'not-allowed') {
                errorMessage = 'Microphone permission denied. Click the mic icon in your browser address bar to allow access.';
            } else if (speechError === 'network') {
                errorMessage = 'Network error. Speech recognition requires an internet connection.';
            }

            setStatus('error');
            setMessage(errorMessage);
        }
    }, [speechError, status]);

    const toggleListening = () => {
        if (isListening) stopListening();
        else startListening();
    };

    const handleChatSubmit = (e) => {
        e.preventDefault();
        if (chatInput.trim()) {
            handleVoiceResult(chatInput);
            setChatInput('');
            setShowChat(false); // Optional: close chat after sending
        }
    };

    // Manual Test Listener
    useEffect(() => {
        const handleTest = async () => {
            const testPhrases = [
                "highlight products",
                "show anomalies",
                "start data flow",
                "zoom into cluster 1",
                "reset view",
                "start evolution playback"
            ];
            const randomPhrase = testPhrases[Math.floor(Math.random() * testPhrases.length)];
            handleVoiceResult(randomPhrase);
        };

        window.addEventListener('agent-test-command', handleTest);
        return () => window.removeEventListener('agent-test-command', handleTest);
    }, []);

    return (
        <div className={cn(
            "fixed inset-x-0 bottom-0 z-[10000] flex flex-col items-center pointer-events-none gap-3 transition-all duration-500",
            isMinimized ? "pb-2" : "pb-4"
        )}>
            {/* MINIMIZE TOGGLE MARK */}
            <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="pointer-events-auto flex flex-col items-center gap-1 group mb-1 opacity-40 hover:opacity-100 transition-opacity"
                title={isMinimized ? "Show Voice Controls" : "Hide Voice Controls"}
            >
                <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                        <div key={i} className={cn(
                            "w-1 h-1 rounded-full transition-colors",
                            isMinimized ? "bg-indigo-500 animate-pulse" : "bg-white/20"
                        )} />
                    ))}
                </div>
                {isMinimized && (
                    <motion.div
                        variants={micBadgeVariants}
                        initial="initial"
                        animate="animate"
                        className="p-1 px-3 bg-indigo-500/20 rounded-full border border-indigo-500/30"
                    >
                        <Mic className="w-2.5 h-2.5 text-indigo-400" />
                    </motion.div>
                )}
            </button>
            <AnimatePresence>
                {(isListening || status !== 'idle') && (
                    <motion.div
                        variants={panelVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className="pointer-events-auto flex flex-col items-center max-w-2xl w-full px-6"
                    >
                        {/* Transcript / Result Bubble */}
                        <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl w-full mb-4 flex flex-col items-center gap-4 min-h-[120px] justify-center text-center">
                            {status === 'listening' && (
                                <div className="flex gap-1.5 mb-2">
                                    {[0, 1, 2, 3].map((i) => (
                                        <motion.div
                                            key={i}
                                            custom={i}
                                            animate="animate"
                                            variants={barVariants}
                                            transition={barVariants.transition(i)}
                                            className="w-1.5 rounded-full"
                                        />
                                    ))}
                                </div>
                            )}

                            {status === 'processing' && (
                                <div className="relative w-16 h-16 mb-4">
                                    <motion.div
                                        variants={ringVariants}
                                        animate="animate"
                                        className="absolute inset-0 border-2 border-indigo-500 rounded-full"
                                    />
                                    <motion.div
                                        animate={{
                                            scale: [1.2, 1, 1.2],
                                            opacity: [0.5, 0.2, 0.5],
                                        }}
                                        transition={{
                                            duration: 1.5,
                                            repeat: Infinity,
                                            ease: "easeInOut"
                                        }}
                                        className="absolute inset-0 rounded-full bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 blur-md"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="flex gap-1">
                                            {[0, 1, 2].map((i) => (
                                                <motion.div
                                                    key={i}
                                                    animate={{
                                                        y: [0, -6, 0],
                                                        opacity: [0.4, 1, 0.4]
                                                    }}
                                                    transition={{
                                                        duration: 0.6,
                                                        repeat: Infinity,
                                                        delay: i * 0.15
                                                    }}
                                                    className="w-1.5 h-1.5 rounded-full bg-blue-400"
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {status === 'success' && (
                                <motion.div
                                    variants={textFadeVariants}
                                    initial="initial"
                                    animate="animate"
                                    exit="exit"
                                    className="bg-emerald-500/20 p-2 rounded-full mb-2"
                                >
                                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                                </motion.div>
                            )}

                            {status === 'error' && (
                                <div className="bg-red-500/20 p-2 rounded-full mb-2">
                                    <AlertCircle className="w-8 h-8 text-red-400" />
                                </div>
                            )}

                            {lastIntent?.domain_detected && status !== 'listening' && (
                                <motion.div
                                    variants={textFadeVariants}
                                    initial="initial"
                                    animate="animate"
                                    className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full mb-1"
                                >
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                                    <span className="text-[10px] uppercase tracking-widest text-indigo-400 font-bold">
                                        {lastIntent.domain_detected} Context Active
                                    </span>
                                </motion.div>
                            )}

                            <div className="space-y-1">
                                <p className={cn(
                                    "text-xl font-medium tracking-tight",
                                    status === 'listening' ? 'text-white' :
                                    status === 'success' ? 'text-emerald-100' :
                                    status === 'error' ? 'text-red-100' : 'text-indigo-100'
                                )}>
                                    {status === 'listening' ? (transcript || 'I am listening...') : message}
                                </p>
                                {status === 'listening' && !transcript && (
                                    <p className="text-slate-400 text-sm italic">"Drill down users" | "Show schema"</p>
                                )}
                                {thought && status !== 'listening' && (
                                    <motion.p
                                        variants={textFadeVariants}
                                        initial="initial"
                                        animate="animate"
                                        className="text-slate-400 text-sm font-mono mt-2 bg-white/5 py-1 px-3 rounded-md inline-block border border-white/5"
                                    >
                                        💡 {thought}
                                    </motion.p>
                                )}
                            </div>

                            {status !== 'listening' && (
                                <button
                                    onClick={() => { setMessage(''); setStatus('idle'); }}
                                    className="absolute top-4 right-4 p-1 hover:bg-white/10 rounded-full transition-colors"
                                >
                                    <X className="w-4 h-4 text-slate-400 pointer-events-auto" />
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Mic Button & Chat Toggle */}
            {!isMinimized && (
                <motion.div
                    variants={micButtonVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="flex flex-col items-center gap-3"
                >
                    {/* Google-Assistant Style Mic Button */}
                    <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={toggleListening}
                        disabled={status === 'processing'}
                        className={cn(
                            "pointer-events-auto relative w-14 h-14 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(79,70,229,0.25)] transition-all duration-500",
                            isListening ? "bg-white" : status === 'processing' ? "bg-blue-600/50 cursor-wait" : "bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600"
                        )}
                    >
                        {isListening ? (
                            <div className="flex gap-1.5">
                                {['#4285F4', '#EA4335', '#FBBC05', '#34A853'].map((color, i) => (
                                    <motion.div
                                        key={i}
                                        animate={{ scaleY: [1, 2.5, 1] }}
                                        transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                                        style={{ backgroundColor: color }}
                                        className="w-1.5 h-6 rounded-full"
                                    />
                                ))}
                            </div>
                        ) : (
                            <Mic className="w-7 h-7 text-white shadow-sm" />
                        )}

                        {/* Animated Ring for Idle state */}
                        {!isListening && status === 'idle' && (
                            <div className="absolute inset-0 rounded-full border-2 border-white/20 animate-pulse scale-110" />
                        )}

                        {/* Glowing Aura if listening */}
                        {isListening && (
                            <div className="absolute inset-0 rounded-full bg-blue-400/20 blur-2xl animate-pulse" />
                        )}
                    </motion.button>

                    {/* Text Input Toggle */}
                    <div className="pointer-events-auto flex flex-col items-center">
                        <AnimatePresence>
                            {showChat && (
                                <motion.form
                                    variants={chatFormVariants}
                                    initial="initial"
                                    animate="animate"
                                    exit="exit"
                                    onSubmit={handleChatSubmit}
                                    className="mb-2 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-full p-1 pl-4 flex items-center shadow-lg w-64"
                                >
                                    <input
                                        type="text"
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        placeholder="Type a command..."
                                        className="bg-transparent border-none outline-none text-white text-sm w-full placeholder-slate-500"
                                        autoFocus
                                    />
                                    <button
                                        type="submit"
                                        className="p-2 bg-indigo-500 hover:bg-indigo-600 rounded-full transition-colors ml-2"
                                    >
                                        <Send className="w-3 h-3 text-white" />
                                    </button>
                                </motion.form>
                            )}
                        </AnimatePresence>
                        <button
                            onClick={() => setShowChat(!showChat)}
                            className={cn(
                                "p-2 rounded-full transition-all duration-300",
                                showChat ? "bg-white/20 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"
                            )}
                        >
                            <Keyboard className="w-4 h-4" />
                        </button>
                    </div>
                </motion.div>
            )}
        </div>
    );
};

export default React.memo(VoiceControl);
