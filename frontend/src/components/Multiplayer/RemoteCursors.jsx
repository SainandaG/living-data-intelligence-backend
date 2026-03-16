import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const Cursor = ({ peer }) => {
    if (!peer.cursor) return null;

    return (
        <motion.div
            initial={false}
            animate={{
                x: peer.cursor.x * window.innerWidth,
                y: peer.cursor.y * window.innerHeight,
            }}
            transition={{
                type: "spring",
                damping: 30,
                stiffness: 250,
                mass: 0.5
            }}
            className="fixed top-0 left-0 pointer-events-none z-[9999] flex flex-col items-start"
            style={{ color: peer.color }}
        >
            <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="currentColor"
                stroke="white"
                strokeWidth="1.5"
                style={{ filter: `drop-shadow(0 0 8px ${peer.color}44)` }}
            >
                <path d="M5.653 3.123l13.791 6.924c1.177.59 1.177 1.762 0 2.352l-13.791 6.924c-1.177.59-1.913-.146-1.543-1.316l1.624-5.353c.125-.411.125-1.083 0-1.494l-1.624-5.353c-.37-1.17.366-1.906 1.543-1.316z" />
            </svg>
            
            <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-white shadow-lg whitespace-nowrap backdrop-blur-md"
                style={{ backgroundColor: peer.color }}
            >
                {peer.name}
                {peer.selected_node && (
                    <span className="opacity-70 ml-1 italic">• {peer.selected_node}</span>
                )}
            </motion.div>
        </motion.div>
    );
};

export const RemoteCursors = ({ activePeers }) => {
    return (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-[9998]">
            <AnimatePresence>
                {Object.entries(activePeers).map(([id, peer]) => (
                    <Cursor key={id} peer={peer} />
                ))}
            </AnimatePresence>
        </div>
    );
};

export default RemoteCursors;
