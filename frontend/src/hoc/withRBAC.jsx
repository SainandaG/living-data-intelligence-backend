import React from 'react';
import { useAuthStore } from '../stores/authStore';
import { ShieldAlert } from 'lucide-react';

export const withRBAC = (WrappedComponent, requiredFeature, minRole = 'viewer') => {
    return function RBACGuard(props) {
        const { canDo } = useAuthStore();
        
        // Use unified feature+fallback check if provided, otherwise pure hierarchical check
        const isAuthorized = requiredFeature ? canDo(requiredFeature, minRole) : canDo(minRole);
        
        if (!isAuthorized) {
            return (
                <div className="flex flex-col items-center justify-center w-full h-full min-h-[300px] bg-slate-950/80 p-8 rounded-2xl border border-rose-500/20 backdrop-blur-sm shadow-2xl">
                    <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-6 shadow-inner">
                        <ShieldAlert className="text-rose-400" size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2 uppercase tracking-widest text-center flex items-center gap-2">
                        Access Restricted
                    </h2>
                    <p className="text-slate-400 text-sm max-w-md text-center leading-relaxed">
                        Your current organizational security clearance does not permit access to this module.
                        <br/><br/>
                        <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold border border-slate-800 bg-slate-900 px-2 py-1 rounded">
                            Required: <span className="text-rose-400">{requiredFeature || minRole}</span>
                        </span>
                    </p>
                </div>
            );
        }
        
        return <WrappedComponent {...props} />;
    };
};
