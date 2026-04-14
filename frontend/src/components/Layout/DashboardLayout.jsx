import React, { useState, useEffect, useMemo } from "react";
import apiClient from "../../utils/apiClient";
import { ChevronRight, ChevronLeft, Search } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { LeftSidebar, RightSidebar } from "./Sidebars";
import { cn } from "../../utils/cn";
import { logger } from '../../utils/logger';

/* ---------------- ANIMATION VARIANTS ---------------- */

const sidebarVariants = {
    initial: { x: 320, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: 320, opacity: 0 }
};

/* ---------------- CUSTOM HOOKS ---------------- */

function useClock() {
    const [time, setTime] = useState(() =>
        new Date().toLocaleTimeString()
    );

    useEffect(() => {
        const interval = setInterval(() => {
            setTime(new Date().toLocaleTimeString());
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    return time;
}

function useSystemVitals() {
    const [sysVitals, setSysVitals] = useState(null);
    const [sysStatus, setSysStatus] = useState("INIT");

    useEffect(() => {
        const controller = new AbortController();

        const fetchVitals = async () => {
            try {
                const data = await apiClient.get("/vitals/", {
                    signal: controller.signal
                });

                setSysVitals(data.vitals);
                setSysStatus(data.status);
            } catch (err) {
                if (err.name !== "AbortError") {
                    logger.error("Vitals fetch failed", err);
                    setSysStatus("OFFLINE");
                }
            }
        };

        fetchVitals();

        const interval = setInterval(fetchVitals, 5000);

        return () => {
            controller.abort();
            clearInterval(interval);
        };
    }, []);

    return { sysVitals, sysStatus };
}

/* ---------------- METRIC COMPONENT ---------------- */

const Metric = ({ label, value }) => (
    <div className="flex items-center gap-1.5">
        <span className="text-[var(--primary)]/70 uppercase tracking-wider">
            {label}
        </span>
        <span className="text-slate-200 font-mono">{value}</span>
    </div>
);

/* ---------------- SYSTEM STATUS ---------------- */

const SystemStatus = ({ sysVitals, sysStatus }) => (
    <div className="flex items-center gap-1.5">

        <span className="flex items-center gap-2 text-slate-400">
            <span
                className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    sysStatus === "HEALTHY"
                        ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"
                        : "bg-red-500 animate-pulse"
                )}
            />
            WEZU_NODE_01_WEST
        </span>

        <div className="h-3 w-[1px] bg-white/10" />

        <Metric
            label="CPU Compute"
            value={`${sysVitals?.cpu_usage || 0}%`}
        />

        <Metric
            label="Neural Mem"
            value={`${sysVitals?.memory_usage_mb || 0}MB`}
        />

        <Metric
            label="API Latency"
            value={`${sysVitals?.avg_api_latency_ms || 0}ms`}
        />
    </div>
);

/* ---------------- MAIN LAYOUT ---------------- */

const DashboardLayout = ({
    children,
    sidebarProps,
    navbar,
    timeValue,
    onTimeChange,
    isInspectorActive = false
}) => {

    const [isRightOpen, setIsRightOpen] = useState(true);

    const { sysVitals, sysStatus } = useSystemVitals();
    const time = useClock();

    /* ----------- CTRL + K SEARCH ----------- */

    useEffect(() => {
        const handler = (e) => {
            if (e.ctrlKey && e.key === "k") {
                e.preventDefault();
                document.getElementById("schema-search")?.focus();
            }
        };

        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    /* ---------------- RENDER ---------------- */

    return (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--bg-dark)] text-[var(--text-main)] font-display">

            {/* Background */}
            <div className="three-graph-bg">
                <div className="latent-grid" />
            </div>

            {/* ---------------- TOP NAVBAR ---------------- */}

            <header className="flex items-center justify-between border-b border-white/10 bg-[var(--bg-dark)]/80 px-6 py-3 backdrop-blur-md z-50 h-16">

                <div className="flex items-center flex-1 min-w-0">

                    <div className="flex items-center gap-3 shrink-0">

                        <span className="material-symbols-outlined text-3xl text-[var(--primary)]">
                            hub
                        </span>

                        <div>
                            <h2 className="text-lg font-bold text-white">
                                WEZU Master Spec v2.1
                            </h2>
                            <p className="text-[10px] tracking-widest text-[var(--primary)]/70">
                                Data Engineering Suite
                            </p>
                        </div>

                    </div>

                    <div className="ml-8 h-full min-w-0">{navbar}</div>

                </div>

                {/* SEARCH */}

                <div className="hidden 2xl:block relative">

                    <Search
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                        size={16}
                    />

                    <input
                        id="schema-search"
                        placeholder="Search schema..."
                        className="bg-white/5 border-white/10 rounded-lg pl-10 pr-4 py-1.5 text-sm w-48 text-white outline-none focus:ring-1 focus:ring-[var(--primary)]"
                    />

                </div>

            </header>

            {/* ---------------- WORKSPACE ---------------- */}

            <div className="flex flex-1 overflow-hidden p-0 gap-0 relative">

                {/* FLOATING ACTION RAIL (Left) */}
                <aside className="absolute left-6 top-6 bottom-6 w-12 flex flex-col items-center py-4 gap-4 glass-panel rounded-xl z-[6000] shadow-2xl backdrop-blur-xl border-white/5">

                    <LeftSidebar {...sidebarProps} collapsed />

                </aside>

                {/* MAIN CONTENT - Now takes full width with a slight offset for the rail */}
                <main className="flex-1 flex flex-col relative min-w-0 pl-20">

                    <div className="flex-1 relative overflow-hidden">
                        {children}
                    </div>

                </main>

                {/* RIGHT SIDEBAR */}

                <AnimatePresence>

                    {isRightOpen && (
                        <motion.aside
                            variants={sidebarVariants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            transition={{ duration: 0.25 }}
                            className="flex flex-col gap-6 shrink-0 w-[320px]"
                        >
                            <RightSidebar {...sidebarProps} />
                        </motion.aside>
                    )}

                </AnimatePresence>

                {/* TOGGLE */}

                <button
                    aria-label="Toggle sidebar"
                    aria-expanded={isRightOpen}
                    onClick={() => setIsRightOpen(!isRightOpen)}
                    className={cn(
                        "absolute top-1/2 -translate-y-1/2 z-50 p-2 rounded-l-xl",
                        "bg-[var(--bg-dark)] border-y border-l border-white/10",
                        "text-slate-400 hover:text-[var(--primary)] transition-all",
                        isRightOpen ? "right-[21.5rem]" : "right-6"
                    )}
                >
                    {isRightOpen ? (
                        <ChevronRight size={16} />
                    ) : (
                        <ChevronLeft size={16} />
                    )}
                </button>

            </div>

            {!isInspectorActive && (
                <footer className="h-8 bg-[var(--bg-dark)]/90 border-t border-white/5 px-6 flex items-center justify-between text-[10px] text-slate-500 backdrop-blur-md">
                    <SystemStatus
                        sysVitals={sysVitals}
                        sysStatus={sysStatus}
                    />
                    <div className="flex items-center gap-4">
                        <span className="text-[var(--primary)]/50">
                            LATENT_MODE: ENABLED
                        </span>
                        <span className="font-mono">{time}</span>
                    </div>
                </footer>
            )}

        </div>
    );
};

export default React.memo(DashboardLayout);