import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ArrowRight, Building2, Users, Brain, Layers, Server, Shield, Database, Network, Lock, Radio } from 'lucide-react';

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };

const capabilities = [
  { icon: Network, title: 'Schema Intelligence at Scale', desc: 'Connect hundreds of databases across your organization. Unified 3D visualization with cross-database lineage and dependency mapping.' },
  { icon: Brain, title: 'APEX for Teams', desc: 'Custom AI agent prompts per team. Data engineers ask different questions than product analysts — APEX adapts to each role.' },
  { icon: Radio, title: 'Incident War Rooms', desc: 'When anomalies spike, spin up a shared war room. Everyone sees the same data, same graph, same investigation — in real time.' },
];

const featureBlocks = [
  { icon: Lock, title: 'Security & Compliance', items: ['SSO / SAML authentication', 'Role-based access control (RBAC)', 'Multi-factor authentication (MFA)', 'Full audit logging & traceability', 'SOC 2 Type II & ISO 27001 ready'] },
  { icon: Building2, title: 'Multi-Tenant Architecture', items: ['Tenant isolation per organization', 'Pooled or dedicated database connections', 'Per-team credit allocation', 'Unified billing & usage dashboards'] },
  { icon: Server, title: 'Deployment Options', items: ['Cloud-hosted (managed)', 'On-premise deployment', 'Kubernetes Helm charts', 'Terraform provisioning', 'Air-gapped environment support'] },
  { icon: Users, title: 'Team Collaboration', items: ['Real-time multiplayer cursors', 'Shared perspectives & saved views', 'War room for incident response', 'Schema snapshot time-travel', 'Custom AI agent configurations'] },
];

const teams = [
  { title: 'Data Engineering', desc: 'Visualize schema dependencies, trace lineage, and catch anomalies before they cascade downstream.' },
  { title: 'Analytics', desc: 'Ask APEX questions in plain English. Get SQL, SHAP explanations, and ML predictions without writing code.' },
  { title: 'Platform / SRE', desc: 'Real-time TPS monitoring, anomaly detection, and war rooms for when production databases need attention.' },
  { title: 'Product', desc: 'Understand your data model visually. Trace how user actions flow through tables and spot optimization opportunities.' },
];

