'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { slug: '', label: 'Journey' },
  { slug: 'profile', label: 'Profile' },
  { slug: 'documents', label: 'Documents & CV' },
  { slug: 'matches', label: 'Matches' },
  { slug: 'applications', label: 'Applications' },
  { slug: 'interviews', label: 'Interviews' },
  { slug: 'immigration', label: 'Immigration' },
  { slug: 'doors', label: 'Other doors' },
  { slug: 'track-b', label: 'Track B' },
];

export function PersonTabs({ id }: { id: string }) {
  const pathname = usePathname();
  const base = `/people/${id}`;
  return (
    <nav className="mt-4 flex flex-wrap gap-1 border-t border-slate-100 pt-3">
      {TABS.map((tab) => {
        const href = tab.slug ? `${base}/${tab.slug}` : base;
        const active = pathname === href;
        return (
          <Link
            key={tab.slug}
            href={href}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              active ? 'bg-accent-50 font-medium text-accent-700' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
