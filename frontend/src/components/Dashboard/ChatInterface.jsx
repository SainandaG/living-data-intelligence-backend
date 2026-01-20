import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Bot, User, Sparkles, Loader, Terminal } from 'lucide-react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ChatInterface({ connectionId, isOpen, onClose }) {
    const controls = useDragControls();
    // const [isOpen, setIsOpen] = useState(false); // Controlled by parent
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: "Hello! I'm your AI Data Analyst. I can help you explore your database, write SQL queries, or explain complex relationships. Ask me anything!"
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsLoading(true);

        try {
            // Prepare history for API (exclude initial greeting if needed, or keep it)
            const history = messages.map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                content: m.content
            }));

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    connection_id: connectionId,
                    message: userMessage,
                    history: history
                }),
            });

            if (!response.ok) throw new Error('Failed to get response');

            const data = await response.json();
            setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I encountered an error. Please try again." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            {/* Chat Window */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.9 }}
                        drag
                        dragListener={false}
                        dragControls={controls}
                        dragMomentum={false}
                        className="fixed top-20 right-20 z-[5001] w-[400px] h-[600px] bg-[#0a0e1a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden ring-1 ring-white/10"
                    >
                        {/* Header */}
                        <div
                            onPointerDown={(e) => controls.start(e)}
                            className="p-4 border-b border-white/10 bg-gradient-to-r from-[var(--primary-cyan)]/10 to-[var(--primary-purple)]/10 flex items-center justify-between cursor-move"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-gradient-to-br from-[var(--primary-cyan)] to-[var(--primary-purple)] rounded-lg">
                                    <Bot size={20} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-sm">AI Data Analyst</h3>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                        <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">Online</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/10 rounded-lg text-[var(--text-secondary)] hover:text-white transition-colors cursor-pointer"
                                onPointerDown={(e) => e.stopPropagation()}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.map((msg, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div className={`max-w-[85%] rounded-2xl p-4 ${msg.role === 'user'
                                        ? 'bg-[var(--primary-cyan)] text-white rounded-br-none'
                                        : 'bg-white/10 text-gray-200 rounded-bl-none border border-white/5'
                                        }`}>
                                        {msg.role === 'assistant' ? (
                                            <div className="prose prose-invert prose-sm max-w-none">
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        table({ node, children, ...props }) {
                                                            return (
                                                                <div className="overflow-x-auto my-4 rounded-lg border border-white/10">
                                                                    <table className="min-w-full text-xs" {...props}>
                                                                        {children}
                                                                    </table>
                                                                </div>
                                                            )
                                                        },
                                                        thead({ node, children, ...props }) {
                                                            return (
                                                                <thead className="bg-white/5 sticky top-0" {...props}>
                                                                    {children}
                                                                </thead>
                                                            )
                                                        },
                                                        th({ node, children, ...props }) {
                                                            return (
                                                                <th className="px-3 py-2 text-left font-semibold text-[var(--primary-cyan)] border-b border-white/10 whitespace-nowrap" {...props}>
                                                                    {children}
                                                                </th>
                                                            )
                                                        },
                                                        td({ node, children, ...props }) {
                                                            return (
                                                                <td className="px-3 py-2 border-b border-white/5 whitespace-nowrap" {...props}>
                                                                    {children}
                                                                </td>
                                                            )
                                                        },
                                                        tr({ node, children, ...props }) {
                                                            return (
                                                                <tr className="hover:bg-white/5 transition-colors" {...props}>
                                                                    {children}
                                                                </tr>
                                                            )
                                                        },
                                                        code({ node, inline, className, children, ...props }) {
                                                            const match = /language-(\w+)/.exec(className || '')
                                                            return !inline && match ? (
                                                                <div className="bg-black/30 rounded-lg border border-white/10 mt-2 mb-2 overflow-hidden">
                                                                    <div className="px-3 py-1 bg-white/5 border-b border-white/5 text-[10px] uppercase text-gray-400 flex items-center gap-1">
                                                                        <Terminal size={10} />
                                                                        {match[1]}
                                                                    </div>
                                                                    <code className="block p-3 text-xs font-mono overflow-x-auto" {...props}>
                                                                        {children}
                                                                    </code>
                                                                </div>
                                                            ) : (
                                                                <code className="bg-white/10 px-1 py-0.5 rounded text-xs font-mono" {...props}>
                                                                    {children}
                                                                </code>
                                                            )
                                                        }
                                                    }}
                                                >
                                                    {msg.content}
                                                </ReactMarkdown>
                                            </div>
                                        ) : (
                                            <div className="text-sm">{msg.content}</div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                            {isLoading && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                                    <div className="bg-white/10 rounded-2xl rounded-bl-none p-4 border border-white/5 flex items-center gap-2">
                                        <Loader size={16} className="animate-spin text-[var(--primary-cyan)]" />
                                        <span className="text-xs text-[var(--text-secondary)]">AI is thinking...</span>
                                    </div>
                                </motion.div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 border-t border-white/10 bg-black/20">
                            <form onSubmit={handleSubmit} className="relative">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Ask about your data..."
                                    disabled={isLoading}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[var(--primary-cyan)] focus:ring-1 focus:ring-[var(--primary-cyan)] transition-all disabled:opacity-50"
                                />
                                <button
                                    type="submit"
                                    disabled={!input.trim() || isLoading}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-[var(--primary-cyan)] text-white rounded-lg hover:bg-[var(--primary-cyan)]/80 disabled:opacity-50 disabled:hover:bg-[var(--primary-cyan)] transition-colors"
                                >
                                    <Send size={16} />
                                </button>
                            </form>
                            <div className="mt-2 text-center">
                                <p className="text-[10px] text-[var(--text-secondary)] flex items-center justify-center gap-1">
                                    <Sparkles size={10} className="text-[var(--primary-cyan)]" />
                                    Powered by Neural Core AI
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
