import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Database } from 'lucide-react';

const navLinks = [
  { label: 'Features', href: '/features' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'FAQs', href: '/faqs' },
  { label: 'Enterprise', href: '/enterprise' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[var(--bg-dark)]/90 backdrop-blur-xl border-b border-[var(--glass-border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/site" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] flex items-center justify-center shadow-[0_0_12px_rgba(13,231,242,0.3)]">
              <Database size={14} className="text-black" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[var(--text-main)] font-display font-semibold text-sm">Living Data</span>
              <span className="text-[var(--primary)] text-[9px] font-mono tracking-wider uppercase">Intelligence</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map(l => (
              <Link key={l.href} to={l.href}
                className={`text-sm font-medium transition-colors duration-200 cursor-pointer relative py-1 ${
                  location.pathname === l.href
                    ? 'text-[var(--primary)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}>
                {l.label}
                {location.pathname === l.href && (
                  <span className="absolute -bottom-[18px] left-0 w-full h-[2px] bg-[var(--primary)] shadow-[0_0_8px_var(--primary)]" />
                )}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/site/login" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer">Log in</Link>
            <Link to="/site/signup" className="px-4 py-2 bg-[var(--primary)] text-black text-sm font-semibold rounded-lg hover:shadow-[0_0_16px_rgba(13,231,242,0.4)] transition-all duration-200 cursor-pointer">
              Start Free
            </Link>
          </div>

          <button onClick={() => setOpen(!open)} className="md:hidden text-[var(--text-main)] cursor-pointer" aria-label="Toggle menu">
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden glass-panel px-4 py-4 space-y-3">
          {navLinks.map(l => (
            <Link key={l.href} to={l.href} onClick={() => setOpen(false)}
              className="block text-[var(--text-muted)] hover:text-[var(--primary)] py-2 cursor-pointer">{l.label}</Link>
          ))}
          <div className="pt-3 border-t border-[var(--glass-border)] space-y-2">
            <Link to="/site/login" onClick={() => setOpen(false)} className="block text-[var(--text-muted)] hover:text-[var(--text-main)] py-2 cursor-pointer">Log in</Link>
            <Link to="/site/signup" onClick={() => setOpen(false)} className="block bg-[var(--primary)] text-black text-center py-2 rounded-lg font-semibold cursor-pointer">Start Free</Link>
          </div>
        </div>
      )}
    </nav>
  );
}
