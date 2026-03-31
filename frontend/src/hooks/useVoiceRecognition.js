import { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '../utils/logger';

/**
 * Hook for Web Speech API recognition
 */
export const useVoiceRecognition = (onResult, options = {}) => {
    const {
        continuous = false,
        interimResults = true,
        lang = 'en-US'
    } = options;

    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [error, setError] = useState(null);
    const recognitionRef = useRef(null);

    // Keep a stable ref to the latest onResult callback so the recognition
    // instance is never torn down just because the parent re-renders.
    const onResultRef = useRef(onResult);
    useEffect(() => { onResultRef.current = onResult; }, [onResult]);

    // Initialize SpeechRecognition once (deps exclude onResult intentionally)
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            setError('Speech Recognition API is not supported in this browser.');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = continuous;
        recognition.interimResults = interimResults;
        recognition.lang = lang;

        recognition.onstart = () => {
            setIsListening(true);
            setError(null);
        };

        recognition.onerror = (event) => {
            logger.error('Speech Recognition Error:', event.error);
            setError(event.error);
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            const currentTranscript = finalTranscript || interimTranscript;
            setTranscript(currentTranscript);

            if (finalTranscript && onResultRef.current) {
                onResultRef.current(finalTranscript.trim());
            }
        };

        recognitionRef.current = recognition;

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, [continuous, interimResults, lang]); // onResult intentionally excluded — handled via ref

    const startListening = useCallback(async () => {
        if (recognitionRef.current && !isListening) {
            setTranscript('');
            try {
                // Request microphone permission — release the stream immediately after;
                // the SpeechRecognition API manages its own mic access.
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach(track => track.stop());

                recognitionRef.current.start();
            } catch (err) {
                logger.error('Failed to start recognition');
                if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                    setError('microphone-permission-denied');
                } else if (err.name === 'NotFoundError') {
                    setError('no-microphone-found');
                } else {
                    setError('failed-to-start');
                }
            }
        }
    }, [isListening]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current && isListening) {
            recognitionRef.current.stop();
        }
    }, [isListening]);

    return {
        isListening,
        transcript,
        error,
        startListening,
        stopListening
    };
};