export default function Enterprise() {
  const [formData, setFormData] = useState({ name: '', email: '', company: '', size: '', problem: '' });
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="bg-[var(--bg-dark)] text-[var(--text-main)] pt-24 overflow-x-hidden">
      {/* Hero */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-start">
          <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.12 } } }}>
            <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl font-display font-bold leading-tight">
              Database intelligence for{' '}
              <span className="bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] bg-clip-text text-transparent">your entire organization</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-6 text-[var(--text-muted)] text-lg leading-relaxed">
              Living Data Intelligence Enterprise gives every team — data engineering, analytics, platform, and product — a shared, real-time understanding of your database landscape. SSO, RBAC, audit logs, and on-premise deployment included.
            </motion.p>
            <motion.div variants={fadeUp} className="mt-8 flex flex-wrap gap-4">
              <a href="#contact" className="px-6 py-3 bg-[var(--primary)] text-black font-semibold rounded-xl hover:shadow-[0_0_16px_rgba(13,231,242,0.4)] transition-all cursor-pointer">Contact Sales</a>
              <a href="#features" className="px-6 py-3 border border-[var(--glass-border)] rounded-xl hover:bg-[var(--primary)]/5 transition-all cursor-pointer">See Capabilities</a>
            </motion.div>
          </motion.div>

          <motion.div initial="hidden" animate="visible" variants={fadeUp} id="contact" className="glass-panel rounded-2xl p-8">
            {submitted ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-[var(--primary)]/10 flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(13,231,242,0.15)]">
                  <Check size={32} className="text-[var(--primary)]" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Thank you!</h3>
                <p className="text-[var(--text-muted)]">Our team will reach out within 24 hours.</p>
              </div>
            ) : (
              <form onSubmit={e => { e.preventDefault(); setSubmitted(true); }} className="space-y-4">
                <h3 className="text-xl font-semibold mb-4">Talk to Sales</h3>
                {[
                  { key: 'name', label: 'Name', type: 'text' },
                  { key: 'email', label: 'Work Email', type: 'email' },
                  { key: 'company', label: 'Company', type: 'text' },
                ].map(f => (
                  <div key={f.key}>
                    <label htmlFor={f.key} className="block text-sm text-[var(--text-muted)] mb-1">{f.label}</label>
                    <input id={f.key} type={f.type} required value={formData[f.key]}
                      onChange={e => setFormData(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-[var(--bg-dark)] border border-[var(--glass-border)] rounded-lg text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)] focus:shadow-[0_0_8px_rgba(13,231,242,0.15)] transition-all" />
                  </div>
                ))}
                <div>
                  <label htmlFor="size" className="block text-sm text-[var(--text-muted)] mb-1">Team Size</label>
                  <select id="size" value={formData.size} onChange={e => setFormData(p => ({ ...p, size: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-[var(--bg-dark)] border border-[var(--glass-border)] rounded-lg text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)] transition-all">
                    <option value="">Select...</option>
                    <option value="1-10">1-10</option>
                    <option value="11-50">11-50</option>
                    <option value="51-200">51-200</option>
                    <option value="201-500">201-500</option>
                    <option value="500+">500+</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="problem" className="block text-sm text-[var(--text-muted)] mb-1">What databases do you use?</label>
                  <textarea id="problem" rows={3} value={formData.problem}
                    onChange={e => setFormData(p => ({ ...p, problem: e.target.value }))}
                    placeholder="e.g. 50+ PostgreSQL databases, need cross-schema lineage..."
                    className="w-full px-4 py-2.5 bg-[var(--bg-dark)] border border-[var(--glass-border)] rounded-lg text-[var(--text-main)] placeholder-[var(--text-muted)]/40 focus:outline-none focus:border-[var(--primary)] transition-all resize-none" />
                </div>
                <button type="submit" className="w-full py-3 bg-[var(--primary)] text-black font-semibold rounded-xl hover:shadow-[0_0_16px_rgba(13,231,242,0.4)] transition-all cursor-pointer">
                  Contact Sales
                </button>
              </form>
            )}
          </motion.div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="py-20 px-4 bg-[var(--bg-secondary)]">
        <div className="max-w-7xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-display font-bold">Intelligence that scales with your data</h2>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-6">
            {capabilities.map((c, i) => (
              <motion.div key={c.title} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ delay: i * 0.1 }}
                className="glass-panel p-6 rounded-2xl hover:border-[var(--primary)]/30 transition-all cursor-pointer group">
                <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center mb-4 group-hover:bg-[var(--primary)]/20 transition-all">
                  <c.icon size={20} className="text-[var(--primary)]" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{c.title}</h3>
                <p className="text-[var(--text-muted)] text-sm leading-relaxed">{c.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Blocks */}
      <section id="features" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-display font-bold">Built for enterprise requirements</h2>
          </motion.div>
          <div className="grid md:grid-cols-2 gap-6">
            {featureBlocks.map((b, i) => (
              <motion.div key={b.title} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ delay: i * 0.1 }}
                className="glass-panel p-8 rounded-2xl">
                <div className="w-10 h-10 rounded-xl bg-[var(--secondary)]/10 flex items-center justify-center mb-4">
                  <b.icon size={20} className="text-[var(--secondary)]" />
                </div>
                <h3 className="text-xl font-semibold mb-4">{b.title}</h3>
                <ul className="space-y-3">
                  {b.items.map(item => (
                    <li key={item} className="flex items-start gap-2 text-sm text-[var(--text-muted)]">
                      <Check size={16} className="text-[var(--primary)] shrink-0 mt-0.5" /> {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="py-20 px-4 bg-[var(--bg-secondary)]">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <div className="w-16 h-16 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_rgba(13,231,242,0.1)]">
              <Shield size={32} className="text-[var(--primary)]" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">Zero data storage. Zero compromise.</h2>
            <p className="text-[var(--text-muted)] text-lg leading-relaxed mb-8">
              We never store your data. All queries run against your database in real time. Connections are TLS-encrypted, and every action is audit-logged.
            </p>
            <div className="flex justify-center gap-4">
              <span className="px-4 py-2 border border-[var(--primary)]/30 rounded-lg text-[var(--primary)] text-sm font-semibold bg-[var(--primary)]/5">SOC 2 Type II</span>
              <span className="px-4 py-2 border border-[var(--primary)]/30 rounded-lg text-[var(--primary)] text-sm font-semibold bg-[var(--primary)]/5">ISO 27001</span>
              <span className="px-4 py-2 border border-[var(--primary)]/30 rounded-lg text-[var(--primary)] text-sm font-semibold bg-[var(--primary)]/5">GDPR</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Teams */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-display font-bold">Built for every team that touches data</h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {teams.map((t, i) => (
              <motion.div key={t.title} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ delay: i * 0.08 }}
                className="glass-panel p-6 rounded-2xl hover:border-[var(--primary)]/30 transition-all cursor-pointer">
                <h3 className="text-lg font-semibold mb-2">{t.title}</h3>
                <p className="text-[var(--text-muted)] text-sm leading-relaxed">{t.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
