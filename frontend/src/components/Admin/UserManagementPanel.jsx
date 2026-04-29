import React, { useState, useEffect } from 'react';
import apiClient from '../../utils/apiClient';
import { useAuthStore } from '../../stores/authStore';
import { logger } from '../../utils/logger';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Shield, Check, X, Plus, ChevronRight, Settings } from 'lucide-react';

const UserManagementPanel = () => {
    const { userRole, canDo } = useAuthStore();
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [features, setFeatures] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('users'); // users | roles
    const [editingRole, setEditingRole] = useState(null);
    const [newRoleName, setNewRoleName] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [usersRes, rolesRes, featuresRes] = await Promise.all([
                apiClient.get('/admin/users'),
                apiClient.get('/admin/roles'),
                apiClient.get('/admin/features')
            ]);
            setUsers(usersRes || []);
            setRoles(rolesRes || []);
            setFeatures(featuresRes || null);
        } catch (err) {
            logger.error('Failed to fetch admin data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateUserRole = async (email, roleName) => {
        try {
            await apiClient.patch(`/admin/users/${email}/role`, { role: roleName });
            fetchData();
        } catch (err) {
            logger.error('Failed to update user role:', err);
        }
    };

    const handleSaveRole = async () => {
        if (!newRoleName) return;
        try {
            await apiClient.post('/admin/roles', {
                name: newRoleName,
                permissions: editingRole?.permissions || {},
                description: 'Custom tenant role'
            });
            setEditingRole(null);
            setNewRoleName('');
            fetchData();
        } catch (err) {
            logger.error('Failed to create role:', err);
        }
    };

    const togglePermission = (category, featureId) => {
        if (!editingRole) return;
        const newPerms = { ...editingRole.permissions };
        if (!newPerms[category]) newPerms[category] = {};
        
        // Cycle: none -> read -> execute -> none
        const current = newPerms[category][featureId];
        let next = 'read';
        if (current === 'read') next = 'execute';
        if (current === 'execute') next = 'none';
        
        newPerms[category][featureId] = next;
        setEditingRole({ ...editingRole, permissions: newPerms });
    };

    if (!canDo('admin')) return <div className="p-8 text-rose-400">Access Denied</div>;

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
                    <button 
                        onClick={() => setActiveTab('users')}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'users' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-400 hover:text-white'}`}
                    >
                        User Directory
                    </button>
                    <button 
                        onClick={() => setActiveTab('roles')}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'roles' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-400 hover:text-white'}`}
                    >
                        Role Factory
                    </button>
                </div>
            </div>

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
                                                    className="bg-slate-900 border border-slate-800 text-xs text-blue-400 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500/50"
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
                                                <button 
                                                    onClick={() => alert(`Settings for ${u.email} coming soon`)}
                                                    className="text-slate-500 hover:text-white transition-colors"
                                                >
                                                    <Settings size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
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
                            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 min-h-[400px]">
                                {editingRole ? (
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
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
                                                <button onClick={handleSaveRole} className="px-4 py-1.5 bg-emerald-600 text-white text-[10px] font-bold rounded-lg uppercase shadow-lg shadow-emerald-900/40">Save Changes</button>
                                            )}
                                        </div>

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
        </div>
    );
};

export default UserManagementPanel;
