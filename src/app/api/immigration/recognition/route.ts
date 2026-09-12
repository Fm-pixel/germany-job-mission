import { guard } from '@/lib/api';
import { assessRecognition } from '@/services/immigration';

export async function POST(request: Request) {
  return guard(async () => {
    const body = (await request.json()) as {
      candidateId?: string;
      profession?: string;
      qualification?: string;
      issuingCountry?: string;
    };
    if (!body.candidateId || !body.profession || !body.issuingCountry) {
      throw new Error('Person, profession and the country where the qualification was obtained are needed.');
    }
    return assessRecognition({
      candidateId: body.candidateId,
      profession: body.profession,
      qualification: body.qualification ?? body.profession,
      issuingCountry: body.issuingCountry,
    });
  });
}
