import React from 'react';
import { motion } from 'framer-motion';
import { Network, Brain, Layers, Activity, Eye, Shield, Database, GitBranch, Zap, Users, BarChart3, Bot, Search, Radio, Fingerprint, Globe } from 'lucide-react';

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };

const featureGroups = [
  {
    title: 'Visualize', subtitle: 'Your schema in three dimensions',
    features: [
      { icon: Network, title: '3D Force-Directed Graph', desc: 'Every table is a node, every foreign key is an edge. Zoom, rotate, click — your schema rendered as a living, breathing network.' },
      { icon: Layers, title: 'Latent Space Projections', desc: 'PCA and t-SNE projections reveal hidden clusters. See which tables are structurally similar and where your schema is dense.' },
      { icon: Eye, title: 'Perspective Lineage', desc: 'Trace data flow from analyst or business perspective. Multi-select nodes to reveal dependency chains and impact paths.' },
      { icon: BarChart3, title: 'Lens System', desc: 'Toggle between Activity, Gravity, ROI, and Anomaly lenses to see your schema through different analytical perspectives.' },
    ],
  },
  {
    title: 'Analyze', subtitle: 'AI-powered data intelligence',
    features: [
      { icon: Brain, title: 'APEX AI Agent', desc: 'Natural language to SQL. Ask "find churn drivers" or "detect anomalies in orders" — APEX writes queries, runs analysis, and explains results with SHAP.' },
      { icon: Activity, title: 'Real-Time Monitoring', desc: 'Live TPS tracking, anomaly alerts, and performance heatmaps. Know when something changes before it becomes a problem.' },
      { icon: Search, title: 'Work On Data', desc: 'Classification, regression, and time series forecasting built in. Point at a table, pick a target column, and get ML predictions.' },
      { icon: Bot, title: 'Intelligence Hub', desc: 'Centralized insights: pattern recognition, automated relationship discovery, query optimization suggestions, and data quality scores.' },
    ],
  },
  {
    title: 'Collaborate', subtitle: 'Built for teams, not just individuals',
    features: [
      { icon: Users, title: 'Multiplayer', desc: 'Real-time cursors, shared perspectives, and synchronized navigation. See what your teammates are exploring, live.' },
      { icon: Radio, title: 'War Rooms', desc: 'When incidents happen, spin up a war room. Everyone sees the same anomaly data, same graph state, same investigation context.' },
      { icon: GitBranch, title: 'Schema Snapshots', desc: 'Time-travel through schema evolution. Compare states, replay migrations, and understand how your database has changed over time.' },
      { icon: Globe, title: 'Shared Perspectives', desc: 'Save and share your exact view — filters, lenses, selected nodes, camera angle — so teammates can pick up where you left off.' },
    ],
  },
  {
    title: 'Secure', subtitle: 'Enterprise-grade from the ground up',
    features: [
      { icon: Shield, title: 'Authentication & RBAC', desc: 'JWT auth, role-based access control, and multi-factor authentication. Control who sees what, down to the table level.' },
      { icon: Fingerprint, title: 'Audit Logging', desc: 'Every query, every login, every schema change — logged and traceable. Full compliance audit trail.' },
      { icon: Database, title: 'Zero Data Storage', desc: 'We never store your data. All queries run against your database in real time over TLS-encrypted connections.' },
      { icon: Zap, title: 'SQL Injection Protection', desc: 'Parameterized queries, input sanitization, and rate limiting. Your database connection is hardened by default.' },
    ],
  },
];

export default function Features() {
  return (
    <div className="bg-[var(--bg-dark)] text-[var(--text-main)] pt-24 pb-16 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} className="text-center mb-20">
          <h1 className="text-4xl sm:text-6xl font-display font-bold mb-4">
            Every tool your data team{' '}
            <span className="bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] bg-clip-text text-transparent">actually needs</span>
          </h1>
          <p className="text-[var(--text-muted)] text-lg max-w-2xl mx-auto">Schema visualization, AI analytics, real-time monitoring, and team collaboration — in one platform.</p>
        </motion.div>

        {featureGroups.map((group) => (
          <section key={group.title} className="mb-24">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="mb-12">
              <div className="flex items-center gap-3 mb-2">
                <span className="px-3 py-1 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-bold uppercase tracking-wider border border-[var(--primary)]/20">{group.title}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-display font-bold">{group.subtitle}</h2>
            </motion.div>
            <div className="grid sm:grid-cols-2 gap-6">
              {group.features.map((f, i) => (
                <motion.div key={f.title} initial="hidden" whileInView="visible" viewport={{ once: true }}
                  variants={fadeUp} transition={{ delay: i * 0.08 }}
                  className="glass-panel p-6 rounded-2xl hover:border-[var(--primary)]/30 hover:shadow-[0_0_20px_rgba(13,231,242,0.05)] transition-all duration-200 cursor-pointer group">
                  <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center mb-4 group-hover:bg-[var(--primary)]/20 group-hover:shadow-[0_0_12px_rgba(13,231,242,0.15)] transition-all">
                    <f.icon size={20} className="text-[var(--primary)]" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                  <p className="text-[var(--text-muted)] text-sm leading-relaxed">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
