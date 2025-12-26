import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CollapsiblePanel({ title, icon: Icon, children, defaultOpen = false }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="mb-4">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all"
            >
                <div className="flex items-center gap-2">
                    {Icon && <Icon size={16} className="text-[var(--primary-cyan)]" />}
                    <h3 className="text-[11px] font-bold tracking-[2px] uppercase text-[var(--primary-cyan)] font-mono">
                        {title}
                    </h3>
                </div>
                {isOpen ? (
                    <ChevronUp size={16} className="text-[var(--primary-cyan)]" />
                ) : (
                    <ChevronDown size={16} className="text-[var(--primary-cyan)]" />
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="overflow-hidden"
                    >
                        <div className="pt-3">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
