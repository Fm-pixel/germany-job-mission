/**
 * The programmes the Opportunity Radar watches (BUILD_PLAN prompt 18).
 *
 * This list only names the programme and its official page. Nothing else —
 * no deadline, no requirement, no age limit — is written here from memory.
 * All of that is filled in by researching the official page (research.ts) and
 * is stored with the date it was checked.
 */
export interface SeedEntry {
  name: string;
  type:
    | 'program'
    | 'scholarship'
    | 'exchange'
    | 'volunteer'
    | 'study'
    | 'family'
    | 'event'
    | 'labour agreement'
    | 'language';
  organiser: string;
  url: string;
  honestNote?: string;
}

export const SEED_OPPORTUNITIES: SeedEntry[] = [
  {
    name: 'Programme Migration & Diaspora (PMD)',
    type: 'program',
    organiser: 'GIZ',
    url: 'https://www.giz.de/en/worldwide/76021.html',
  },
  {
    name: 'Centre for International Migration and Development (CIM)',
    type: 'program',
    organiser: 'GIZ / Bundesagentur für Arbeit',
    url: 'https://www.cimonline.de/en/html/index.html',
  },
  {
    name: 'ZAV — international placement services',
    type: 'program',
    organiser: 'Bundesagentur für Arbeit',
    url: 'https://www.arbeitsagentur.de/en/welcome',
  },
  {
    name: 'Triple Win (nursing staff)',
    type: 'program',
    organiser: 'GIZ and Bundesagentur für Arbeit',
    url: 'https://www.giz.de/en/worldwide/41533.html',
  },
  {
    name: 'Hand in Hand for International Talents',
    type: 'program',
    organiser: 'DIHK / GIZ / Bundesagentur für Arbeit',
    url: 'https://www.dihk.de/en',
  },
  {
    name: 'Government labour agreements with African countries',
    type: 'labour agreement',
    organiser: 'Federal Government',
    url: 'https://www.make-it-in-germany.com/en/',
    honestNote:
      'Agreements exist with some countries and not with others. Check which agreement covers the person’s nationality before planning anything on it.',
  },
  {
    name: 'DAAD scholarships',
    type: 'scholarship',
    organiser: 'DAAD',
    url: 'https://www.daad.de/en/study-and-research-in-germany/scholarships/',
  },
  {
    name: 'Studienkolleg and student visa (§ 16b AufenthG)',
    type: 'study',
    organiser: 'Federal Government',
    url: 'https://www.make-it-in-germany.com/en/study-training/studying',
  },
  {
    name: 'Language course visa (§ 16f AufenthG)',
    type: 'language',
    organiser: 'Federal Government',
    url: 'https://www.gesetze-im-internet.de/aufenthg_2004/__16f.html',
  },
  {
    name: 'weltwärts South-North component',
    type: 'volunteer',
    organiser: 'BMZ',
    url: 'https://www.weltwaerts.de/en/',
  },
  {
    name: 'Voluntary service FSJ / BFD',
    type: 'volunteer',
    organiser: 'Federal Government',
    url: 'https://www.make-it-in-germany.com/en/visa-residence/types/voluntary-service',
  },
  {
    name: 'Au pair in Germany',
    type: 'exchange',
    organiser: 'Federal Government',
    url: 'https://www.make-it-in-germany.com/en/visa-residence/types/au-pair',
  },
  {
    name: 'Goethe-Institut — German courses and exams',
    type: 'language',
    organiser: 'Goethe-Institut',
    url: 'https://www.goethe.de/en/index.html',
  },
  {
    name: 'Make it in Germany job fairs and events',
    type: 'event',
    organiser: 'Federal Government',
    url: 'https://www.make-it-in-germany.com/en/',
    honestNote:
      'An event visa is a short-stay visa. It is a networking chance only and never becomes a residence permit for work.',
  },
  {
    name: 'German Embassy Kigali — announcements and appointments',
    type: 'event',
    organiser: 'Auswärtiges Amt',
    url: 'https://kigali.diplo.de/rw-en',
  },
  {
    name: 'Family reunification — spouse and children (§§ 28–30, § 32 AufenthG)',
    type: 'family',
    organiser: 'Federal Government',
    url: 'https://www.make-it-in-germany.com/en/visa-residence/family-reunification',
  },
  {
    name: 'Family reunification — parents (§ 36 AufenthG)',
    type: 'family',
    organiser: 'Federal Government',
    url: 'https://www.gesetze-im-internet.de/aufenthg_2004/__36.html',
    honestNote:
      'Very limited — for parents this is a hardship route only (außergewöhnliche Härte). Do not plan on it; confirm any individual case with the responsible authority.',
  },
];
