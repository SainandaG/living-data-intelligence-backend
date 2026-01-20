import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Loader2, X, CheckCircle2, AlertCircle, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVoiceRecognition } from '../../hooks/useVoiceRecognition';
import { agentService } from '../../services/agentService';

const VoiceControl = ({ onActionTriggered, uiContext = {} }) => {
    const [status, setStatus] = useState('idle'); // idle, listening, processing, success, error
    const [message, setMessage] = useState('');
    const [thought, setThought] = useState('');
    const [lastIntent, setLastIntent] = useState(null);

    const handleVoiceResult = useCallback(async (text) => {
        if (!text) return;

        setStatus('processing');
        setThought('Analyzing context...');
        setMessage(`"${text}"`);

        try {
            // T0: Process intent with UI context
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

                if (executionResult.success) {
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
    }, [onActionTriggered, uiContext]);

    const { isListening, transcript, error: speechError, startListening, stopListening } =
        useVoiceRecognition(handleVoiceResult);

    useEffect(() => {
        if (isListening) setStatus('listening');
        else if (status === 'listening') setStatus('idle');
    }, [isListening]);

    useEffect(() => {
        if (speechError) {
            setStatus('error');
            setMessage(`Speech Error: ${speechError}`);
        }
    }, [speechError]);

    const toggleListening = () => {
        if (isListening) stopListening();
        else startListening();
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
            console.log(`[VoiceControl] Running test command: ${randomPhrase}`);
            handleVoiceResult(randomPhrase);
        };

        window.addEventListener('agent-test-command', handleTest);
        return () => window.removeEventListener('agent-test-command', handleTest);
    }, []);

    return (
        <div className="fixed inset-x-0 bottom-0 z-[10000] flex flex-col items-center pointer-events-none pb-12">
            <AnimatePresence>
                {(isListening || status !== 'idle') && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 30, scale: 0.95 }}
                        className="pointer-events-auto flex flex-col items-center max-w-2xl w-full px-6"
                    >
                        {/* Transcript / Result Bubble */}
                        <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl w-full mb-4 flex flex-col items-center gap-4 min-h-[120px] justify-center text-center">
                            {status === 'listening' && (
                                <div className="flex gap-1.5 mb-2">
                                    {['#4285F4', '#EA4335', '#FBBC05', '#34A853'].map((color, i) => (
                                        <motion.div
                                            key={i}
                                            animate={{
                                                height: [8, 24, 8],
                                                backgroundColor: color
                                            }}
                                            transition={{
                                                duration: 0.6,
                                                repeat: Infinity,
                                                delay: i * 0.1
                                            }}
                                            className="w-1.5 rounded-full"
                                        />
                                    ))}
                                </div>
                            )}

                            {status === 'processing' && (
                                <div className="relative w-16 h-16 mb-4">
                                    <motion.div
                                        animate={{
                                            scale: [1, 1.2, 1],
                                            opacity: [0.3, 0.6, 0.3],
                                            rotate: [0, 180, 360]
                                        }}
                                        transition={{
                                            duration: 2,
                                            repeat: Infinity,
                                            ease: "linear"
                                        }}
                                        className="absolute inset-0 rounded-full border-2 border-dashed border-blue-400/50"
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
                                        className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-500/20 to-purple-500/20 blur-md"
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
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
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
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full mb-1"
                                >
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                                    <span className="text-[10px] uppercase tracking-widest text-blue-400 font-bold">
                                        {lastIntent.domain_detected} Context Active
                                    </span>
                                </motion.div>
                            )}

                            <div className="space-y-1">
                                <p className={`text-xl font-medium tracking-tight ${status === 'listening' ? 'text-white' :
                                    status === 'success' ? 'text-emerald-100' :
                                        status === 'error' ? 'text-red-100' : 'text-blue-100'
                                    }`}>
                                    {status === 'listening' ? (transcript || 'I am listening...') : message}
                                </p>
                                {status === 'listening' && !transcript && (
                                    <p className="text-slate-400 text-sm italic">"Drill down users" | "Show schema"</p>
                                )}
                                {thought && status !== 'listening' && (
                                    <motion.p
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
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

            {/* Google-Assistant Style Mic Button */}
            <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={toggleListening}
                disabled={status === 'processing'}
                className={`pointer-events-auto relative w-20 h-20 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(79,70,229,0.3)] transition-all duration-500 ${isListening
                    ? 'bg-white'
                    : status === 'processing'
                        ? 'bg-blue-600/50 cursor-wait'
                        : 'bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600'
                    }`}
            >
                {isListening ? (
                    <div className="flex gap-1.5">
                        {['#4285F4', '#EA4335', '#FBBC05', '#34A853'].map((color, i) => (
                            <motion.div
                                key={i}
                                animate={{
                                    scaleY: [1, 2.5, 1],
                                }}
                                transition={{
                                    duration: 0.5,
                                    repeat: Infinity,
                                    delay: i * 0.1
                                }}
                                style={{ backgroundColor: color }}
                                className="w-1.5 h-6 rounded-full"
                            />
                        ))}
                    </div>
                ) : (
                    <Mic className="w-8 h-8 text-white shadow-sm" />
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
        </div>
    );
};

export default VoiceControl;
