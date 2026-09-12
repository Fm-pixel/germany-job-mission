import { Card, Empty } from '@/components/ui';
import { db } from '@/services/db';
import { getPolicy } from '@/services/policy';
import { syncTasks } from '@/services/tracking';
import { TaskList } from './list';

export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const policy = await getPolicy();
  await syncTasks(policy.followUpDays);
  const [tasks, candidates] = await Promise.all([db.list('tasks', { limit: 500 }), db.list('candidates')]);
  const nameOf = new Map(candidates.map((c) => [c.id, c.name]));

  const open = tasks.filter((t) => t.state === 'open');
  const snoozed = tasks.filter((t) => t.state === 'snoozed');
  const done = tasks.filter((t) => t.state === 'done').slice(0, 20);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
        <p className="mt-1 text-sm text-slate-500">Computed from your data, plus anything you add yourself.</p>
      </header>

      <Card title={`Open (${open.length})`}>
        {open.length === 0 ? <Empty>Nothing open.</Empty> : <TaskList tasks={serialise(open, nameOf)} />}
      </Card>
      <Card title={`Snoozed (${snoozed.length})`}>
        {snoozed.length === 0 ? <Empty>Nothing snoozed.</Empty> : <TaskList tasks={serialise(snoozed, nameOf)} />}
      </Card>
      <Card title="Recently done">
        {done.length === 0 ? <Empty>Nothing yet.</Empty> : <TaskList tasks={serialise(done, nameOf)} readOnly />}
      </Card>
    </div>
  );
}

function serialise(
  tasks: Awaited<ReturnType<typeof db.list<'tasks'>>>,
  nameOf: Map<string, string>,
) {
  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    detail: task.detail,
    priority: task.priority,
    due: task.due,
    owner: task.owner,
    link: task.link,
    person: task.candidateId ? (nameOf.get(task.candidateId) ?? null) : null,
  }));
}
