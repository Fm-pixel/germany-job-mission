import { guard } from '@/lib/api';
import { discoverCompanies } from '@/services/companies';

export async function POST(request: Request) {
  return guard(async () => {
    const body = (await request.json()) as {
      profession?: string;
      industry?: string;
      region?: string;
      candidateId?: string;
    };
    if (!body.profession || !body.industry || !body.region) {
      throw new Error('Occupation, category and region are all needed.');
    }
    return discoverCompanies({
      profession: body.profession,
      industry: body.industry,
      region: body.region,
      candidateId: body.candidateId,
    });
  });
}
