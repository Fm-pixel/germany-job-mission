import { guard } from '@/lib/api';
import { db } from '@/services/db';
import { aiAvailable } from '@/services/ai/client';
import { draftApplication } from '@/services/ai/application';
import { candidateContext, candidateProfileText, languageOf } from '@/services/matching';
import { upsertMessage } from '@/services/applications';
import { logAudit } from '@/services/tracking/audit';

/** Speculative application (Initiativbewerbung) — goes into the same review queue. */
export async function POST(request: Request) {
  return guard(async () => {
    const { candidateId, companyId } = (await request.json()) as {
      candidateId?: string;
      companyId?: string;
    };
    if (!candidateId || !companyId) throw new Error('Person and company are both needed.');
    if (!aiAvailable()) {
      throw Object.assign(new Error('Writing needs the Anthropic API (NOT CONNECTED, see SETUP_FOR_ME.md step 3).'), {
        code: 'AI_NOT_CONNECTED',
      });
    }
    const company = await db.get('companies', companyId);
    if (!company) throw new Error('Company not found.');
    if (company.isAgency) {
      throw new Error(
        'This is a recruiter or staffing agency. Your rules say to write to employers directly, so nothing was generated.',
      );
    }
    const ctx = await candidateContext(candidateId);

    const draft = await draftApplication({
      profileText: candidateProfileText(ctx),
      candidateName: ctx.candidate.name,
      candidateCountry: ctx.candidate.country,
      profession: ctx.profile?.profession ?? ctx.candidate.profession ?? '',
      jobTitle: ctx.profile?.profession ?? ctx.candidate.profession ?? 'Initiativbewerbung',
      employer: company.name,
      jobUrl: company.website ?? company.careersUrl ?? '',
      jobLocation: company.location,
      jobText: company.notes,
      matchReasons: [],
      warnings: [],
      kind: 'speculative',
      germanLevel: languageOf(ctx.languages, 'German') ?? 'none',
    });

    const application = await db.create('applications', {
      candidateId,
      companyId,
      status: 'Prepared',
      statusHistory: [
        { status: 'Potential', at: new Date().toISOString(), by: 'me' },
        { status: 'Prepared', at: new Date().toISOString(), by: 'me' },
      ],
      followUpCount: 0,
      speculative: true,
    });
    const message = await upsertMessage(application.id, candidateId, draft, 'speculative');

    await logAudit({
      who: 'me',
      what: `Wrote a speculative application to ${company.name}`,
      why: 'Company page — generate speculative application',
      candidateId,
      applicationId: application.id,
    });

    return { application, message };
  });
}
