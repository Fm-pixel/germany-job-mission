import { z } from 'zod';
import { db } from '../db';
import { aiAvailable, askJson } from '../ai/client';
import { asUntrustedContent } from '@/lib/safe';
import { fetchOfficialPage } from './official-sources';
import { NOT_LEGAL_ADVICE } from './pathways';

/**
 * Recognition assistant (SPEC section 14 / BUILD_PLAN prompt 16a).
 * Everything is LIKELY unless the official page states it.
 */

const PORTAL = 'https://www.anerkennung-in-deutschland.de/html/en/index.php';

export const RecognitionSchema = z.object({
  regulated: z.enum(['yes', 'no', 'unclear']).describe('Is the profession regulated in Germany, per the page?'),
  regulatedNote: z.string(),
  likelyAuthority: z.string().describe('The competent authority named by the page, or "" if it names none.'),
  documents: z.array(z.string()).describe('Documents the page says are needed. Empty if the page does not say.'),
  procedure: z.string().describe('What the page says the procedure is, in two or three sentences.'),
  quotes: z.array(z.string()).describe('Short quotes from the page that support the answers above.'),
});

export type RecognitionResult = z.infer<typeof RecognitionSchema> & {
  sourceUrl: string;
  checkedAt: string;
  label: 'LIKELY-NEEDS-CONFIRMATION';
  disclaimer: string;
};

export async function assessRecognition(input: {
  candidateId: string;
  profession: string;
  qualification: string;
  issuingCountry: string;
}): Promise<RecognitionResult> {
  if (!aiAvailable()) {
    throw Object.assign(
      new Error(
        `Reading the official recognition portal needs the Anthropic API (NOT CONNECTED). Check it by hand: ${PORTAL}`,
      ),
      { code: 'AI_NOT_CONNECTED' },
    );
  }
  const page = await fetchOfficialPage(PORTAL);
  const result = await askJson(
    RecognitionSchema,
    `Official page: ${PORTAL}

${asUntrustedContent('untrusted-official-page', page.text.slice(0, 40000))}

Question: for the profession "${input.profession}" with the qualification "${input.qualification}" obtained in ${input.issuingCountry} — what does THIS PAGE say about whether the profession is regulated, which authority is competent, which documents are needed and how the procedure runs?

Answer only from this page. Where the page does not answer, say so ("unclear", empty list, empty string). Never fill in an authority or a document list from your own knowledge.`,
    { maxTokens: 3000 },
  );

  await db.create('sources', {
    topic: `Recognition: ${input.profession} (${input.issuingCountry})`,
    url: PORTAL,
    checkedAt: new Date().toISOString(),
    summary: result.procedure.slice(0, 400),
  });

  return {
    ...result,
    sourceUrl: PORTAL,
    checkedAt: new Date().toISOString(),
    label: 'LIKELY-NEEDS-CONFIRMATION',
    disclaimer: `${NOT_LEGAL_ADVICE} The exact competent authority depends on the federal state and the profession; confirm it with the "Anerkennungs-Finder" on the official portal.`,
  };
}
