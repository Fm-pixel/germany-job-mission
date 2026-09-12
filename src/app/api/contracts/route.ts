import { guard } from '@/lib/api';
import { db } from '@/services/db';
import { aiAvailable } from '@/services/ai/client';
import { extractText, isPdf, readDocument } from '@/services/documents';
import { analyseContract, CONTRACT_DISCLAIMER } from '@/services/ai/contract';
import { logAudit } from '@/services/tracking/audit';

export async function POST(request: Request) {
  return guard(async () => {
    const { candidateId, documentId, applicationId, kind } = (await request.json()) as {
      candidateId?: string;
      documentId?: string;
      applicationId?: string;
      kind?: 'offer' | 'contract';
    };
    if (!candidateId || !documentId) throw new Error('Person and document are both needed.');
    if (!aiAvailable()) {
      throw Object.assign(
        new Error('Reading the contract needs the Anthropic API (NOT CONNECTED — SETUP_FOR_ME.md step 3).'),
        { code: 'AI_NOT_CONNECTED' },
      );
    }
    const doc = await db.get('documents', documentId);
    if (!doc || doc.candidateId !== candidateId) throw new Error('Document not found for this person.');
    const body = await readDocument(documentId);
    const text = await extractText(doc, body);
    if (!isPdf(doc) && !text) throw new Error('Upload the contract as a PDF or DOCX so its text can be read.');

    const extraction = await analyseContract({
      pdf: isPdf(doc) ? body : undefined,
      text: text ?? undefined,
      filename: doc.filename,
    });

    const collection = kind === 'offer' ? 'offers' : 'contracts';
    const record = await db.create(collection, {
      candidateId,
      applicationId,
      documentId,
      kind: kind ?? 'contract',
      employer: extraction.employer || undefined,
      jobTitle: extraction.jobTitle || undefined,
      grossSalary: extraction.grossSalary || undefined,
      grossSalaryPerYearEur: extraction.grossSalaryPerYearEur || undefined,
      hoursPerWeek: extraction.hoursPerWeek || undefined,
      location: extraction.location || undefined,
      duration: extraction.duration || undefined,
      startDate: extraction.startDate || undefined,
      probation: extraction.probation || undefined,
      noticePeriod: extraction.noticePeriod || undefined,
      otherTerms: extraction.otherTerms,
      pointsToVerify: [...extraction.pointsToVerify, ...extraction.missing.map((m) => `Not in the document: ${m}`)],
      extractedAt: new Date().toISOString(),
    });

    if (applicationId) {
      const application = await db.get('applications', applicationId);
      if (application) {
        await db.update('applications', applicationId, {
          status: kind === 'offer' ? 'Offer' : 'Contract',
          statusHistory: [
            ...application.statusHistory,
            {
              status: kind === 'offer' ? ('Offer' as const) : ('Contract' as const),
              at: new Date().toISOString(),
              by: 'me' as const,
              note: 'Document uploaded and read.',
            },
          ],
        });
      }
    }

    await logAudit({
      who: 'me',
      what: `Read a ${kind ?? 'contract'} from ${extraction.employer || 'an employer'}`,
      why: 'Contract stage',
      candidateId,
      applicationId,
    });

    return { record, disclaimer: CONTRACT_DISCLAIMER };
  });
}
