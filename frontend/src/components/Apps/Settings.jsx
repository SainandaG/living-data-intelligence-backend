import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Shield, Wifi, Globe, Monitor, Volume2, VolumeX } from 'lucide-react';

const Settings = () => {
    const [activeTab, setActiveTab] = useState('general');
    const [settings, setSettings] = useState(() => {
        const saved = localStorage.getItem('system_settings');
        return saved ? JSON.parse(saved) : {
            systemName: 'Living Data Intelligence',
            language: 'English (US)',
            darkMode: true,
            soundEnabled: true,
            autoRefresh: true,
            refreshInterval: 30,
        };
    });

    useEffect(() => {
        localStorage.setItem('system_settings', JSON.stringify(settings));
    }, [settings]);

    const tabs = [
        { id: 'general', label: 'General', icon: SettingsIcon },
        { id: 'display', label: 'Display', icon: Monitor },
    ];

    const handleChange = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

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
                            <SettingRow label="System Name" description={settings.systemName} />
                            <SettingRow label="Language" description={settings.language} />
                            <SettingToggle
                                label="Sound Effects"
                                description="Enable UI sound effects"
                                icon={settings.soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                                value={settings.soundEnabled}
                                onChange={(v) => handleChange('soundEnabled', v)}
                            />
                            <SettingToggle
                                label="Auto Refresh"
                                description={`Refresh data every ${settings.refreshInterval}s`}
                                value={settings.autoRefresh}
                                onChange={(v) => handleChange('autoRefresh', v)}
                            />
                        </div>
                    </div>
                )}
                {activeTab === 'display' && (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold">Display Settings</h2>
                        <div className="space-y-4">
                            <SettingToggle
                                label="Dark Mode"
                                description="Use dark theme throughout the interface"
                                icon={<Monitor size={18} />}
                                value={settings.darkMode}
                                onChange={(v) => handleChange('darkMode', v)}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

function SettingRow({ label, description }) {
    return (
        <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
            <div>
                <div className="font-medium">{label}</div>
                <div className="text-sm text-gray-400">{description}</div>
            </div>
        </div>
    );
}

function SettingToggle({ label, description, icon, value, onChange }) {
    return (
        <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
            <div className="flex items-center gap-3">
                {icon && <span className="text-gray-400">{icon}</span>}
                <div>
                    <div className="font-medium">{label}</div>
                    <div className="text-sm text-gray-400">{description}</div>
                </div>
            </div>
            <button
                onClick={() => onChange(!value)}
                className={`w-12 h-6 rounded-full transition-colors relative ${value ? 'bg-cyan-500' : 'bg-white/20'}`}
            >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${value ? 'left-[26px]' : 'left-0.5'}`} />
            </button>
        </div>
    );
}

export default Settings;
