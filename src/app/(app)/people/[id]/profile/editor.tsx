'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui';
import type {
  Candidate,
  CandidateProfile,
  Education,
  LanguageSkill,
  Qualification,
  WorkExperience,
} from '@/services/db/types';

const LEVELS = ['none', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'native'];

type Rows<T> = (Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'candidateId'> & { id?: string })[];

export function ProfileEditor({
  candidateId,
  initial,
}: {
  candidateId: string;
  initial: {
    candidate: Candidate;
    profile: CandidateProfile | null;
    languages: LanguageSkill[];
    education: Education[];
    qualifications: Qualification[];
    workExperience: WorkExperience[];
  };
}) {
  const router = useRouter();
  const [candidate, setCandidate] = useState(initial.candidate);
  const [profile, setProfile] = useState({
    profession: initial.profile?.profession ?? '',
    yearsExperience: initial.profile?.yearsExperience ?? 0,
    qualificationLevel: initial.profile?.qualificationLevel ?? 'none',
    skills: (initial.profile?.skills ?? []).join(', '),
    industries: (initial.profile?.industries ?? []).join(', '),
    jobTitles: (initial.profile?.jobTitles ?? []).join(', '),
    summary: initial.profile?.summary ?? '',
  });
  const [languages, setLanguages] = useState<Rows<LanguageSkill>>(
    initial.languages.length
      ? initial.languages
      : [
          { language: 'German', level: 'none' },
          { language: 'English', level: 'none' },
        ],
  );
  const [education, setEducation] = useState<Rows<Education>>(initial.education);
  const [qualifications, setQualifications] = useState<Rows<Qualification>>(initial.qualifications);
  const [experience, setExperience] = useState<Rows<WorkExperience>>(initial.workExperience);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate: {
            name: candidate.name,
            country: candidate.country,
            city: candidate.city,
            email: candidate.email,
            phone: candidate.phone,
            birthYear: candidate.birthYear,
            profession: candidate.profession,
            track: candidate.track,
            status: candidate.status,
            relocate: candidate.relocate,
            preferredOccupation: candidate.preferredOccupation,
            preferredCities: candidate.preferredCities,
            preferredStates: candidate.preferredStates,
            workingTime: candidate.workingTime,
            salaryExpectation: candidate.salaryExpectation,
            earliestAvailability: candidate.earliestAvailability,
          },
          profile: {
            profession: profile.profession || undefined,
            yearsExperience: Number(profile.yearsExperience) || 0,
            qualificationLevel: profile.qualificationLevel,
            summary: profile.summary || undefined,
            skills: splitList(profile.skills),
            industries: splitList(profile.industries),
            jobTitles: splitList(profile.jobTitles),
          },
          languages,
          education,
          qualifications,
          workExperience: experience,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Could not save.');
      setStatus('Saved.');
      router.refresh();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card title="Personal">
        <div className="grid gap-4 sm:grid-cols-2">
          <Text label="Name" value={candidate.name} onChange={(v) => setCandidate({ ...candidate, name: v })} />
          <Text label="Country" value={candidate.country} onChange={(v) => setCandidate({ ...candidate, country: v })} />
          <Text label="City" value={candidate.city ?? ''} onChange={(v) => setCandidate({ ...candidate, city: v })} />
          <Text label="Email" value={candidate.email ?? ''} onChange={(v) => setCandidate({ ...candidate, email: v })} />
          <Text label="Phone" value={candidate.phone ?? ''} onChange={(v) => setCandidate({ ...candidate, phone: v })} />
          <Text
            label="Year of birth"
            value={candidate.birthYear ? String(candidate.birthYear) : ''}
            onChange={(v) => setCandidate({ ...candidate, birthYear: v ? Number(v) : undefined })}
          />
        </div>
      </Card>

      <Card title="Professional">
        <div className="grid gap-4 sm:grid-cols-2">
          <Text label="Current profession" value={profile.profession} onChange={(v) => setProfile({ ...profile, profession: v })} />
          <Text
            label="Years of experience"
            value={String(profile.yearsExperience)}
            onChange={(v) => setProfile({ ...profile, yearsExperience: Number(v) || 0 })}
          />
          <Select
            label="Qualification level"
            value={profile.qualificationLevel}
            options={['none', 'vocational', 'academic', 'other']}
            onChange={(v) => setProfile({ ...profile, qualificationLevel: v as typeof profile.qualificationLevel })}
          />
          <Select
            label="Track"
            value={candidate.track}
            options={['unknown', 'A-skilled', 'B-apprenticeship']}
            onChange={(v) => setCandidate({ ...candidate, track: v as Candidate['track'] })}
          />
          <Text label="Skills (comma separated)" value={profile.skills} onChange={(v) => setProfile({ ...profile, skills: v })} />
          <Text label="Industries" value={profile.industries} onChange={(v) => setProfile({ ...profile, industries: v })} />
          <Text label="Job titles" value={profile.jobTitles} onChange={(v) => setProfile({ ...profile, jobTitles: v })} />
        </div>
      </Card>

      <Card title="Languages">
        <RowEditor
          rows={languages}
          onChange={setLanguages}
          blank={{ language: '', level: 'none' } as Rows<LanguageSkill>[number]}
          columns={[
            { key: 'language', label: 'Language' },
            { key: 'level', label: 'Level', options: LEVELS },
            { key: 'certificate', label: 'Certificate' },
          ]}
        />
      </Card>

      <Card title="Education">
        <RowEditor
          rows={education}
          onChange={setEducation}
          blank={{ school: '', level: 'school' } as Rows<Education>[number]}
          columns={[
            { key: 'school', label: 'School / university' },
            { key: 'degree', label: 'Degree' },
            { key: 'field', label: 'Field' },
            { key: 'country', label: 'Country' },
            { key: 'graduationYear', label: 'Year', numeric: true },
            { key: 'level', label: 'Level', options: ['school', 'vocational', 'bachelor', 'master', 'doctorate', 'other'] },
          ]}
        />
      </Card>

      <Card title="Qualifications & certificates">
        <RowEditor
          rows={qualifications}
          onChange={setQualifications}
          blank={{ title: '', type: 'certificate' } as Rows<Qualification>[number]}
          columns={[
            { key: 'title', label: 'Title' },
            { key: 'issuer', label: 'Issued by' },
            { key: 'country', label: 'Country' },
            { key: 'year', label: 'Year', numeric: true },
            { key: 'type', label: 'Type', options: ['vocational', 'academic', 'certificate', 'other'] },
          ]}
        />
      </Card>

      <Card title="Work experience">
        <RowEditor
          rows={experience}
          onChange={setExperience}
          blank={{ employer: '', title: '' } as Rows<WorkExperience>[number]}
          columns={[
            { key: 'employer', label: 'Employer' },
            { key: 'title', label: 'Position' },
            { key: 'from', label: 'From' },
            { key: 'to', label: 'To' },
            { key: 'country', label: 'Country' },
          ]}
        />
      </Card>

      <Card title="Germany preferences">
        <div className="grid gap-4 sm:grid-cols-2">
          <Text
            label="Preferred occupation (used for the job search)"
            value={candidate.preferredOccupation ?? ''}
            onChange={(v) => setCandidate({ ...candidate, preferredOccupation: v })}
          />
          <Text
            label="Preferred cities (comma separated)"
            value={(candidate.preferredCities ?? []).join(', ')}
            onChange={(v) => setCandidate({ ...candidate, preferredCities: splitList(v) })}
          />
          <Text
            label="Preferred states"
            value={(candidate.preferredStates ?? []).join(', ')}
            onChange={(v) => setCandidate({ ...candidate, preferredStates: splitList(v) })}
          />
          <Select
            label="Working time"
            value={candidate.workingTime ?? 'either'}
            options={['either', 'full-time', 'part-time']}
            onChange={(v) => setCandidate({ ...candidate, workingTime: v as Candidate['workingTime'] })}
          />
          <Text
            label="Salary expectation"
            value={candidate.salaryExpectation ?? ''}
            onChange={(v) => setCandidate({ ...candidate, salaryExpectation: v })}
          />
          <Text
            label="Earliest availability"
            value={candidate.earliestAvailability ?? ''}
            onChange={(v) => setCandidate({ ...candidate, earliestAvailability: v })}
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={candidate.relocate ?? false}
              onChange={(e) => setCandidate({ ...candidate, relocate: e.target.checked })}
            />
            Willing to relocate anywhere in Germany
          </label>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Save profile'}
        </button>
        {status && <span className="text-sm text-slate-600">{status}</span>}
      </div>
    </div>
  );
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function Text({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

interface Column {
  key: string;
  label: string;
  options?: string[];
  numeric?: boolean;
}

function RowEditor<T extends Record<string, unknown>>({
  rows,
  onChange,
  columns,
  blank,
}: {
  rows: T[];
  onChange: (rows: T[]) => void;
  columns: Column[];
  blank: T;
}) {
  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div key={index} className="grid gap-2 sm:grid-cols-6">
          {columns.map((column) => (
            <div key={column.key} className="sm:col-span-1">
              <label className="text-[11px] uppercase tracking-wide text-slate-400">{column.label}</label>
              {column.options ? (
                <select
                  className="input"
                  value={String(row[column.key] ?? column.options[0])}
                  onChange={(e) => {
                    const next = [...rows];
                    next[index] = { ...row, [column.key]: e.target.value };
                    onChange(next);
                  }}
                >
                  {column.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="input"
                  value={String(row[column.key] ?? '')}
                  onChange={(e) => {
                    const next = [...rows];
                    const value = column.numeric ? Number(e.target.value) || undefined : e.target.value;
                    next[index] = { ...row, [column.key]: value };
                    onChange(next);
                  }}
                />
              )}
            </div>
          ))}
          <div className="flex items-end">
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={() => onChange(rows.filter((_, i) => i !== index))}
            >
              Remove
            </button>
          </div>
        </div>
      ))}
      <button type="button" className="btn-secondary text-xs" onClick={() => onChange([...rows, { ...blank }])}>
        + Add row
      </button>
    </div>
  );
}
