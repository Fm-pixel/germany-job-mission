import type { LanguageLevel, SourceLabel } from '../db';

/**
 * The residence pathways this tool knows about.
 *
 * IMPORTANT, and deliberate: every requirement starts with the label
 * LIKELY-NEEDS-CONFIRMATION and carries the official page it must be checked
 * against. A requirement only becomes CONFIRMED after "Re-check sources" has
 * actually read that page (see recheck.ts) — this tool never states a
 * requirement, a salary threshold or an amount of money as fact from memory.
 */

export interface RequirementTemplate {
  key: string;
  text: string;
  sourceUrl: string;
  /** A value that changes over time (salary threshold, blocked account amount). */
  valueKey?: string;
}

export interface PathwayDefinition {
  key: string;
  name: string;
  lawRef: string;
  summary: string;
  sourceUrl: string;
  lawUrl: string;
  needsJobOffer: boolean;
  needsQualification: 'vocational' | 'academic' | 'either' | 'none';
  needsRecognition: boolean;
  minGerman?: LanguageLevel;
  requirements: RequirementTemplate[];
  documents: string[];
  nextSteps: string[];
}

const MIIG = 'https://www.make-it-in-germany.com';
const AA = 'https://www.auswaertiges-amt.de';
const GESETZE = 'https://www.gesetze-im-internet.de/aufenthg_2004';

