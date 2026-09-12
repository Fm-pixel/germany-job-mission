'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PriorityDot } from '@/components/ui';

interface Row {
  id: string;
  title: string;
  detail?: string;
  priority: 'red' | 'orange' | 'green';
  due?: string;
  owner: string;
  link?: string;
  person: string | null;
}

export function TaskList({ tasks, readOnly = false }: { tasks: Row[]; readOnly?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function update(id: string, state: 'done' | 'open' | 'snoozed') {
    setBusy(id);
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, state, snoozeDays: 7 }),
    });
    setBusy(null);
    router.refresh();
  }

  return (
    <ul className="divide-y divide-slate-100">
      {tasks.map((task) => (
        <li key={task.id} className="flex items-start gap-3 py-3">
          <PriorityDot priority={task.priority} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-slate-900">{task.title}</div>
            {task.detail && <div className="text-sm text-slate-500">{task.detail}</div>}
            <div className="mt-0.5 text-xs text-slate-400">
              {[task.person, `owner: ${task.owner}`, task.due ? `due ${task.due}` : null]
                .filter(Boolean)
                .join(' · ')}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            {task.link && (
              <Link href={task.link} className="btn-secondary text-xs">
                Open
              </Link>
            )}
            {!readOnly && (
              <>
                <button className="btn-secondary text-xs" disabled={busy === task.id} onClick={() => update(task.id, 'snoozed')}>
                  Snooze 7d
                </button>
                <button className="btn-primary text-xs" disabled={busy === task.id} onClick={() => update(task.id, 'done')}>
                  Done
                </button>
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
