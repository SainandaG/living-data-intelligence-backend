import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Sparkles, Database, Zap } from 'lucide-react';

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };

const plans = [
  {
    name: 'Explorer',
    icon: Database,
    price: { monthly: 0, annual: 0 },
    tagline: 'For individuals exploring their data',
    features: [
      '1 database connection',
      '3D schema visualization',
      'Basic APEX AI queries (50/mo)',
      'Table drill-down & inspection',
      'Community support',
    ],
    cta: 'Start Free',
    highlight: false,
  },
  {
    name: 'Pro',
    icon: Zap,
    price: { monthly: 49, annual: 39 },
    savings: 120,
    tagline: 'For data teams who need full power',
    features: [
      'Unlimited database connections',
      'Unlimited APEX AI queries',
      'Latent Space projections',
      'Perspective lineage views',
      'Real-time anomaly detection',
      'ML insights & SHAP analysis',
      'GitHub schema export',
      'Priority support',
    ],
    cta: 'Start Pro',
    highlight: true,
  },
  {
    name: 'Team',
    icon: Sparkles,
    price: { monthly: 149, annual: 119 },
    savings: 360,
    tagline: 'For organizations with multiple teams',
    features: [
      'Everything in Pro',
      'Multiplayer collaboration',
      'Shared perspectives & cursors',
      'War room for incidents',
      'Role-based access control',
      'Audit logging',
      'Custom AI agent prompts',
      'Dedicated onboarding',
    ],
    cta: 'Start Team',
    highlight: false,
  },
  {
    name: 'Enterprise',
    icon: null,
    price: { monthly: 'Custom', annual: 'Custom' },
    tagline: 'For large organizations with compliance needs',
    features: [
      'Everything in Team',
      'SSO / SAML authentication',
      'Multi-tenant isolation',
      'On-premise deployment option',
      'Custom integrations & MCP',
      'SLA & dedicated support',
      'SOC 2 & ISO 27001 compliance',
      'Volume licensing',
    ],
    cta: 'Contact Sales',
    highlight: false,
    enterprise: true,
  },
];

export default function Pricing() {
  const [annual, setAnnual] = useState(true);

  return (
    <div className="bg-[var(--bg-dark)] text-[var(--text-main)] pt-24 pb-16 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} className="text-center mb-12">
          <h1 className="text-4xl sm:text-6xl font-display font-bold mb-4">Simple, Transparent Pricing</h1>
          <p className="text-[var(--text-muted)] text-lg max-w-2xl mx-auto">Start free. Scale when your data demands it.</p>
        </motion.div>

        <motion.div initial="hidden" animate="visible" variants={fadeUp} className="flex items-center justify-center gap-4 mb-16">
          <span className={`text-sm ${!annual ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'}`}>Monthly</span>
          <button onClick={() => setAnnual(!annual)}
            className={`relative w-12 h-6 rounded-full transition-colors duration-200 cursor-pointer ${annual ? 'bg-[var(--primary)]' : 'bg-white/20'}`}
            aria-label="Toggle billing period">
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-black transition-transform duration-200 ${annual ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
          <span className={`text-sm ${annual ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'}`}>
            Annual <span className="text-[var(--primary)] text-xs ml-1">Save 20%</span>
          </span>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan, i) => (
            <motion.div key={plan.name} initial="hidden" animate="visible" variants={fadeUp} transition={{ delay: i * 0.1 }}
              className={`relative rounded-2xl p-6 flex flex-col ${
                plan.highlight
                  ? 'border-2 border-[var(--primary)] bg-[var(--primary)]/5 shadow-[0_0_30px_rgba(13,231,242,0.1)]'
                  : 'glass-panel'
              }`}>
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-[var(--primary)] text-black text-xs font-bold rounded-full uppercase tracking-wider">
                  Most Popular
                </div>
              )}
              <div className="mb-4">
                {plan.icon && (
                  <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center mb-3">
                    <plan.icon size={20} className="text-[var(--primary)]" />
                  </div>
                )}
                <h3 className="text-xl font-semibold">{plan.name}</h3>
                <p className="text-[var(--text-muted)] text-sm mt-1">{plan.tagline}</p>
              </div>
              <div className="mb-6">
                {typeof plan.price.monthly === 'number' ? (
                  <>
                    <span className="text-4xl font-bold font-display">${annual ? plan.price.annual : plan.price.monthly}</span>
                    <span className="text-[var(--text-muted)] text-sm"> / month</span>
                    {annual && plan.savings && <p className="text-[var(--primary)] text-xs mt-1">Save ${plan.savings}/year</p>}
                  </>
                ) : (
                  <span className="text-4xl font-bold font-display">Custom</span>
                )}
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-[var(--text-muted)]">
                    <Check size={16} className="text-[var(--primary)] shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
              <Link to={plan.enterprise ? '/enterprise' : '/site/signup'}
                className={`block text-center py-3 rounded-xl font-semibold transition-all duration-200 cursor-pointer ${
                  plan.highlight
                    ? 'bg-[var(--primary)] text-black hover:shadow-[0_0_16px_rgba(13,231,242,0.4)]'
                    : 'bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20 hover:bg-[var(--primary)]/20'
                }`}>
                {plan.cta}
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Comparison note */}
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
          className="mt-16 text-center glass-panel rounded-2xl p-8 max-w-3xl mx-auto">
          <h3 className="text-lg font-semibold mb-2">All plans include</h3>
          <p className="text-[var(--text-muted)] text-sm">
            3D schema graph &bull; Table drill-down &bull; Foreign key visualization &bull; Schema export &bull; TLS encryption &bull; API access
          </p>
        </motion.div>
      </div>
    </div>
  );
}
