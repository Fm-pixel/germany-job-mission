'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const LINKS = [
  { href: '/', label: 'Dashboard', icon: '◎' },
  { href: '/inbox', label: 'Needs you', icon: '★' },
  { href: '/people', label: 'People', icon: '👤' },
  { href: '/jobs', label: 'Jobs', icon: '🔎' },
  { href: '/applications', label: 'Applications', icon: '✉' },
  { href: '/companies', label: 'Companies', icon: '🏢' },
  { href: '/opportunities', label: 'Opportunity Radar', icon: '🛰' },
  { href: '/tasks', label: 'Tasks', icon: '✓' },
  { href: '/agent', label: 'Ask the agent', icon: '💬' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
];

export function Sidebar({ email }: { email?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <>
      <button
        type="button"
        aria-label="Open the menu"
        onClick={() => setOpen((v) => !v)}
        className="fixed left-3 top-3 z-40 rounded-lg bg-ink-950 px-3 py-2 text-white lg:hidden"
      >
        ☰
      </button>
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-ink-950 text-slate-200 transition-transform lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="px-5 pb-4 pt-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-300">
              My Germany
            </div>
            <div className="text-lg font-semibold text-white">Job Mission</div>
          </div>
          <nav className="flex-1 space-y-0.5 px-3">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                  isActive(link.href)
                    ? 'bg-ink-800 font-medium text-white'
                    : 'text-slate-300 hover:bg-ink-900 hover:text-white'
                }`}
              >
                <span aria-hidden className="w-4 text-center opacity-80">
                  {link.icon}
                </span>
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="border-t border-ink-800 px-5 py-4 text-xs text-slate-400">
            <div className="truncate">{email ?? 'signed in'}</div>
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="mt-2 text-slate-300 underline hover:text-white">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/30 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}
    </>
  );
}
