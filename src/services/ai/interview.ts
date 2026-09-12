import { z } from 'zod';
import { asUntrustedContent } from '@/lib/safe';
import { askJson } from './client';

export const InterviewPackSchema = z.object({
  questions: z.array(
    z.object({
      de: z.string(),
      en: z.string(),
      suggestedAnswer: z
        .string()
        .describe('An answer built ONLY from this person\'s real experience. Use [NEEDS INFO: …] where a fact is missing.'),
    }),
  ),
  vocabulary: z.array(z.object({ de: z.string(), en: z.string() })),
  questionsToAsk: z.array(z.string()),
  howGermanInterviewsWork: z.string().describe('Four or five plain sentences.'),
});

export type InterviewPack = z.infer<typeof InterviewPackSchema>;

const SYSTEM = `You prepare a person for a real job interview with a German employer.

- Every suggested answer must be built only from the experience actually given to you. If an answer would need a fact you were not given, write [NEEDS INFO: …] in it. Never invent projects, employers, numbers or certificates.
- Questions come from the real job advert.
- The vocabulary is the technical German the person will actually hear in this job.
- Never promise anything about a visa or about being hired.`;

export async function buildInterviewPack(input: {
  profileText: string;
  jobTitle: string;
  employer: string;
  jobText?: string;
  germanLevel: string;
}): Promise<InterviewPack> {
  return askJson(
    InterviewPackSchema,
    `Prepare the interview for this person and this vacancy.

PERSON
${input.profileText}

VACANCY
${input.employer} — ${input.jobTitle}
${input.jobText ? asUntrustedContent('untrusted-job-advert', input.jobText.slice(0, 10000)) : 'No advert text available.'}

The person's German level is ${input.germanLevel}: write the German questions at a level they can follow, and keep the vocabulary list practical.

Give 8 to 12 likely questions, 15 to 25 vocabulary pairs, and 5 questions the candidate should ask the employer.`,
    { system: SYSTEM, maxTokens: 8000 },
  );
}
