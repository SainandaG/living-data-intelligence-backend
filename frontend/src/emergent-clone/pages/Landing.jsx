import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Database, Brain, Layers, Shield, GitBranch, Activity, Eye, Zap, Network } from 'lucide-react';

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };

const features = [
  { icon: Network, title: '3D Schema Visualization', desc: 'Force-directed graph rendering of your entire database schema. See tables, relationships, and foreign keys in an interactive 3D space.' },
  { icon: Brain, title: 'APEX AI Agent', desc: 'Natural language to SQL. Ask questions about your data in plain English — APEX writes the queries, runs analysis, and explains results.' },
  { icon: Layers, title: 'Latent Space Projections', desc: 'Dimensional reduction of your schema into latent space. See hidden clusters, structural patterns, and data relationships emerge.' },
  { icon: Activity, title: 'Real-Time Analytics', desc: 'Live TPS monitoring, anomaly detection, SHAP explainability, and ML-driven insights updating in real time.' },
  { icon: Eye, title: 'Perspective Lineage', desc: 'Trace data flow across your schema from analyst or business perspective. Multi-select nodes to reveal hidden dependencies.' },
  { icon: Shield, title: 'Enterprise Security', desc: 'JWT auth, RBAC, MFA, SQL injection protection, and full audit logging. SOC 2 and ISO 27001 ready.' },
];

const stats = [
  { value: '3D', label: 'Schema Visualization' },
  { value: '<50ms', label: 'Query Latency' },
  { value: '100+', label: 'Database Engines' },
  { value: 'Real-time', label: 'Anomaly Detection' },
];

const faqs = [
  { q: 'What databases are supported?', a: 'PostgreSQL, MySQL, SQL Server, Oracle, and more. Connect any database via standard connection strings — we auto-discover schemas, tables, and relationships.' },
  { q: 'How does the AI agent work?', a: 'APEX uses Gemini-powered NL→SQL to translate natural language questions into optimized queries. It runs analysis, generates SHAP explanations, and provides actionable insights.' },
  { q: 'Is my data safe?', a: 'We never store your data. All queries run against your database in real time. Connections use TLS encryption, and we support SSO, RBAC, and MFA.' },
  { q: 'What is Latent Space?', a: 'Latent Space projects your schema structure into a lower-dimensional space using PCA/t-SNE, revealing hidden clusters and structural similarities between tables.' },
  { q: 'Can I collaborate with my team?', a: 'Yes. Real-time multiplayer with shared cursors, perspectives, and war rooms for incident response. See what your team sees, live.' },
  { q: 'How does pricing work?', a: 'Free tier for individual databases. Pro for teams with advanced AI and unlimited connections. Enterprise for custom deployments with SSO and dedicated support.' },
];