export const PATHWAYS: PathwayDefinition[] = [
  {
    key: 'skilled-vocational',
    name: 'Skilled worker with vocational training',
    lawRef: '§ 18a AufenthG',
    summary:
      'For people with a vocational qualification that is recognised as equivalent in Germany, together with a concrete job offer in that field.',
    sourceUrl: `${MIIG}/en/visa-residence/work-visa/skilled-worker-vocational-training`,
    lawUrl: `${GESETZE}/__18a.html`,
    needsJobOffer: true,
    needsQualification: 'vocational',
    needsRecognition: true,
    requirements: [
      {
        key: 'job-offer',
        text: 'A concrete job offer or employment contract from a German employer.',
        sourceUrl: `${MIIG}/en/visa-residence/work-visa/skilled-worker-vocational-training`,
      },
      {
        key: 'recognition',
        text: 'The foreign vocational qualification must be recognised as equivalent to a German qualification.',
        sourceUrl: 'https://www.anerkennung-in-deutschland.de/html/en/index.php',
      },
      {
        key: 'related-work',
        text: 'The job must be related to the recognised qualification.',
        sourceUrl: `${GESETZE}/__18a.html`,
      },
      {
        key: 'ba-approval',
        text: 'Approval of the Bundesagentur für Arbeit, unless it is not required for this case.',
        sourceUrl: `${MIIG}/en/visa-residence/work-visa/skilled-worker-vocational-training`,
      },
    ],
    documents: [
      'Valid passport',
      'Employment contract or concrete job offer',
      'Recognition notice (Anerkennungsbescheid) for the vocational qualification',
      'Qualification certificates and transcripts',
      'CV',
      'Proof of health insurance',
      'Visa application form and biometric photo',
    ],
    nextSteps: [
      'Start the recognition procedure for the qualification if it has not been started.',
      'Ask the employer for a signed contract or a written job offer with salary and start date.',
      'Book the visa appointment at the responsible German mission.',
    ],
  },
  {
    key: 'skilled-academic',
    name: 'Skilled worker with an academic degree',
    lawRef: '§ 18b (1) AufenthG',
    summary:
      'For people with a university degree that is recognised or comparable in Germany, together with a qualified job offer.',
    sourceUrl: `${MIIG}/en/visa-residence/work-visa/skilled-worker-academic`,
    lawUrl: `${GESETZE}/__18b.html`,
    needsJobOffer: true,
    needsQualification: 'academic',
    needsRecognition: true,
    requirements: [
      {
        key: 'degree',
        text: 'A German degree, a recognised foreign degree, or a foreign degree comparable to a German one (anabin).',
        sourceUrl: 'https://anabin.kmk.org/anabin.html',
      },
      {
        key: 'job-offer',
        text: 'A concrete job offer for qualified employment.',
        sourceUrl: `${MIIG}/en/visa-residence/work-visa/skilled-worker-academic`,
      },
    ],
    documents: [
      'Valid passport',
      'University degree certificate and transcript',
      'Proof that the degree is recognised or comparable (anabin / ZAB statement)',
      'Employment contract or job offer',
      'Proof of health insurance',
      'Visa application form and biometric photo',
    ],
    nextSteps: [
      'Check the degree in the anabin database and, if needed, apply for a ZAB statement of comparability.',
      'Collect the employment contract.',
      'Book the visa appointment at the responsible German mission.',
    ],
  },
  {
    key: 'blue-card',
    name: 'EU Blue Card',
    lawRef: '§ 18g AufenthG',
    summary:
      'For academics with a job offer whose gross salary reaches the threshold that applies in the current year (lower threshold for shortage occupations and for young professionals).',
    sourceUrl: `${MIIG}/en/visa-residence/work-visa/eu-blue-card`,
    lawUrl: `${GESETZE}/__18g.html`,
    needsJobOffer: true,
    needsQualification: 'academic',
    needsRecognition: true,
    requirements: [
      {
        key: 'degree',
        text: 'A university degree recognised in Germany, or a comparable qualification accepted for the Blue Card.',
        sourceUrl: `${MIIG}/en/visa-residence/work-visa/eu-blue-card`,
      },
      {
        key: 'salary',
        text: 'The gross annual salary must reach the Blue Card threshold in force this year.',
        sourceUrl: `${MIIG}/en/visa-residence/work-visa/eu-blue-card`,
        valueKey: 'blue-card-salary-threshold',
      },
      {
        key: 'contract-duration',
        text: 'An employment contract or binding job offer for the minimum duration required for the Blue Card.',
        sourceUrl: `${MIIG}/en/visa-residence/work-visa/eu-blue-card`,
      },
    ],
    documents: [
      'Valid passport',
      'University degree certificate',
      'Employment contract stating the gross annual salary',
      'Proof that the degree is recognised or comparable',
      'Proof of health insurance',
      'Visa application form and biometric photo',
    ],
    nextSteps: [
      'Compare the offered gross annual salary with the threshold for the current year.',
      'Ask the employer to state the gross annual salary in writing.',
      'Book the visa appointment.',
    ],
  },
  {
    key: 'experienced-worker',
    name: 'Work experience route (no formal recognition)',
    lawRef: '§ 19c (2) AufenthG in connection with § 6 BeschV',
    summary:
      'For people with a state-recognised qualification and several years of professional experience, where formal recognition is not required but a minimum salary and other conditions apply.',
    sourceUrl: `${MIIG}/en/visa-residence/work-visa/skilled-worker-professional-experience`,
    lawUrl: `${GESETZE}/__19c.html`,
    needsJobOffer: true,
    needsQualification: 'either',
    needsRecognition: false,
    requirements: [
      {
        key: 'experience',
        text: 'Several years of professional experience in the occupation, as required by the current rule.',
        sourceUrl: `${MIIG}/en/visa-residence/work-visa/skilled-worker-professional-experience`,
        valueKey: 'experience-route-years',
      },
      {
        key: 'qualification',
        text: 'A qualification recognised by the state in the country where it was obtained, with the required minimum length of training.',
        sourceUrl: `${MIIG}/en/visa-residence/work-visa/skilled-worker-professional-experience`,
      },
      {
        key: 'salary',
        text: 'A gross annual salary reaching the threshold that applies to this route.',
        sourceUrl: `${MIIG}/en/visa-residence/work-visa/skilled-worker-professional-experience`,
        valueKey: 'experience-route-salary-threshold',
      },
    ],
    documents: [
      'Valid passport',
      'Employment contract with the gross annual salary',
      'Qualification certificate from the home country with proof that it is state-recognised',
      'Employer references proving the years of experience',
      'Proof of health insurance',
    ],
    nextSteps: [
      'Collect written employer references that prove the years of experience.',
      'Ask the employer for a contract that states the gross annual salary.',
    ],
  },
  {
    key: 'recognition-partnership',
    name: 'Recognition partnership / qualification measure',
    lawRef: '§ 16d AufenthG',
    summary:
      'Come to Germany with a job and complete the recognition of the foreign qualification here, together with the employer.',
    sourceUrl: `${MIIG}/en/visa-residence/work-visa/recognition-partnership`,
    lawUrl: `${GESETZE}/__16d.html`,
    needsJobOffer: true,
    needsQualification: 'vocational',
    needsRecognition: false,
    minGerman: 'A2',
    requirements: [
      {
        key: 'employer-agreement',
        text: 'An employment contract and an agreement with the employer to carry out the recognition procedure in Germany.',
        sourceUrl: `${MIIG}/en/visa-residence/work-visa/recognition-partnership`,
      },
      {
        key: 'qualification',
        text: 'A qualification obtained abroad with the minimum training duration required by the rule.',
        sourceUrl: `${MIIG}/en/visa-residence/work-visa/recognition-partnership`,
      },
      {
        key: 'german',
        text: 'German language skills at the level required for this route.',
        sourceUrl: `${MIIG}/en/visa-residence/work-visa/recognition-partnership`,
        valueKey: 'recognition-partnership-german-level',
      },
    ],
    documents: [
      'Valid passport',
      'Employment contract',
      'Written recognition partnership agreement with the employer',
      'Qualification certificates',
      'German language certificate',
      'Proof of health insurance',
    ],
    nextSteps: [
      'Ask the employer whether they will enter a recognition partnership.',
      'Apply to the competent recognition authority.',
    ],
  },
  {
    key: 'opportunity-card',
    name: 'Opportunity Card (Chancenkarte)',
    lawRef: '§ 20a / § 20b AufenthG',
    summary:
      'A residence permit to look for work in Germany, based on a points system. It is a job-search route, not a work permit on its own.',
    sourceUrl: `${MIIG}/en/visa-residence/opportunity-card`,
    lawUrl: `${GESETZE}/__20a.html`,
    needsJobOffer: false,
    needsQualification: 'either',
    needsRecognition: false,
    requirements: [
      {
        key: 'base-qualification',
        text: 'A vocational qualification of at least the required length, or a university degree, recognised by the state in the country where it was obtained.',
        sourceUrl: `${MIIG}/en/visa-residence/opportunity-card`,
      },
      {
        key: 'language',
        text: 'German at the required minimum level or English at the required minimum level.',
        sourceUrl: `${MIIG}/en/visa-residence/opportunity-card`,
        valueKey: 'opportunity-card-language',
      },
      {
        key: 'points',
        text: 'Enough points under the official points table (unless the qualification is already fully recognised).',
        sourceUrl: `${MIIG}/en/visa-residence/opportunity-card`,
        valueKey: 'opportunity-card-points',
      },
      {
        key: 'funds',
        text: 'Proof of enough money to live on during the stay (blocked account or a declaration of commitment).',
        sourceUrl: `${AA}/en/visa-service`,
        valueKey: 'blocked-account-amount',
      },
    ],
    documents: [
      'Valid passport',
      'Qualification certificates with proof of state recognition in the home country',
      'Language certificate',
      'Proof of funds (blocked account or Verpflichtungserklärung)',
      'CV',
      'Proof of health insurance',
    ],
    nextSteps: [
      'Run the official self-check on make-it-in-germany.com.',
      'Organise proof of funds — this is usually the hardest part.',
    ],
  },
  {
    key: 'training',
    name: 'Vocational training (Ausbildung)',
    lawRef: '§ 16a AufenthG',
    summary:
      'Come to Germany for a paid apprenticeship with a training contract. This is the realistic legal route for people without a completed vocational qualification.',
    sourceUrl: `${MIIG}/en/study-training/vocational-training`,
    lawUrl: `${GESETZE}/__16a.html`,
    needsJobOffer: true,
    needsQualification: 'none',
    needsRecognition: false,
    minGerman: 'B1',
    requirements: [
      {
        key: 'training-contract',
        text: 'A signed training contract (Ausbildungsvertrag) with a German company.',
        sourceUrl: `${MIIG}/en/study-training/vocational-training`,
      },
      {
        key: 'german',
        text: 'German language skills at the level required for the training place.',
        sourceUrl: `${MIIG}/en/study-training/vocational-training`,
        valueKey: 'training-german-level',
      },
      {
        key: 'funds',
        text: 'Proof that living costs are covered — training pay counts, and the gap must be covered if it is not enough.',
        sourceUrl: `${AA}/en/visa-service`,
        valueKey: 'blocked-account-amount',
      },
      {
        key: 'school-certificate',
        text: 'A school-leaving certificate.',
        sourceUrl: `${MIIG}/en/study-training/vocational-training`,
      },
    ],
    documents: [
      'Valid passport',
      'Signed training contract',
      'School-leaving certificate',
      'German language certificate or proof of a booked language course',
      'Proof of funds for the gap between training pay and the required amount',
      'Proof of health insurance',
    ],
    nextSteps: [
      'Find a company offering an Ausbildung that takes international applicants.',
      'Plan the German course to the level the company requires.',
      'Check the funding gap and, if needed, find a sponsor for a declaration of commitment.',
    ],
  },
  {
    key: 'job-seeker-training',
    name: 'Visa to look for a training place',
    lawRef: '§ 17 (1) AufenthG',
    summary:
      'A limited stay to search for an apprenticeship place in Germany, with age, language and funding conditions.',
    sourceUrl: `${MIIG}/en/study-training/vocational-training`,
    lawUrl: `${GESETZE}/__17.html`,
    needsJobOffer: false,
    needsQualification: 'none',
    needsRecognition: false,
    requirements: [
      {
        key: 'age',
        text: 'The applicant must be under the maximum age set for this route.',
        sourceUrl: `${GESETZE}/__17.html`,
        valueKey: 'training-search-max-age',
      },
      {
        key: 'school',
        text: 'A school-leaving certificate that qualifies for training in Germany.',
        sourceUrl: `${GESETZE}/__17.html`,
      },
      {
        key: 'german',
        text: 'German at the level required for this route.',
        sourceUrl: `${GESETZE}/__17.html`,
        valueKey: 'training-search-german-level',
      },
      {
        key: 'funds',
        text: 'Proof of enough money for the whole search period.',
        sourceUrl: `${AA}/en/visa-service`,
        valueKey: 'blocked-account-amount',
      },
    ],
    documents: [
      'Valid passport',
      'School-leaving certificate',
      'German language certificate',
      'Proof of funds',
      'Proof of health insurance',
    ],
    nextSteps: ['Check the current age limit and language level on the official page before applying.'],
  },
];

export function pathwayByKey(key: string): PathwayDefinition | undefined {
  return PATHWAYS.find((p) => p.key === key);
}

export const DEFAULT_LABEL: SourceLabel = 'LIKELY-NEEDS-CONFIRMATION';

export const NOT_LEGAL_ADVICE =
  'This is information, not legal advice, and nothing here is a guarantee. The German mission abroad and the Ausländerbehörde decide; for a legal question ask a lawyer.';

/** Stated plainly wherever Track B applies (BUILD_PLAN Part G). */
export const NO_UNSKILLED_VISA_NOTE =
  'There is no German work visa for unskilled "helper" jobs for most non-EU nationals. The realistic legal path for someone without a vocational qualification is a paid apprenticeship (Ausbildung). Confirm the current position for the specific nationality on make-it-in-germany.com and with the responsible German mission.';
