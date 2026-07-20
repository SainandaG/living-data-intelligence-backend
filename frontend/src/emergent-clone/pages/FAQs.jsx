import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };

const faqGroups = [
  {
    category: 'Platform',
    items: [
      { q: 'What is Living Data Intelligence?', a: 'A real-time database intelligence platform. Connect any database and get 3D schema visualization, AI-powered analytics, anomaly detection, and team collaboration — all in one place.' },
      { q: 'What databases are supported?', a: 'PostgreSQL, MySQL, SQL Server, Oracle, SQLite, and more. Any database with a standard connection string. Schema discovery, relationship mapping, and foreign key detection are fully automatic.' },
      { q: 'What is the 3D schema graph?', a: 'Your database schema rendered as an interactive Three.js force-directed graph. Tables are nodes, foreign keys are edges. You can zoom, rotate, click tables, trace lineage, and toggle analytical lenses.' },
      { q: 'What is APEX?', a: 'APEX is our AI agent that converts natural language into SQL queries. Ask "find churn drivers" or "detect anomalies in orders" — it writes the query, runs analysis, and explains results with SHAP.' },
    ],
  },
  {
    category: 'Data & Security',
    items: [
      { q: 'Do you store my data?', a: 'Never. All queries run against your database in real time over TLS-encrypted connections. We store only schema metadata (table names, column types, relationships) to render the graph.' },
      { q: 'What security certifications do you have?', a: 'SOC 2 Type II and ISO 27001 ready. We support SSO/SAML, role-based access control, multi-factor authentication, and full audit logging.' },
      { q: 'Can I deploy on-premise?', a: 'Yes. Enterprise plans include on-premise deployment via Kubernetes Helm charts or Terraform. Air-gapped environments are supported.' },
    ],
  },
  {
    category: 'Features',
    items: [
      { q: 'What is Latent Space?', a: 'Latent Space projects your schema structure into a lower-dimensional space using PCA/t-SNE, revealing hidden structural clusters and similarities between tables that aren\'t obvious from the ER diagram.' },
      { q: 'What is Perspective Lineage?', a: 'Lineage tracing that shows how data flows through your schema. Toggle between analyst perspective (technical dependencies) and business perspective (business impact chains).' },
      { q: 'Can I collaborate with my team?', a: 'Yes. Real-time multiplayer with shared cursors, synchronized navigation, and war rooms for incident response. Everyone sees the same graph state, live.' },
      { q: 'Does it do ML?', a: 'Yes. The "Work On Data" module supports classification, regression, and time series forecasting. Point at a table, pick a target column, and get predictions with feature importance analysis.' },
    ],
  },
  {
    category: 'Pricing & Plans',
    items: [
      { q: 'Is there a free tier?', a: 'Yes. The Explorer plan is free forever — 1 database connection, 3D visualization, and 50 APEX AI queries per month. No credit card required.' },
      { q: 'What\'s included in Pro?', a: 'Unlimited connections and AI queries, Latent Space, Perspective Lineage, anomaly detection, ML insights, SHAP analysis, GitHub export, and priority support. $49/mo or $39/mo annual.' },
      { q: 'How does Team pricing work?', a: 'Team plan adds multiplayer collaboration, war rooms, RBAC, audit logging, and custom AI prompts. $149/mo or $119/mo annual. Includes up to 10 seats.' },
      { q: 'What about Enterprise?', a: 'Custom pricing for SSO, on-premise deployment, multi-tenant isolation, dedicated support, and SLA. Contact sales for a quote.' },
    ],
  },
];

export default function FAQs() {
  return (
    <div className="bg-[var(--bg-dark)] text-[var(--text-main)] pt-24 pb-16 overflow-x-hidden">
      <div className="max-w-3xl mx-auto px-4">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} className="text-center mb-16">
          <h1 className="text-4xl sm:text-6xl font-display font-bold mb-4">Frequently Asked Questions</h1>
          <p className="text-[var(--text-muted)] text-lg">Everything you need to know about Living Data Intelligence.</p>
        </motion.div>

        {faqGroups.map((group) => (
          <div key={group.category} className="mb-12">
            <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
              className="text-[11px] font-bold text-[var(--primary)] uppercase tracking-widest mb-4">{group.category}</motion.h2>
            <div className="space-y-3">
              {group.items.map((f, i) => (
                <motion.details key={i} initial="hidden" whileInView="visible" viewport={{ once: true }}
                  variants={fadeUp} transition={{ delay: i * 0.05 }}
                  className="group glass-panel rounded-xl overflow-hidden">
                  <summary className="flex items-center justify-between p-5 cursor-pointer text-[var(--text-main)] font-medium hover:bg-[var(--primary)]/5 transition-colors">
                    {f.q}
                    <span className="text-[var(--primary)] group-open:rotate-45 transition-transform duration-200 text-xl shrink-0 ml-4">+</span>
                  </summary>
                  <div className="px-5 pb-5 text-[var(--text-muted)] text-sm leading-relaxed">{f.a}</div>
                </motion.details>
              ))}
            </div>
          </div>
        ))}

        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
          className="text-center mt-16 glass-panel rounded-2xl p-8">
          <h3 className="text-xl font-semibold mb-2">Still have questions?</h3>
          <p className="text-[var(--text-muted)] mb-6">Talk to our team or try it free — no credit card required.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/site/signup" className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--primary)] text-black font-semibold rounded-xl hover:shadow-[0_0_16px_rgba(13,231,242,0.4)] transition-all cursor-pointer">
              Start Free <ArrowRight size={18} />
            </Link>
            <Link to="/enterprise" className="inline-flex items-center gap-2 px-6 py-3 border border-[var(--glass-border)] rounded-xl hover:bg-[var(--primary)]/5 transition-all cursor-pointer">
              Contact Sales
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
