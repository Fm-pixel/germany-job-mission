import { z } from 'zod';
import { asUntrustedContent } from '@/lib/safe';
import { askJson } from './client';

export const ApplicationDraftSchema = z.object({
  subjectDe: z.string(),
  emailDe: z.string().describe('The complete German application email, ready to send.'),
  subjectEn: z.string(),
  emailEn: z.string().describe('The complete English application email.'),
  coverLetterDe: z.string().describe('A German Anschreiben in DIN-style business form.'),
  shortMessage: z.string().describe('A LinkedIn-style message, at most 4 sentences.'),
  needsInfo: z.array(z.string()).describe('Every fact that was missing and had to be marked [NEEDS INFO: …].'),
});

export type ApplicationDraft = z.infer<typeof ApplicationDraftSchema>;

const SYSTEM = `You write job applications for real people applying to real German employers.

Hard rules:
- Use only the facts given to you. Never invent an employer, a duration, a qualification, a language level or a reason.
- If something normally belongs in an application but you were not given it, write [NEEDS INFO: what is missing] in the text and list it in needsInfo. Never fill the gap with an invention.
- If the person's German level is below the level the advert asks for, say so honestly in the German email in one polite sentence, together with what they are doing about it. Never hide it.
- German emails: correct German business form ("Sehr geehrte Damen und Herren," … "Mit freundlichen Grüßen"), no exaggeration, no flattery, no emojis.
- The German Anschreiben follows DIN 5008 style: place and date line, subject line, salutation, three or four short paragraphs, closing.
- Never promise anything about a visa. If residence status is relevant, state the factual position (e.g. "Ich benötige ein Arbeitsvisum; die Einstellung wäre nach Erteilung möglich.") and nothing more.`;

export interface DraftInput {
  profileText: string;
  candidateName: string;
  candidateCountry: string;
  profession: string;
  jobTitle: string;
  employer: string;
  jobUrl: string;
  jobLocation?: string;
  jobText?: string;
  matchReasons: string[];
  warnings: string[];
  kind: 'application' | 'follow-up' | 'speculative';
  germanLevel: string;
  daysSinceApplied?: number;
}

export async function draftApplication(input: DraftInput): Promise<ApplicationDraft> {
  const task =
    input.kind === 'follow-up'
      ? `Write a SHORT, polite German follow-up (Nachfassen) for an application sent ${input.daysSinceApplied ?? 10} days ago, and an English version. Do not repeat the whole application; ask politely about the state of the process and confirm continued interest.`
      : input.kind === 'speculative'
        ? 'Write a speculative application (Initiativbewerbung) to this company — there is no advertised vacancy, so refer to the company itself and to what this person can do.'
        : 'Write the application for this advertised vacancy.';

  return askJson(
    ApplicationDraftSchema,
    `${task}

Subject line pattern for a normal application: "Bewerbung als <Beruf> – Berufserfahrung aus <Land>".

THE PERSON (these are the only facts you may use)
${input.profileText}

THE VACANCY / COMPANY
Employer: ${input.employer}
Position: ${input.jobTitle}
Location: ${input.jobLocation ?? 'not stated'}
Source link: ${input.jobUrl}
${input.jobText ? asUntrustedContent('untrusted-job-advert', input.jobText.slice(0, 10000)) : 'No advert text available.'}

WHY THIS MATCHES (from the matching engine)
${input.matchReasons.map((r) => `✓ ${r}`).join('\n') || '– none recorded –'}
${input.warnings.map((r) => `⚠ ${r}`).join('\n')}

The person's German level is: ${input.germanLevel}.`,
    { system: SYSTEM, maxTokens: 8000 },
  );
}
