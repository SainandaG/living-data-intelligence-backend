import React, { useEffect, useState } from 'react';
import { Database, Search, Table, Key, GitBranch, Code, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SchemaView({ connectionId }) {
    const [schema, setSchema] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTable, setSelectedTable] = useState(null);
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'erd'

    useEffect(() => {
        if (!connectionId) return;

        const fetchSchema = async () => {
            try {
                const response = await fetch(`/api/schema/${connectionId}`);
                if (response.ok) {
                    const data = await response.json();
                    setSchema(data);
                }
            } catch (err) {
                console.error('Failed to fetch schema:', err);
            }
        };

        fetchSchema();
    }, [connectionId]);

    const filteredTables = schema?.tables?.filter(table =>
        table.name.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    const generateSQL = () => {
        if (!selectedTable) return;
        const sql = `SELECT * FROM ${selectedTable.name} LIMIT 100;`;
        navigator.clipboard.writeText(sql);
        alert('SQL copied to clipboard!');
    };

    return (
        <div className="w-full h-full flex bg-gradient-to-br from-[#0a0e1a] via-[#0f1419] to-[#0a0e1a] pointer-events-auto">
            {/* Left Panel - Table List */}
            <div className="w-80 border-r border-white/10 bg-[var(--bg-elevated)]/50 backdrop-blur-md flex flex-col">
                <div className="p-4 border-b border-white/10">
                    <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                        <div className="p-2 bg-gradient-to-br from-[var(--primary-cyan)] to-[var(--primary-purple)] rounded-lg">
                            <Database size={18} />
                        </div>
                        Schema Explorer
                    </h2>

                    {/* View Mode Toggle */}
                    <div className="flex gap-2 mb-4">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${viewMode === 'list'
                                ? 'bg-[var(--primary-cyan)]/20 text-[var(--primary-cyan)] border border-[var(--primary-cyan)]'
                                : 'bg-white/5 text-[var(--text-secondary)] border border-white/10 hover:border-white/20'
                                }`}
                        >
                            <Table size={14} className="inline mr-1" />
                            List View
                        </button>
                        <button
                            onClick={() => setViewMode('erd')}
                            className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${viewMode === 'erd'
                                ? 'bg-[var(--primary-cyan)]/20 text-[var(--primary-cyan)] border border-[var(--primary-cyan)]'
                                : 'bg-white/5 text-[var(--text-secondary)] border border-white/10 hover:border-white/20'
                                }`}
                        >
                            <GitBranch size={14} className="inline mr-1" />
                            ERD
                        </button>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={16} />
                        <input
                            type="text"
                            placeholder="Search tables..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-[var(--bg-primary)] border border-white/10 rounded-lg text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--primary-cyan)] transition-all"
                        />
                    </div>
                </div>

                {/* Table List */}
                <div className="flex-1 overflow-auto p-4 space-y-2">
                    <AnimatePresence>
                        {filteredTables.map((table, i) => (
                            <motion.button
                                key={table.name}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ delay: i * 0.03 }}
                                onClick={() => setSelectedTable(table)}
                                className={`w-full text-left p-3 rounded-lg border transition-all ${selectedTable?.name === table.name
                                    ? 'bg-gradient-to-r from-[var(--primary-cyan)]/20 to-[var(--primary-purple)]/20 border-[var(--primary-cyan)]'
                                    : 'bg-white/5 border-white/10 hover:border-[var(--primary-cyan)]/50 hover:bg-white/10'
                                    }`}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <Table size={14} className="text-[var(--primary-cyan)]" />
                                    <span className="font-semibold text-[var(--text-primary)] text-sm">
                                        {table.name}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                                    <span>{table.columns?.length || 0} cols</span>
                                    <span>•</span>
                                    <span>{(table.row_count || 0).toLocaleString()} rows</span>
                                </div>
                                {table.table_type && (
                                    <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded ${table.table_type === 'fact'
                                        ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                        : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                        }`}>
                                        {table.table_type}
                                    </span>
                                )}
                            </motion.button>
                        ))}
                    </AnimatePresence>
                </div>
            </div>

            {/* Right Panel - Table Details or ERD */}
            <div className="flex-1 overflow-auto">
                {viewMode === 'list' ? (
                    selectedTable ? (
                        <div className="p-8">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                            >
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
                                            {selectedTable.name}
                                        </h1>
                                        <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)]">
                                            <span>{selectedTable.columns?.length || 0} columns</span>
                                            <span>•</span>
                                            <span>{(selectedTable.row_count || 0).toLocaleString()} rows</span>
                                            {selectedTable.table_type && (
                                                <>
                                                    <span>•</span>
                                                    <span className="capitalize">{selectedTable.table_type} table</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={generateSQL}
                                        className="flex items-center gap-2 px-4 py-2 bg-[var(--primary-cyan)]/20 border border-[var(--primary-cyan)] rounded-lg hover:bg-[var(--primary-cyan)]/30 transition-all"
                                    >
                                        <Code size={16} />
                                        Generate SQL
                                    </button>
                                </div>

                                {/* Columns Table */}
                                <div className="bg-[var(--bg-elevated)]/50 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden mb-6">
                                    <table className="w-full">
                                        <thead className="bg-gradient-to-r from-white/10 to-white/5">
                                            <tr>
                                                <th className="text-left p-4 text-xs font-bold text-[var(--primary-cyan)] uppercase tracking-wider">
                                                    Column Name
                                                </th>
                                                <th className="text-left p-4 text-xs font-bold text-[var(--primary-cyan)] uppercase tracking-wider">
                                                    Data Type
                                                </th>
                                                <th className="text-left p-4 text-xs font-bold text-[var(--primary-cyan)] uppercase tracking-wider">
                                                    Constraints
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedTable.columns?.map((column, i) => (
                                                <motion.tr
                                                    key={i}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    transition={{ delay: i * 0.02 }}
                                                    className="border-t border-white/5 hover:bg-white/5 transition-colors"
                                                >
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-2">
                                                            {column.is_pk && (
                                                                <Key size={14} className="text-yellow-400" title="Primary Key" />
                                                            )}
                                                            {column.is_fk && (
                                                                <Key size={14} className="text-[var(--primary-cyan)]" title="Foreign Key" />
                                                            )}
                                                            <span className="font-mono text-sm text-[var(--text-primary)] font-semibold">
                                                                {column.name}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className="text-sm text-[var(--text-secondary)] font-mono bg-white/5 px-2 py-1 rounded">
                                                            {column.type || 'unknown'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex gap-2">
                                                            {column.is_pk && (
                                                                <span className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 font-semibold">
                                                                    PRIMARY KEY
                                                                </span>
                                                            )}
                                                            {column.is_fk && (
                                                                <span className="text-xs px-2 py-1 rounded bg-[var(--primary-cyan)]/20 text-[var(--primary-cyan)] border border-[var(--primary-cyan)]/30 font-semibold">
                                                                    FOREIGN KEY
                                                                </span>
                                                            )}
                                                            {!column.is_pk && !column.is_fk && (
                                                                <span className="text-xs text-[var(--text-secondary)]">-</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </motion.tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Relationships */}
                                {(selectedTable.foreign_keys?.length > 0 || selectedTable.primary_keys?.length > 0) && (
                                    <div className="bg-gradient-to-br from-[var(--primary-cyan)]/10 to-[var(--primary-purple)]/10 backdrop-blur-md border border-[var(--primary-cyan)]/30 rounded-xl p-6">
                                        <h3 className="font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                                            <GitBranch className="text-[var(--primary-cyan)]" size={18} />
                                            Relationships
                                        </h3>
                                        <div className="space-y-3">
                                            {selectedTable.foreign_keys?.map((fk, i) => (
                                                <div key={i} className="p-3 bg-white/5 rounded-lg border border-white/10">
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <span className="text-[var(--primary-cyan)] font-mono font-semibold">{fk.column}</span>
                                                        <span className="text-[var(--text-secondary)]">→</span>
                                                        <span className="text-[var(--text-primary)] font-mono font-semibold">
                                                            {fk.referenced_table}.{fk.referenced_column}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center">
                            <div className="text-center">
                                <Database className="mx-auto mb-4 text-[var(--text-secondary)]" size={64} />
                                <p className="text-[var(--text-secondary)] text-lg">
                                    Select a table from the list to view its schema
                                </p>
                            </div>
                        </div>
                    )
                ) : (
                    <ERDView tables={schema?.tables || []} />
                )}
            </div>
        </div>
    );
}

function ERDView({ tables }) {
    return (
        <div className="p-8">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Entity Relationship Diagram</h2>
                <p className="text-[var(--text-secondary)]">Visual representation of your database schema</p>
            </div>

            <div className="bg-[var(--bg-elevated)]/50 backdrop-blur-md border border-white/10 rounded-xl p-8 min-h-[600px]">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tables.map((table, i) => (
                        <motion.div
                            key={table.name}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.05 }}
                            className="bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-lg overflow-hidden hover:border-[var(--primary-cyan)] transition-all"
                        >
                            <div className="bg-gradient-to-r from-[var(--primary-cyan)]/30 to-[var(--primary-purple)]/30 p-3 border-b border-white/20">
                                <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                                    <Table size={16} />
                                    {table.name}
                                </h3>
                                <p className="text-xs text-[var(--text-secondary)] mt-1">
                                    {(table.row_count || 0).toLocaleString()} rows
                                </p>
                            </div>
                            <div className="p-3 max-h-48 overflow-auto">
                                {table.columns?.slice(0, 10).map((col, j) => (
                                    <div key={j} className="flex items-center gap-2 py-1 text-xs">
                                        {col.is_pk && <Key size={12} className="text-yellow-400" />}
                                        {col.is_fk && <Key size={12} className="text-[var(--primary-cyan)]" />}
                                        <span className={`font-mono ${col.is_pk || col.is_fk ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-secondary)]'}`}>
                                            {col.name}
                                        </span>
                                    </div>
                                ))}
                                {table.columns?.length > 10 && (
                                    <p className="text-xs text-[var(--text-secondary)] italic mt-2">
                                        +{table.columns.length - 10} more columns
                                    </p>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
}
