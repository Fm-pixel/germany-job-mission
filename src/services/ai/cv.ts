import { z } from 'zod';
import { askJson, pdfBlock, textBlock, type UserContent } from './client';
import type { LanguageLevel } from '../db';

const Confidence = z.enum(['high', 'medium', 'low']);

const FieldString = z.object({
  value: z.string(),
  confidence: Confidence,
  evidence: z.string().describe('The words in the CV this came from, or "" when nothing supports it.'),
});

const FieldNumber = z.object({
  value: z.number(),
  confidence: Confidence,
  evidence: z.string(),
});

export const CvExtractionSchema = z.object({
  profession: FieldString,
  yearsExperience: FieldNumber,
  qualificationLevel: z.object({
    value: z.enum(['none', 'vocational', 'academic', 'other']),
    confidence: Confidence,
    evidence: z.string(),
  }),
  summary: z.string().describe('Two neutral sentences about this person, strictly from the CV.'),
  skills: z.array(z.string()),
  industries: z.array(z.string()),
  jobTitles: z.array(z.string()),
  languages: z.array(
    z.object({
      language: z.string(),
      level: z.enum(['none', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'native', 'unclear']),
      confidence: Confidence,
      evidence: z.string(),
    }),
  ),
  education: z.array(
    z.object({
      school: z.string(),
      degree: z.string(),
      field: z.string(),
      country: z.string(),
      graduationYear: z.number().nullable(),
      level: z.enum(['school', 'vocational', 'bachelor', 'master', 'doctorate', 'other']),
      confidence: Confidence,
    }),
  ),
  certificates: z.array(
    z.object({
      title: z.string(),
      issuer: z.string(),
      country: z.string(),
      year: z.number().nullable(),
      type: z.enum(['vocational', 'academic', 'certificate', 'other']),
      confidence: Confidence,
    }),
  ),
  workExperience: z.array(
    z.object({
      employer: z.string(),
      title: z.string(),
      from: z.string(),
      to: z.string(),
      country: z.string(),
      description: z.string(),
      confidence: Confidence,
    }),
  ),
  unclear: z.array(z.string()).describe('Everything the CV does not say clearly. Be generous here.'),
});

export type CvExtraction = z.infer<typeof CvExtractionSchema>;

const SYSTEM = `You read a CV and turn it into structured data for a job-matching tool.

You must not invent anything. Rules you follow literally:
- Only write down what the document actually says. Empty string or an empty list is the correct answer when the CV is silent.
- "confidence" is "low" whenever you are guessing or inferring; "high" only when the CV states it plainly.
- "evidence" quotes the words from the CV that support the value. If you cannot quote anything, the confidence is "low" and the evidence is "".
- Language levels: use the CEFR level only if the CV names one (A1–C2) or names a certificate that maps to one. "Good English" without a level is "unclear".
- Years of experience: count only from dated positions. If the dates are missing or ambiguous, use 0 with confidence "low".
- Put every uncertainty into "unclear" as a short sentence, e.g. "The CV does not say which year the electrician training was completed."`;

export async function extractCv(input: {
  pdf?: Buffer;
  text?: string;
  filename: string;
}): Promise<CvExtraction> {
  const content: UserContent = [];
  if (input.pdf) content.push(pdfBlock(input.pdf));
  if (input.text) content.push(textBlock(`CV text of the file "${input.filename}":\n\n${input.text.slice(0, 60000)}`));
  content.push(
    textBlock(
      'Extract the structured profile from this CV following the rules exactly. Do not add anything that is not written in it.',
    ),
  );
  return askJson(CvExtractionSchema, content, { system: SYSTEM, maxTokens: 8000 });
}

export function levelFromExtraction(level: string): LanguageLevel | null {
  const allowed: LanguageLevel[] = ['none', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'native'];
  return (allowed as string[]).includes(level) ? (level as LanguageLevel) : null;
}

/** Everything the AI was unsure about becomes a yellow "Needs confirmation" item. */
export function needsConfirmationFrom(extraction: CvExtraction): { field: string; value: string; reason: string }[] {
  const items: { field: string; value: string; reason: string }[] = [];
  const push = (field: string, value: string, confidence: string, evidence: string) => {
    if (confidence === 'high' && evidence.trim() !== '') return;
    items.push({
      field,
      value,
      reason: evidence.trim() === '' ? 'Nothing in the CV supports this.' : `Only weakly supported: "${evidence.slice(0, 120)}"`,
    });
  };

  push('Profession', extraction.profession.value, extraction.profession.confidence, extraction.profession.evidence);
  push(
    'Years of experience',
    String(extraction.yearsExperience.value),
    extraction.yearsExperience.confidence,
    extraction.yearsExperience.evidence,
  );
  push(
    'Qualification level',
    extraction.qualificationLevel.value,
    extraction.qualificationLevel.confidence,
    extraction.qualificationLevel.evidence,
  );
  for (const lang of extraction.languages) {
    if (lang.level === 'unclear' || lang.confidence !== 'high') {
      items.push({
        field: `Language: ${lang.language}`,
        value: lang.level,
        reason:
          lang.level === 'unclear'
            ? 'The CV describes the level in words, not as an official level (A1–C2).'
            : `Only weakly supported: "${lang.evidence.slice(0, 120)}"`,
      });
    }
  }
  for (const note of extraction.unclear) {
    items.push({ field: 'Open question', value: '', reason: note });
  }
  return items;
}
