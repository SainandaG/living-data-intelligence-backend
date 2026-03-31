import React from 'react';
import { Mic, X, CheckCircle2, AlertCircle, Keyboard, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils/cn';

// --- STABLE VARIANTS ---
const panelVariants = {
    initial: { opacity: 0, y: 50, scale: 0.9 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: 30, scale: 0.95 }
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

const chatFormVariants = {
    initial: { opacity: 0, y: 20, height: 0 },
    animate: { opacity: 1, y: 0, height: 'auto' },
    exit: { opacity: 0, y: 20, height: 0 }
};

const VoiceControl = ({ voiceSystems }) => {
    const { state, voice, toggleListening, handleChatSubmit, dispatch } = voiceSystems;
    const { status, message, thought, lastIntent, showChat, chatInput, isMinimized } = state;
    const { isListening, transcript } = voice;

    const setChatInput = (v) => dispatch({ type: 'SET_CHAT_INPUT', payload: v });
    const toggleChat = () => dispatch({ type: 'TOGGLE_CHAT' });
    const toggleMinimized = () => dispatch({ type: 'TOGGLE_MINIMIZED' });

    const onSubmit = (e) => {
        e.preventDefault();
        handleChatSubmit(chatInput);
        setChatInput('');
        toggleChat();
    };

    return (
        <motion.div 
            layout
            className={cn(
                "fixed inset-x-0 bottom-0 z-[10000] flex flex-col items-center pointer-events-none gap-3 transition-all duration-500",
                isMinimized ? "pb-2" : "pb-4"
            )}
        >
            {/* The minimize toggle has been moved to GraphControlsToolbar for vertical clustering */}

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
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="flex gap-1">
                                            {[0, 1, 2].map((i) => (
                                                <motion.div
                                                    key={i}
                                                    animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
                                                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                                                    className="w-1.5 h-1.5 rounded-full bg-blue-400"
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {status === 'success' && (
                                <motion.div variants={textFadeVariants} initial="initial" animate="animate" exit="exit" className="bg-emerald-500/20 p-2 rounded-full mb-2">
                                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                                </motion.div>
                            )}

                            {status === 'error' && (
                                <div className="bg-red-500/20 p-2 rounded-full mb-2">
                                    <AlertCircle className="w-8 h-8 text-red-400" />
                                </div>
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
                                {thought && status !== 'listening' && (
                                    <motion.p variants={textFadeVariants} initial="initial" animate="animate" className="text-slate-400 text-sm font-mono mt-2 bg-white/5 py-1 px-3 rounded-md inline-block border border-white/5">
                                        💡 {thought}
                                    </motion.p>
                                )}
                            </div>

                            {status !== 'listening' && (
                                <button
                                    onClick={() => { dispatch({ type: 'SET_MESSAGE', payload: '' }); dispatch({ type: 'SET_STATUS', payload: 'idle' }); }}
                                    className="absolute top-4 right-4 p-1 hover:bg-white/10 rounded-full transition-colors"
                                >
                                    <X className="w-4 h-4 text-slate-400 pointer-events-auto" />
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* The keyboard toggle has been moved to the GraphControlsToolbar for vertical alignment */}
        </motion.div>
    );
};

export default React.memo(VoiceControl);
