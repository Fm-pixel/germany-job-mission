import { Card, Empty, NotConnected, Pill } from '@/components/ui';
import { db } from '@/services/db';
import { suggestIndustries } from '@/services/companies';
import { aiAvailable } from '@/services/ai/client';
import { CompanyPanel } from './panel';
import { SpeculativeApplication } from '@/components/speculative';

export const dynamic = 'force-dynamic';

export default async function CompaniesPage() {
  const [companies, candidates] = await Promise.all([db.list('companies', { limit: 500 }), db.list('candidates')]);
  const professions = [...new Set(candidates.map((c) => c.profession).filter(Boolean))] as string[];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
        <p className="mt-1 text-sm text-slate-500">
          Employers who hire this kind of work — not only the ones who happen to advertise today.
        </p>
      </header>

      {!aiAvailable() && (
        <NotConnected
          what="Company research"
          detail="Finding companies uses web research through the Anthropic API. You can still add companies by hand below."
          step="3"
        />
      )}

      <Card title="Find companies">
        <CompanyPanel
          candidates={candidates.map((c) => ({ id: c.id, name: c.name, profession: c.profession }))}
          suggestions={professions.length > 0 ? suggestIndustries(professions[0]) : suggestIndustries('')}
          aiConnected={aiAvailable()}
        />
      </Card>

      <Card title="Speculative application (Initiativbewerbung)">
        <p className="mb-3 text-sm text-slate-600">
          For a company that fits but is not advertising. It goes through the same review queue — nothing is sent
          without your approval, and recruiters and agencies are refused.
        </p>
        <SpeculativeApplication
          companies={companies.map((c) => ({ id: c.id, name: c.name, isAgency: c.isAgency }))}
          candidates={candidates.map((c) => ({ id: c.id, name: c.name }))}
        />
      </Card>

      <Card title={`Stored companies (${companies.length})`}>
        {companies.length === 0 ? (
          <Empty>No companies yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <th className="py-2 pr-3">Company</th>
                  <th className="py-2 pr-3">Industry</th>
                  <th className="py-2 pr-3">Location</th>
                  <th className="py-2 pr-3">Application</th>
                  <th className="py-2 pr-3">Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {companies.map((company) => (
                  <tr key={company.id}>
                    <td className="py-2 pr-3">
                      <div className="font-medium">
                        {company.name} {company.isAgency && <Pill tone="yellow">agency</Pill>}
                      </div>
                      {company.website && (
                        <a href={company.website} target="_blank" rel="noreferrer" className="text-xs text-accent-600 underline">
                          {company.website}
                        </a>
                      )}
                    </td>
                    <td className="py-2 pr-3">{company.industry ?? '—'}</td>
                    <td className="py-2 pr-3">{company.location ?? '—'}</td>
                    <td className="py-2 pr-3 text-xs">
                      {company.careersUrl ? (
                        <a href={company.careersUrl} target="_blank" rel="noreferrer" className="text-accent-600 underline">
                          Careers page
                        </a>
                      ) : (
                        (company.applicationMethod ?? 'unknown')
                      )}
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {company.contactEmail ? (
                        <>
                          {company.contactEmail}
                          {company.contactEvidenceUrl && (
                            <a
                              href={company.contactEvidenceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="ml-1 text-accent-600 underline"
                            >
                              evidence
                            </a>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-400">not published — apply through their own page</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
