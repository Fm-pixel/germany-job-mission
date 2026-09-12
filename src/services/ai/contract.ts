import { z } from 'zod';
import { askJson, pdfBlock, textBlock, type UserContent } from './client';

export const ContractExtractionSchema = z.object({
  employer: z.string(),
  jobTitle: z.string(),
  grossSalary: z.string().describe('Exactly as written in the document, including the period (per month / per year).'),
  grossSalaryPerYearEur: z
    .number()
    .describe('The gross annual amount in euro if the document allows the calculation, otherwise 0.'),
  hoursPerWeek: z.number().describe('0 if the document does not say.'),
  location: z.string(),
  duration: z.string().describe('Fixed term or unlimited, as written.'),
  startDate: z.string(),
  probation: z.string(),
  noticePeriod: z.string(),
  otherTerms: z.array(z.string()),
  pointsToVerify: z
    .array(z.string())
    .describe('Plain-language points the person should check or ask about, each one tied to the document.'),
  missing: z.array(z.string()).describe('Important things the document does NOT contain.'),
});

export type ContractExtraction = z.infer<typeof ContractExtractionSchema>;

const SYSTEM = `You read an employment contract or job offer and list what it says.

- Write only what is in the document. Where it is silent, use "" (or 0) and add the point to "missing".
- You are NOT a lawyer. Do not say whether the contract is valid, fair or legal. Do not advise on legal consequences.
- "pointsToVerify" are neutral, practical checks ("The contract does not name the notice period — ask the employer to add it"), never legal opinions.`;

export const CONTRACT_DISCLAIMER =
  'This is a summary of what the document says. It is not legal advice and says nothing about whether the contract is valid or fair. Have anything important checked by a lawyer or an advice centre before signing.';

export async function analyseContract(input: {
  pdf?: Buffer;
  text?: string;
  filename: string;
}): Promise<ContractExtraction> {
  const content: UserContent = [];
  if (input.pdf) content.push(pdfBlock(input.pdf));
  if (input.text) content.push(textBlock(`Contract text from "${input.filename}":\n\n${input.text.slice(0, 60000)}`));
  content.push(textBlock('List what this document says, following the rules exactly.'));
  return askJson(ContractExtractionSchema, content, { system: SYSTEM, maxTokens: 6000 });
}
