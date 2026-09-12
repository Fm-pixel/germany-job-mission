import { Card } from '@/components/ui';
import { NewPersonForm } from './form';

export default function NewPersonPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Add a person</h1>
        <p className="mt-1 text-sm text-slate-500">
          Only add someone who knows about it and agreed. Three fields are enough to start — the rest can come from
          their CV.
        </p>
      </header>
      <Card>
        <NewPersonForm />
      </Card>
    </div>
  );
}
