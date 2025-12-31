import React, { useState } from 'react';
import { Settings as SettingsIcon, Shield, Wifi, Globe, Moon } from 'lucide-react';

const Settings = () => {
    const [activeTab, setActiveTab] = useState('general');

    const tabs = [
        { id: 'general', label: 'General', icon: SettingsIcon },
        { id: 'network', label: 'Network', icon: Wifi },
        { id: 'security', label: 'Security', icon: Shield },
        { id: 'display', label: 'Display', icon: Globe },
    ];

    return (
        <div className="flex h-full text-white">
            {/* Sidebar */}
            <div className="w-1/4 min-w-[150px] border-r border-white/10 bg-black/20 p-2">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors mb-2
                            ${activeTab === tab.id ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5'}
                        `}
                    >
                        <tab.icon size={18} />
                        <span className="text-sm font-medium">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 p-8 overflow-y-auto">
                {activeTab === 'general' && (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold">General Settings</h2>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                                <div>
                                    <div className="font-medium">System Name</div>
                                    <div className="text-sm text-gray-400">Living Data Intelligence Node 01</div>
                                </div>
                                <button className="glass-button">Edit</button>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                                <div>
                                    <div className="font-medium">Language</div>
                                    <div className="text-sm text-gray-400">English (US)</div>
                                </div>
                                <button className="glass-button">Change</button>
                            </div>
                        </div>
                    </div>
                )}
                {/* Other tabs placeholders */}
                {activeTab !== 'general' && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <SettingsIcon size={48} className="mb-4 opacity-20" />
                        <p>Settings for {activeTab} coming soon.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Settings;
