import React, { useState, useEffect } from 'react';
import apiClient from '../../utils/apiClient';
import { useAuthStore } from '../../stores/authStore';
import { logger } from '../../utils/logger';
import { motion, AnimatePresence } from 'framer-motion';
import usePermissions from '../../hooks/usePermissions';
import { User, Shield, Check, X, Plus, ChevronRight, Settings, Fingerprint, ShieldCheck, Key, EyeOff, Table, Database, AlertCircle } from 'lucide-react';
import FeatureGate from '../FeatureGate';

const UserManagementPanel = () => {
    const { can } = usePermissions();
    const canDo = useAuthStore(state => state.canDo);
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [features, setFeatures] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Determine initial tab based on permissions
    const getInitialTab = () => {
        if (can('rbac')) return 'users';
        if (can('masking')) return 'redaction';
        return 'users';
    };
    
    const [activeTab, setActiveTab] = useState(getInitialTab()); 
    const [editingRole, setEditingRole] = useState(null);
    const [newRoleName, setNewRoleName] = useState('');
    const [notification, setNotification] = useState(null);
    const [mfaModal, setMfaModal] = useState(null); // { user, qrCode, secret, code }
    const [mfaCode, setMfaCode] = useState('');
    const [maskingPolicies, setMaskingPolicies] = useState([]);
    const [newPolicy, setNewPolicy] = useState({ connection_id: '', table_name: '', column_name: '', min_role: 'viewer', mask_strategy: 'redact' });

    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const results = await Promise.allSettled([
                apiClient.get('/admin/users'),
                apiClient.get('/admin/roles'),
                apiClient.get('/admin/features'),
                apiClient.get('/admin/masking')
            ]);

            if (results[0].status === 'fulfilled') {
                setUsers(results[0].value || []);
            } else {
                console.error("[UserManagementPanel] Failed to fetch users:", results[0].reason);
            }

            if (results[1].status === 'fulfilled') {
                setRoles(results[1].value || []);
            } else {
                console.error("[UserManagementPanel] Failed to fetch roles:", results[1].reason);
            }

            if (results[2].status === 'fulfilled') {
                setFeatures(results[2].value || null);
            } else {
                console.error("[UserManagementPanel] Failed to fetch features:", results[2].reason);
            }

            if (results[3].status === 'fulfilled') {
                setMaskingPolicies(results[3].value || []);
            } else {
                console.error("[UserManagementPanel] Failed to fetch masking policies:", results[3].reason);
            }

        } catch (err) {
            logger.error('Failed to fetch admin data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSavePolicy = async (policy) => {
        try {
            await apiClient.post('/admin/masking', policy);
            setNotification({ type: 'success', message: 'Masking policy updated' });
            fetchData(true);
        } catch (err) {
            logger.error('Failed to save policy:', err);
            setNotification({ type: 'error', message: 'Failed to save policy' });
        }
    };

    const handleDeletePolicy = async (id) => {
        try {
            await apiClient.delete(`/admin/masking/${id}`);
            setNotification({ type: 'success', message: 'Policy deleted' });
            fetchData(true);
        } catch (err) {
            logger.error('Failed to delete policy:', err);
        }
    };

    const handleSetupMfa = async (user) => {
        try {
            setLoading(true);
            const res = await apiClient.post('/mfa/setup');
            setMfaModal({
                user,
                qrCode: res.qr_code,
                secret: res.secret
            });
        } catch (err) {
            logger.error('Failed to setup MFA:', err);
            setNotification({ type: 'error', message: 'Failed to generate MFA secret' });
        } finally {
            setLoading(false);
        }
    };

    const handleEnableMfa = async () => {
        if (!mfaCode || !mfaModal) return;
        try {
            await apiClient.post('/mfa/enable', {
                code: mfaCode,
                secret: mfaModal.secret
            });
            setNotification({ type: 'success', message: 'MFA enabled successfully' });
            setMfaModal(null);
            setMfaCode('');
            fetchData(true);
        } catch (err) {
            logger.error('Failed to enable MFA:', err);
            setNotification({ type: 'error', message: 'Invalid code or setup failed' });
        }
    };

    const handleUpdateUserRole = async (email, roleName) => {
        try {
            await apiClient.patch(`/admin/users/${email}/role`, { role: roleName });
            setNotification({ type: 'success', message: `Updated ${email} role to ${roleName}` });
            fetchData(true); // Silent refresh
        } catch (err) {
            logger.error('Failed to update user role:', err);
            setNotification({ type: 'error', message: `Failed to update ${email}` });
        }
    };

    const handleToggleUserStatus = async (user) => {
        try {
            await apiClient.patch(`/admin/users/${user.email}/status`, { is_active: !user.is_active });
            setNotification({ type: 'success', message: `User ${user.email} is now ${!user.is_active ? 'active' : 'offline'}` });
            fetchData(true); // Silent refresh
        } catch (err) {
            logger.error('Failed to toggle user status:', err);
            setNotification({ type: 'error', message: `Failed to update ${user.email}` });
        }
    };

    const handleSaveRole = async () => {
        const roleName = editingRole?.name || newRoleName;
        if (!roleName) return;
        
        // Prevent editing system roles in frontend too for better UX
        if (editingRole?.is_system_role && roles.some(r => r.name === roleName)) {
            setNotification({ type: 'error', message: 'System roles cannot be modified' });
            return;
        }

        try {
            await apiClient.post('/admin/roles', {
                name: roleName,
                permissions: editingRole?.permissions || {},
                description: editingRole?.description || 'Custom tenant role'
            });
            setNotification({ type: 'success', message: `Role ${roleName} saved successfully` });
            setEditingRole(null);
            setNewRoleName('');
            fetchData(true); // Silent refresh
        } catch (err) {
            logger.error('Failed to save role:', err);
            const detail = err.response?.data?.detail || 'System error: Database unreachable';
            setNotification({ type: 'error', message: detail });
        }
    };

    const togglePermission = (category, featureId) => {
        if (!editingRole) return;
        
        // [FIX] Ensure permissions is an object before spreading. 
        // If it arrived as a string from the backend, parse it first.
        let currentPerms = editingRole.permissions || {};
        if (typeof currentPerms === 'string') {
            try {
                currentPerms = JSON.parse(currentPerms);
            } catch (e) {
                currentPerms = {};
            }
        }
        
        const newPerms = { ...currentPerms };
        if (!newPerms[category]) newPerms[category] = {};

        // Cycle: none -> read -> execute -> none
        const current = newPerms[category][featureId];
        let next = 'read';
        if (current === 'read') next = 'execute';
        if (current === 'execute') next = 'none';

        newPerms[category][featureId] = next;
        setEditingRole({ ...editingRole, permissions: newPerms });
    };

    if (!canDo('admin')) return <div className="p-8 text-rose-400 font-bold uppercase tracking-widest flex items-center justify-center h-64 bg-slate-900/50 rounded-2xl border border-rose-500/20">Access Denied: Administrative Clearance Required</div>;

    return (
        <div className="flex flex-col h-full bg-slate-950/80 backdrop-blur-xl border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Shield className="w-5 h-5 text-blue-400" /> Organization Security
                    </h2>
                    <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">Role-Based Access Management</p>
                </div>
                <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
                    <FeatureGate feature="rbac">
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'users' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-400 hover:text-white'}`}
                        >
                            User Directory
                        </button>
                    </FeatureGate>
                    <FeatureGate feature="rbac">
                        <button
                            onClick={() => setActiveTab('roles')}
                            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'roles' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-400 hover:text-white'}`}
                        >
                            Role Factory
                        </button>
                    </FeatureGate>
                    <FeatureGate feature="masking">
                        <button
                            onClick={() => setActiveTab('redaction')}
                            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'redaction' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-400 hover:text-white'}`}
                        >
                            Redaction Lab
                        </button>
                    </FeatureGate>
                </div>
            </div>

            {/* MFA Setup Modal */}
            <AnimatePresence>
                {mfaModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl shadow-blue-500/10"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                                        <Fingerprint size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">Multi-Factor Authentication</h3>
                                        <p className="text-xs text-slate-500">Secure access for {mfaModal.user.email}</p>
                                    </div>
                                </div>
                                <button onClick={() => setMfaModal(null)} className="text-slate-500 hover:text-white transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div className="bg-white p-4 rounded-2xl flex justify-center shadow-inner">
                                    <img src={mfaModal.qrCode} alt="MFA QR Code" className="w-48 h-48" />
                                </div>

                                <div className="space-y-3">
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        1. Scan the QR code with your preferred authenticator app (Google Authenticator, Authy, etc.).
                                        <br />
                                        2. Enter the 6-digit verification code below to confirm setup.
                                    </p>
                                    
                                    <div className="relative">
                                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                                        <input
                                            type="text"
                                            maxLength={6}
                                            placeholder="000000"
                                            value={mfaCode}
                                            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                                            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl py-3 pl-10 text-center text-xl font-bold tracking-[0.5em] focus:outline-none focus:border-blue-500/50 transition-all"
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={handleEnableMfa}
                                    disabled={mfaCode.length !== 6}
                                    className="w-full py-4 bg-blue-600 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-all flex items-center justify-center gap-2"
                                >
                                    <ShieldCheck size={18} /> Enable Protection
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex-1 overflow-y-auto p-6">
                <AnimatePresence mode="wait">
                    {loading ? (
                        <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center h-64">
                            <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
                        </motion.div>
                    ) : activeTab === 'users' ? (
                        <motion.div key="users" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                            <table className="w-full text-left">
                                <thead className="text-[10px] text-slate-500 uppercase tracking-widest border-b border-slate-800">
                                    <tr>
                                        <th className="pb-3 px-2">Personnel</th>
                                        <th className="pb-3">Security Clearances</th>
                                        <th className="pb-3">Status</th>
                                        <th className="pb-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {users.map(u => (
                                        <tr key={u.email} className="group hover:bg-slate-900/30 transition-colors">
                                            <td className="py-4 px-2">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-blue-500/20 group-hover:text-blue-400 transition-all">
                                                        <User size={14} />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium text-white">{u.email}</div>
                                                        <div className="text-[10px] text-slate-500 font-mono">ID: {u.email.split('@')[0]}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4">
                                                <select
                                                    value={u.role || ''}
                                                    onChange={(e) => handleUpdateUserRole(u.email, e.target.value)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="bg-slate-900 border border-slate-800 text-xs text-blue-400 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500/50 cursor-pointer"
                                                >
                                                    {roles.map(r => (
                                                        <option key={r.name} value={r.name}>{r.name.toUpperCase()}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="py-4">
                                                <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${u.is_active ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-slate-800 text-slate-500'}`}>
                                                    {u.is_active ? 'Active' : 'Offline'}
                                                </span>
                                            </td>
                                            <td className="py-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => handleSetupMfa(u)}
                                                        className={`p-1.5 rounded-lg transition-all ${u.mfa_enabled ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-slate-500 hover:text-blue-400 hover:bg-blue-500/10'}`}
                                                        title={u.mfa_enabled ? "MFA Enabled" : "Setup MFA"}
                                                    >
                                                        <Fingerprint size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleToggleUserStatus(u)}
                                                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                                                        title={u.is_active ? "Deactivate User" : "Activate User"}
                                                    >
                                                        <Settings size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </motion.div>
                    ) : activeTab === 'redaction' ? (
                        <motion.div key="redaction" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                            {/* Pending Enforcement Banner */}
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="text-sm font-bold text-amber-500">Enforcement Pending</h4>
                                    <p className="text-xs text-amber-400/80 mt-1">
                                        Masking policies are saved but query-time enforcement is pending. Data may still appear unmasked in data views until enforcement is fully deployed.
                                    </p>
                                </div>
                            </div>

                            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
                                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                    <EyeOff size={16} className="text-rose-400" /> Policy Architect
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-slate-500 uppercase font-bold">Connection ID</label>
                                        <input 
                                            type="text" 
                                            placeholder="e.g. primary"
                                            value={newPolicy.connection_id}
                                            onChange={e => setNewPolicy({...newPolicy, connection_id: e.target.value})}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-slate-500 uppercase font-bold">Table Name</label>
                                        <input 
                                            type="text" 
                                            placeholder="e.g. users"
                                            value={newPolicy.table_name}
                                            onChange={e => setNewPolicy({...newPolicy, table_name: e.target.value})}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-slate-500 uppercase font-bold">Column Name</label>
                                        <input 
                                            type="text" 
                                            placeholder="e.g. password"
                                            value={newPolicy.column_name}
                                            onChange={e => setNewPolicy({...newPolicy, column_name: e.target.value})}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-slate-500 uppercase font-bold">Access Level</label>
                                        <select 
                                            value={newPolicy.min_role}
                                            onChange={e => setNewPolicy({...newPolicy, min_role: e.target.value})}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-blue-400 focus:outline-none focus:border-blue-500/50"
                                        >
                                            {roles.map(r => <option key={r.name} value={r.name}>{r.name.toUpperCase()}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-slate-500 uppercase font-bold">Strategy</label>
                                        <div className="flex gap-2">
                                            <select 
                                                value={newPolicy.mask_strategy}
                                                onChange={e => setNewPolicy({...newPolicy, mask_strategy: e.target.value})}
                                                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-emerald-400 focus:outline-none focus:border-blue-500/50"
                                            >
                                                <option value="none">NONE</option>
                                                <option value="redact">REDACT</option>
                                                <option value="hash">HASH</option>
                                                <option value="partial">PARTIAL</option>
                                                <option value="null">NULL</option>
                                            </select>
                                            <button 
                                                onClick={() => handleSavePolicy(newPolicy)}
                                                className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-500 transition-all"
                                            >
                                                <Plus size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] px-2">Active Redaction Rules</h3>
                                <div className="grid grid-cols-1 gap-3">
                                    {maskingPolicies.map(p => (
                                        <div key={p.id} className="flex items-center justify-between p-4 bg-slate-900/60 border border-slate-800/50 rounded-xl group hover:border-blue-500/30 transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500 group-hover:bg-rose-500/10 group-hover:text-rose-400 transition-all">
                                                    <Database size={16} />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-mono text-slate-500">{p.connection_id} /</span>
                                                        <span className="text-sm font-bold text-white">{p.table_name}.{p.column_name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-1">
                                                        <span className="text-[9px] font-bold text-blue-400 uppercase tracking-tighter bg-blue-500/10 px-1.5 py-0.5 rounded">Min Role: {p.min_role}</span>
                                                        <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-tighter bg-emerald-500/10 px-1.5 py-0.5 rounded">Strategy: {p.mask_strategy}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => handleDeletePolicy(p.id)}
                                                className="p-2 text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))}
                                    {maskingPolicies.length === 0 && (
                                        <div className="p-12 text-center border-2 border-dashed border-slate-800 rounded-2xl">
                                            <EyeOff size={32} className="text-slate-700 mx-auto mb-3" />
                                            <p className="text-xs text-slate-500 uppercase tracking-widest font-mono">No redaction policies deployed</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div key="roles" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Role List */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Available Roles</h3>
                                    <button
                                        onClick={() => { setEditingRole({ name: '', permissions: {} }); setNewRoleName(''); }}
                                        className="p-1.5 bg-blue-600/10 border border-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/20 transition-all"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>
                                {roles.map(r => (
                                    <div
                                        key={r.name}
                                        onClick={() => setEditingRole(r)}
                                        className={`p-4 rounded-xl border transition-all cursor-pointer ${editingRole?.name === r.name ? 'bg-blue-600/10 border-blue-600/40 shadow-lg shadow-blue-900/20' : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="text-sm font-bold text-white">{r.name.toUpperCase()}</div>
                                                <div className="text-[10px] text-slate-500 mt-1">{r.description || 'No description provided'}</div>
                                            </div>
                                            <ChevronRight className={`w-4 h-4 transition-transform ${editingRole?.name === r.name ? 'text-blue-400 rotate-90' : 'text-slate-600'}`} />
                                        </div>
                                        {r.is_system_role && <div className="mt-3 inline-block text-[8px] font-bold text-amber-500/80 uppercase tracking-tighter border border-amber-500/20 px-1.5 rounded">System Protected</div>}
                                    </div>
                                ))}
                            </div>

                            {/* Permission Editor */}
                            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 min-h-[400px] max-h-[600px] flex flex-col">
                                {editingRole ? (
                                    <div className="flex flex-col gap-4 flex-1 min-h-0">
                                        <div className="flex items-center justify-between border-b border-slate-800 pb-4 shrink-0">
                                            <input
                                                type="text"
                                                value={editingRole.name ? editingRole.name.toUpperCase() : newRoleName}
                                                onChange={(e) => setNewRoleName(e.target.value)}
                                                placeholder="ROLE NAME..."
                                                disabled={!!editingRole.name && roles.some(r => r.name === editingRole.name)}
                                                className="bg-transparent text-lg font-bold text-white focus:outline-none placeholder:text-slate-700 w-full"
                                            />
                                            {(!editingRole.name || !roles.some(r => r.name === editingRole.name)) ? (
                                                <button onClick={handleSaveRole} className="px-4 py-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-lg uppercase shadow-lg shadow-blue-900/40">Initialize</button>
                                            ) : (
                                                <button 
                                                    onClick={handleSaveRole} 
                                                    disabled={editingRole.is_system_role}
                                                    className={`px-4 py-1.5 text-white text-[10px] font-bold rounded-lg uppercase shadow-lg transition-all ${editingRole.is_system_role ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-emerald-600 shadow-emerald-900/40 hover:bg-emerald-500'}`}
                                                >
                                                    {editingRole.is_system_role ? 'System Protected' : 'Save Changes'}
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex-1 overflow-y-auto space-y-5 custom-scrollbar pr-1">
                                            {features?.categories.map(cat => (
                                                <div key={cat.id} className="space-y-3">
                                                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">{cat.name}</h4>
                                                    <div className="grid grid-cols-1 gap-2">
                                                        {cat.features.map(f => {
                                                            const current = editingRole.permissions[cat.id]?.[f.id] || 'none';
                                                            return (
                                                                <div
                                                                    key={f.id}
                                                                    onClick={() => togglePermission(cat.id, f.id)}
                                                                    className={`flex items-center justify-between p-3 rounded-lg border transition-all select-none cursor-pointer ${current !== 'none' ? 'bg-slate-800/50 border-blue-500/20' : 'bg-slate-950 border-slate-800/50 grayscale opacity-40'}`}
                                                                >
                                                                    <span className="text-xs text-slate-300 font-medium">{f.name}</span>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`text-[8px] font-bold uppercase tracking-tighter px-1.5 py-0.5 rounded ${current === 'execute' ? 'bg-cyan-500/20 text-cyan-400' : current === 'read' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-600'}`}>
                                                                            {current.toUpperCase()}
                                                                        </span>
                                                                        {current !== 'none' ? <Check size={14} className="text-blue-500" /> : <X size={14} className="text-slate-700" />}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                                        <Settings size={48} className="text-slate-500 mb-4" />
                                        <p className="text-xs text-slate-400 font-mono tracking-widest uppercase">Select a role to configure <br />quantum permissions</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Notification Toast */}
            <AnimatePresence>
                {notification && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        className={`fixed bottom-8 right-8 px-6 py-3 rounded-xl border shadow-2xl z-50 flex items-center gap-3 ${notification.type === 'success' ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-400' : 'bg-rose-950/90 border-rose-500/30 text-rose-400'
                            }`}
                    >
                        {notification.type === 'success' ? <Check size={18} /> : <X size={18} />}
                        <span className="text-sm font-bold tracking-tight">{notification.message}</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default UserManagementPanel;