export default function Landing() {
  return (
    <div className="bg-[var(--bg-dark)] text-[var(--text-main)] overflow-x-hidden">
      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--primary)]/5 via-transparent to-transparent" />
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[var(--primary)]/8 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-[var(--secondary)]/5 rounded-full blur-[100px]" />
        </div>
        <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.15 } } }}
          className="relative z-10 text-center max-w-4xl mx-auto px-4 pt-24">
          <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-md text-xs text-[var(--text-muted)] mb-8">
            <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse shadow-[0_0_6px_var(--primary)]" />
            v2.0 Neural Core — Now Live
          </motion.div>
          <motion.h1 variants={fadeUp} className="text-5xl sm:text-7xl font-display font-bold leading-tight tracking-tight">
            See Your Database{' '}
            <span className="bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] bg-clip-text text-transparent">Think</span>
          </motion.h1>
          <motion.p variants={fadeUp} className="mt-6 text-lg sm:text-xl text-[var(--text-muted)] max-w-2xl mx-auto leading-relaxed">
            3D schema visualization, AI-powered analytics, and real-time intelligence for your database. Connect, explore, and understand your data like never before.
          </motion.p>
          <motion.div variants={fadeUp} className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/site/signup" className="px-8 py-3 bg-[var(--primary)] text-black font-semibold rounded-xl hover:shadow-[0_0_20px_rgba(13,231,242,0.4)] transition-all duration-200 cursor-pointer flex items-center gap-2">
              Connect Your Database <ArrowRight size={18} />
            </Link>
            <Link to="/features" className="px-8 py-3 border border-[var(--glass-border)] text-[var(--text-main)] rounded-xl hover:bg-[var(--primary)]/5 hover:border-[var(--primary)]/30 transition-all duration-200 cursor-pointer">
              See It In Action
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div variants={fadeUp} className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
            {stats.map(s => (
              <div key={s.label} className="glass-panel rounded-xl p-4 text-center">
                <div className="text-2xl font-display font-bold text-[var(--primary)]">{s.value}</div>
                <div className="text-xs text-[var(--text-muted)] mt-1">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-16">
            <h2 className="text-3xl sm:text-5xl font-display font-bold">Your Database, Fully Alive</h2>
            <p className="mt-4 text-[var(--text-muted)] text-lg max-w-2xl mx-auto">From schema discovery to anomaly detection — one platform, zero blind spots.</p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div key={f.title} initial="hidden" whileInView="visible" viewport={{ once: true }}
                variants={fadeUp} transition={{ delay: i * 0.1 }}
                className="glass-panel p-6 rounded-2xl hover:border-[var(--primary)]/30 hover:shadow-[0_0_20px_rgba(13,231,242,0.05)] transition-all duration-200 cursor-pointer group">
                <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center mb-4 group-hover:bg-[var(--primary)]/20 group-hover:shadow-[0_0_12px_rgba(13,231,242,0.15)] transition-all">
                  <f.icon size={20} className="text-[var(--primary)]" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-[var(--text-muted)] text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-4 bg-[var(--bg-secondary)]">
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-16">
            <h2 className="text-3xl sm:text-5xl font-display font-bold">Three Steps to Intelligence</h2>
          </motion.div>
          <div className="space-y-12">
            {[
              { step: '01', title: 'Connect your database', desc: 'Paste your connection string — PostgreSQL, MySQL, SQL Server, or any supported engine. Schema discovery is automatic.' },
              { step: '02', title: 'Explore in 3D', desc: 'Your schema renders as an interactive force-directed graph. Zoom, rotate, click tables, trace lineage, toggle lenses.' },
              { step: '03', title: 'Ask APEX anything', desc: '"What tables have the most anomalies?" "Show me churn drivers." Natural language to SQL, with SHAP explanations.' },
            ].map((s, i) => (
              <motion.div key={s.step} initial="hidden" whileInView="visible" viewport={{ once: true }}
                variants={fadeUp} transition={{ delay: i * 0.15 }} className="flex gap-6 items-start">
                <span className="text-4xl font-display font-bold text-[var(--primary)]/30 shrink-0 font-mono">{s.step}</span>
                <div>
                  <h3 className="text-xl font-semibold mb-2">{s.title}</h3>
                  <p className="text-[var(--text-muted)] leading-relaxed">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-24 px-4">
        <div className="max-w-3xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-16">
            <h2 className="text-3xl sm:text-5xl font-display font-bold">Your Questions, Answered</h2>
          </motion.div>
          <div className="space-y-4">
            {faqs.map((f, i) => (
              <motion.details key={i} initial="hidden" whileInView="visible" viewport={{ once: true }}
                variants={fadeUp} transition={{ delay: i * 0.05 }}
                className="group glass-panel rounded-xl overflow-hidden">
                <summary className="flex items-center justify-between p-5 cursor-pointer text-[var(--text-main)] font-medium hover:bg-[var(--primary)]/5 transition-colors">
                  {f.q}
                  <span className="text-[var(--primary)] group-open:rotate-45 transition-transform duration-200 text-xl">+</span>
                </summary>
                <div className="px-5 pb-5 text-[var(--text-muted)] text-sm leading-relaxed">{f.a}</div>
              </motion.details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="glass-panel rounded-2xl p-12">
            <h2 className="text-3xl sm:text-5xl font-display font-bold mb-6">Ready to See Your Data Think?</h2>
            <p className="text-[var(--text-muted)] text-lg mb-10">Connect your first database in under 60 seconds. No credit card required.</p>
            <Link to="/site/signup" className="inline-flex items-center gap-2 px-8 py-4 bg-[var(--primary)] text-black font-semibold rounded-xl hover:shadow-[0_0_24px_rgba(13,231,242,0.4)] transition-all duration-200 cursor-pointer text-lg">
              Start Free <ArrowRight size={20} />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
