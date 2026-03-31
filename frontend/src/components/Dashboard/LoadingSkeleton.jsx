import React from 'react';
import { motion } from 'framer-motion';

const Skeleton = ({ className }) => (
    <motion.div
        animate={{ opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        className={`bg-white/5 rounded ${className}`}
    />
);

export const SidebarSkeleton = () => (
    <div className="p-4 space-y-6">
        <div className="space-y-3">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-20 w-full" />
        </div>
        <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-4 w-2/3" />
                </div>
            ))}
        </div>
        <div className="pt-4 space-y-3">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-32 w-full" />
        </div>
    </div>
);

export const GraphOverlaySkeleton = () => (
    <div className="absolute inset-0 flex items-center justify-center p-8 pointer-events-none">
        <div className="w-full h-full border border-white/5 bg-black/5 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center space-y-4">
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 border-2 border-white/10 border-t-cyan-500 rounded-full"
            />
            <Skeleton className="h-4 w-48" />
        </div>
    </div>
);

export default Skeleton;
