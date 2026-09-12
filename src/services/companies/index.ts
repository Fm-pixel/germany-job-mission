import { z } from 'zod';
import { db, type Company } from '../db';
import { aiAvailable, askJson } from '../ai/client';
import { researchWeb } from '../ai/websearch';
import { logAudit } from '../tracking/audit';

/**
 * Company discovery (SPEC section 5 / BUILD_PLAN prompt 8).
 * Contact details are only stored when they were found on the company's own
 * website, and the page they came from is stored as evidence. Nothing is guessed.
 */

const INDUSTRY_SUGGESTIONS: Record<string, string[]> = {
  electrician: [
    'Elektroinstallation / electrical contractors',
    'Bauunternehmen / construction',
    'Industrie / industrial maintenance',
    'Facility Management',
    'Erneuerbare Energien / solar and wind',
  ],
  nurse: ['Krankenhäuser / hospitals', 'Pflegeheime / care homes', 'Ambulante Pflegedienste', 'Reha-Kliniken'],
  welder: ['Metallbau', 'Stahlbau', 'Maschinenbau', 'Schiffbau', 'Rohrleitungsbau'],
  driver: ['Speditionen / logistics', 'Nahverkehr / public transport', 'Entsorgung', 'Baulogistik'],
  cook: ['Hotels', 'Restaurants', 'Betriebsgastronomie / canteens', 'Catering'],
  it: ['IT-Dienstleister', 'Software-Häuser', 'Systemhäuser', 'Industrie-IT'],
};

export function suggestIndustries(profession: string): string[] {
  const key = Object.keys(INDUSTRY_SUGGESTIONS).find((k) => profession.toLowerCase().includes(k));
  if (key) return INDUSTRY_SUGGESTIONS[key];
  return [
    `Companies that directly employ a ${profession}`,
    'Industrial companies with their own maintenance department',
    'Large employers in the region with an own careers page',
  ];
}

const CompanySchema = z.object({
  companies: z.array(
    z.object({
      name: z.string(),
      industry: z.string(),
      location: z.string(),
      website: z.string().describe('The company\'s own website, or "" if it was not found.'),
      careersUrl: z.string().describe('The careers page on the company\'s own site, or "".'),
      applicationMethod: z.string().describe('How they say applications should be sent, or "unknown".'),
      contactEmail: z.string().describe('Only an address published on the company\'s OWN website. Otherwise "".'),
      contactEvidenceUrl: z.string().describe('The exact page on their own site where the address was found, or "".'),
      isAgency: z.boolean().describe('True if this is a recruiter, staffing agency or Zeitarbeit firm.'),
      note: z.string(),
    }),
  ),
});

const SYSTEM = `You research real German employers for a private job-search tool.

Rules you follow literally:
- Only report companies you actually found. Never invent a company, a website or an address.
- A contact email may only be reported if it is published on the company's OWN website, and you must give the exact page as evidence. Otherwise leave it empty. Never guess an address pattern like info@company.de.
- Mark recruiters, staffing agencies and Zeitarbeit firms honestly with isAgency = true.
- If you find nothing, return an empty list. An empty list is a correct answer.`;

export async function discoverCompanies(input: {
  profession: string;
  industry: string;
  region: string;
  candidateId?: string;
}): Promise<{ companies: Company[]; sources: { url: string; title?: string }[] }> {
  if (!aiAvailable()) {
    throw Object.assign(
      new Error('Company discovery needs the Anthropic API. It is NOT CONNECTED — see SETUP_FOR_ME.md step 3.'),
      { code: 'AI_NOT_CONNECTED' },
    );
  }

  const research = await researchWeb(
    `Find real German companies in the category "${input.industry}" in ${input.region} that employ people in the occupation "${input.profession}".

For each company find: the official company website, the careers page on that website, how they want applications, and — only if it is published on their own website — an application email address with the exact page it is on.

Report at most 10 companies. Say plainly if a company is a recruiter or staffing agency.`,
    { system: SYSTEM, maxUses: 8 },
  );

  const parsed = await askJson(
    CompanySchema,
    `Turn this research into structured data. Keep only what the research actually found; leave fields empty rather than guessing.

RESEARCH
${research.text}

PAGES VISITED
${research.sources.map((s) => s.url).join('\n')}`,
    { system: SYSTEM, maxTokens: 6000 },
  );

  const stored: Company[] = [];
  for (const entry of parsed.companies) {
    if (!entry.name.trim()) continue;
    const existing = await db.first('companies', {
      where: [{ field: 'name', op: '==', value: entry.name }],
    });
    const payload = {
      name: entry.name,
      industry: entry.industry || input.industry,
      location: entry.location || input.region,
      website: entry.website || undefined,
      careersUrl: entry.careersUrl || undefined,
      applicationMethod: entry.applicationMethod || undefined,
      contactEmail: entry.contactEvidenceUrl ? entry.contactEmail || undefined : undefined,
      contactEvidenceUrl: entry.contactEvidenceUrl || undefined,
      isAgency: entry.isAgency,
      discoveredVia: `web research for ${input.profession} / ${input.industry} / ${input.region}`,
      notes: entry.note || undefined,
    };
    stored.push(existing ? await db.update('companies', existing.id, payload) : await db.create('companies', payload));
  }

  await logAudit({
    who: 'me',
    what: `Searched for companies: ${input.industry} in ${input.region}`,
    why: `Company discovery for ${input.profession}`,
    candidateId: input.candidateId,
    detail: `${stored.length} companies stored, ${research.sources.length} pages read`,
  });

  return { companies: stored, sources: research.sources };
}

/** Links stored vacancies to a company by employer name. */
export async function linkJobsToCompany(companyId: string): Promise<number> {
  const company = await db.get('companies', companyId);
  if (!company) return 0;
  const jobs = await db.list('jobs', { limit: 500 });
  let linked = 0;
  for (const job of jobs) {
    if (job.companyId) continue;
    if (job.employer.toLowerCase().includes(company.name.toLowerCase().split(' ')[0])) {
      await db.update('jobs', job.id, { companyId });
      linked += 1;
    }
  }
  return linked;
}
