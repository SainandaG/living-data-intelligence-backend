import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Loader } from 'lucide-react';
import { useWindowManager } from '../../context/WindowManagerContext';

const AnalystChat = () => {
    const { connectionId } = useWindowManager();
    const [messages, setMessages] = useState([
        { id: 1, type: 'bot', text: 'Identity verified. Neural Analyst online. How can I assist with your data schema?' }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg = { id: Date.now(), type: 'user', text: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);

        try {
            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: userMsg.text, connection_id: connectionId })
            });

            if (!response.ok) throw new Error('Neural Link disrupted');

            const data = await response.json();
            const botMsg = { id: Date.now() + 1, type: 'bot', text: data.response };
            setMessages(prev => [...prev, botMsg]);

        } catch (error) {
            console.error(error);
            // Fallback for demo if backend is offline or errors
            setTimeout(() => {
                const errorMsg = {
                    id: Date.now() + 1,
                    type: 'bot',
                    text: `Warning: Backend connection failed. (${error.message}). I am running in local simulation mode.`
                };
                setMessages(prev => [...prev, errorMsg]);
            }, 1000);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="flex flex-col h-full text-white font-sans">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex items-start max-w-[80%] gap-3 ${msg.type === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`p-2 rounded-full ${msg.type === 'user' ? 'bg-blue-600' : 'bg-purple-600'}`}>
                                {msg.type === 'user' ? <User size={16} /> : <Bot size={16} />}
                            </div>
                            <div className={`p-3 rounded-2xl ${msg.type === 'user'
                                ? 'bg-blue-600/20 border border-blue-500/30 rounded-tr-none'
                                : 'bg-purple-600/20 border border-purple-500/30 rounded-tl-none'
                                }`}>
                                <p className="text-sm leading-relaxed">{msg.text}</p>
                            </div>
                        </div>
                    </div>
                ))}
                {isTyping && (
                    <div className="flex justify-start">
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-full bg-purple-600">
                                <Bot size={16} />
                            </div>
                            <div className="bg-purple-600/20 border border-purple-500/30 p-3 rounded-2xl rounded-tl-none flex items-center gap-2">
                                <Loader size={14} className="animate-spin text-purple-400" />
                                <span className="text-xs text-purple-300">Processing...</span>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-white/10 bg-black/20">
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus-within:border-blue-500/50 transition-colors">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Ask the Analyst Agent..."
                        className="bg-transparent border-none outline-none text-white w-full text-sm"
                    />
                    <button
                        onClick={handleSend}
                        className="p-2 text-blue-400 hover:text-blue-300 transition-colors"
                    >
                        <Send size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AnalystChat;
