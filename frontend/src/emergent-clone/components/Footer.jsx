import React from 'react';
import { Link } from 'react-router-dom';
import { Database } from 'lucide-react';

const footerSections = [
  { title: 'Platform', links: [{ label: '3D Schema Graph', href: '/features' }, { label: 'APEX AI Agent', href: '/features' }, { label: 'Latent Space', href: '/features' }, { label: 'Pricing', href: '/pricing' }] },
  { title: 'Solutions', links: [{ label: 'Enterprise', href: '/enterprise' }, { label: 'Data Teams', href: '/enterprise' }, { label: 'Engineering', href: '/enterprise' }, { label: 'Analytics', href: '/enterprise' }] },
  { title: 'Resources', links: [{ label: 'Documentation', href: '#' }, { label: 'API Reference', href: '#' }, { label: 'Case Studies', href: '#' }, { label: 'Blog', href: '#' }] },
  { title: 'Company', links: [{ label: 'About', href: '#' }, { label: 'Careers', href: '#' }, { label: 'Privacy Policy', href: '#' }, { label: 'Terms of Service', href: '#' }] },
];

const socialLinks = [
  { label: 'LinkedIn', icon: 'M4.98 3.5c0 1.381-1.11 2.5-2.48 2.5s-2.48-1.119-2.48-2.5c0-1.38 1.11-2.5 2.48-2.5s2.48 1.12 2.48 2.5zM.02 24h4.96V7.99H.02V24zM7.54 8.01h4.76v2.19h.07c.66-1.26 2.28-2.59 4.7-2.59 5.02 0 5.95 3.31 5.95 7.61V24h-4.97v-7.78c0-1.86-.03-4.24-2.58-4.24-2.59 0-2.98 2.02-2.98 4.1V24H7.54V8.01z' },
  { label: 'X', icon: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z' },
  { label: 'GitHub', icon: 'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12' },
];

export default function Footer() {
  return (
    <footer className="bg-[var(--bg-dark)] border-t border-[var(--glass-border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link to="/site" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] flex items-center justify-center shadow-[0_0_12px_rgba(13,231,242,0.3)]">
                <Database size={14} className="text-black" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-[var(--text-main)] font-display font-semibold text-sm">Living Data</span>
                <span className="text-[var(--primary)] text-[9px] font-mono tracking-wider uppercase">Intelligence</span>
              </div>
            </Link>
            <p className="text-[var(--text-muted)] text-sm leading-relaxed mb-6">
              See your database think. 3D schema visualization, AI-powered analytics, and real-time intelligence.
            </p>
            <div className="flex gap-3">
              {socialLinks.map(s => (
                <a key={s.label} href="#" aria-label={s.label} className="w-8 h-8 rounded-full bg-[var(--primary)]/5 hover:bg-[var(--primary)]/15 flex items-center justify-center transition-colors cursor-pointer border border-[var(--glass-border)]">
                  <svg className="w-4 h-4 text-[var(--text-muted)]" viewBox="0 0 24 24" fill="currentColor"><path d={s.icon} /></svg>
                </a>
              ))}
            </div>
          </div>
          {footerSections.map(s => (
            <div key={s.title}>
              <h4 className="text-[var(--primary)] font-medium text-[11px] mb-4 uppercase tracking-widest">{s.title}</h4>
              <ul className="space-y-2">
                {s.links.map(l => (
                  <li key={l.label}><Link to={l.href} className="text-[var(--text-muted)] hover:text-[var(--text-main)] text-sm transition-colors cursor-pointer">{l.label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 pt-8 border-t border-[var(--glass-border)] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[var(--text-muted)] text-sm">Copyright &copy; Living Data Intelligence 2026.</p>
          <div className="flex gap-4">
            <span className="text-xs text-[var(--primary)] border border-[var(--primary)]/30 rounded px-2 py-1 font-mono">SOC 2</span>
            <span className="text-xs text-[var(--primary)] border border-[var(--primary)]/30 rounded px-2 py-1 font-mono">ISO 27001</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
