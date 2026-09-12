import type {
  Candidate,
  CandidateProfile,
  Job,
  LanguageLevel,
  LanguageSkill,
  MatchBreakdownItem,
  MatchExplanationItem,
} from '../db';

const LEVEL_ORDER: LanguageLevel[] = ['none', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'native'];

export function levelValue(level?: LanguageLevel): number {
  if (!level) return 0;
  return Math.max(0, LEVEL_ORDER.indexOf(level));
}

export function levelAtLeast(actual: LanguageLevel | undefined, required: LanguageLevel): boolean {
  return levelValue(actual) >= levelValue(required);
}

export interface ScoreInput {
  candidate: Candidate;
  profile?: CandidateProfile | null;
  languages: LanguageSkill[];
  job: Job;
}

export interface ScoreResult {
  score: number;
  breakdown: MatchBreakdownItem[];
  ruleExplanation: MatchExplanationItem[];
  germanGap?: { required: LanguageLevel; has: LanguageLevel };
}

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-zäöüß0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(text: string): string[] {
  return normalise(text)
    .split(' ')
    .filter((t) => t.length >= 4);
}

export function professionOverlap(candidateTerms: string[], job: Job): number {
  const haystack = normalise([job.title, job.description ?? ''].join(' '));
  if (candidateTerms.length === 0 || haystack.length === 0) return 0;
  let hits = 0;
  for (const term of candidateTerms) {
    const t = normalise(term);
    if (!t) continue;
    if (haystack.includes(t)) {
      hits += 1;
      continue;
    }
    const parts = tokens(t);
    if (parts.length > 0 && parts.every((p) => haystack.includes(p))) hits += 0.75;
  }
  return Math.min(1, hits / Math.min(3, candidateTerms.length || 1));
}

export function languageOf(languages: LanguageSkill[], name: string): LanguageLevel | undefined {
  return languages.find((l) => l.language.toLowerCase() === name.toLowerCase())?.level;
}

/**
 * Deterministic 0–100 score. Works without the AI, is unit-tested, and is the
 * number the autopilot policy thresholds are compared against.
 */
export function scoreMatch(input: ScoreInput): ScoreResult {
  const { candidate, profile, languages, job } = input;
  const breakdown: MatchBreakdownItem[] = [];
  const ruleExplanation: MatchExplanationItem[] = [];

  // 1. Profession / job title match — 35 points
  const terms = [
    candidate.preferredOccupation,
    candidate.profession,
    profile?.profession,
    ...(profile?.jobTitles ?? []),
  ].filter((t): t is string => Boolean(t));
  const overlap = professionOverlap(terms, job);
  const professionPoints = Math.round(overlap * 35);
  breakdown.push({
    factor: 'Profession',
    points: professionPoints,
    max: 35,
    reason: terms.length
      ? `Vacancy "${job.title}" compared with ${terms.slice(0, 3).join(', ')}.`
      : 'No profession stored for this person yet — add one to make matching meaningful.',
  });
  if (professionPoints >= 25) {
    ruleExplanation.push({ kind: 'positive', text: `Occupation fits the vacancy "${job.title}"` });
  } else if (professionPoints <= 10) {
    ruleExplanation.push({
      kind: 'warning',
      text: 'The vacancy title does not clearly match this person’s occupation',
    });
  }

  // 2. Experience — 15 points
  const years = profile?.yearsExperience ?? 0;
  const experiencePoints = Math.min(15, Math.round((years / 5) * 15));
  breakdown.push({
    factor: 'Experience',
    points: experiencePoints,
    max: 15,
    reason: years ? `${years} year(s) of experience on file.` : 'No confirmed years of experience yet.',
  });
  if (years >= 2) {
    ruleExplanation.push({ kind: 'positive', text: `${years} years of professional experience` });
  }

  // 3. Qualification — 15 points
  const level = profile?.qualificationLevel ?? 'none';
  const qualificationPoints = level === 'academic' ? 15 : level === 'vocational' ? 13 : level === 'other' ? 7 : 3;
  breakdown.push({
    factor: 'Qualification',
    points: qualificationPoints,
    max: 15,
    reason:
      level === 'none'
        ? 'No vocational or academic qualification recorded (Track B may fit better).'
        : `Recorded qualification level: ${level}.`,
  });
  if (level === 'vocational') {
    ruleExplanation.push({ kind: 'positive', text: 'Vocational qualification' });
  } else if (level === 'academic') {
    ruleExplanation.push({ kind: 'positive', text: 'Academic degree' });
  } else {
    ruleExplanation.push({
      kind: 'warning',
      text: 'No recognised vocational qualification recorded — this limits the skilled-worker routes',
    });
  }

  // 4. German — 20 points (a gap is always shown, never hidden)
  const german = languageOf(languages, 'German') ?? 'none';
  const required = job.languageRequirement;
  let germanPoints: number;
  let germanGap: ScoreResult['germanGap'];
  if (!required) {
    germanPoints = Math.min(20, 8 + levelValue(german) * 2);
    breakdown.push({
      factor: 'German',
      points: germanPoints,
      max: 20,
      reason: `The advert does not name a German level. Candidate: ${german}.`,
    });
    ruleExplanation.push({
      kind: 'warning',
      text: `The advert does not state a German level — candidate has ${german}. Needs confirmation with the employer`,
    });
  } else if (levelAtLeast(german, required)) {
    germanPoints = 20;
    breakdown.push({
      factor: 'German',
      points: 20,
      max: 20,
      reason: `Advert asks for ${required}, candidate has ${german}.`,
    });
    ruleExplanation.push({
      kind: 'positive',
      text: `German ${german} meets the level named in the advert (${required})`,
    });
  } else {
    const gap = levelValue(required) - levelValue(german);
    germanPoints = Math.max(0, 12 - gap * 5);
    germanGap = { required, has: german };
    breakdown.push({
      factor: 'German',
      points: germanPoints,
      max: 20,
      reason: `Advert asks for ${required}, candidate has ${german} — a gap of ${gap} level(s).`,
    });
    ruleExplanation.push({
      kind: 'warning',
      text: `Employer asks for German ${required}, candidate has ${german}`,
    });
  }

  // 5. English — 5 points
  const english = languageOf(languages, 'English') ?? 'none';
  const englishPoints = Math.min(5, Math.round((levelValue(english) / 6) * 5));
  breakdown.push({
    factor: 'English',
    points: englishPoints,
    max: 5,
    reason: `English level on file: ${english}.`,
  });
  if (levelAtLeast(english, 'B2')) {
    ruleExplanation.push({ kind: 'positive', text: `English ${english}` });
  }

  // 6. Location / relocation — 7 points
  const preferred = [...(candidate.preferredCities ?? []), ...(candidate.preferredStates ?? [])].map(normalise);
  const jobLocation = normalise([job.location, job.state].filter(Boolean).join(' '));
  let locationPoints: number;
  let locationReason: string;
  if (candidate.relocate) {
    locationPoints = 7;
    locationReason = 'Willing to relocate anywhere in Germany.';
    ruleExplanation.push({ kind: 'positive', text: 'Relocation possible' });
  } else if (preferred.length === 0) {
    locationPoints = 5;
    locationReason = 'No location preference recorded.';
  } else if (preferred.some((p) => p && jobLocation.includes(p))) {
    locationPoints = 7;
    locationReason = `Vacancy is in a preferred location (${job.location ?? 'location per advert'}).`;
    ruleExplanation.push({ kind: 'positive', text: `Location matches the preference: ${job.location}` });
  } else {
    locationPoints = 1;
    locationReason = `Vacancy in ${job.location ?? 'an unstated place'}, outside the stated preference, and relocation is marked as not possible.`;
    ruleExplanation.push({
      kind: 'warning',
      text: `Vacancy is in ${job.location ?? 'an unstated place'}, outside the stated preference`,
    });
  }
  breakdown.push({ factor: 'Location', points: locationPoints, max: 7, reason: locationReason });

  // 7. Working time — 3 points
  const wanted = candidate.workingTime ?? 'either';
  const offered = job.workingTime ?? 'either';
  const workingTimePoints = wanted === 'either' || offered === 'either' || wanted === offered ? 3 : 1;
  breakdown.push({
    factor: 'Working time',
    points: workingTimePoints,
    max: 3,
    reason: `Wanted: ${wanted}; advert: ${offered}.`,
  });

  const score = Math.max(
    0,
    Math.min(100, breakdown.reduce((sum, item) => sum + item.points, 0)),
  );

  return { score, breakdown, ruleExplanation, germanGap };
}

export function recommendedActionFromScore(
  score: number,
  germanGap?: ScoreResult['germanGap'],
): { action: 'APPLY' | 'PREPARE FIRST' | 'SKIP'; reason: string } {
  if (score >= 75 && !germanGap) {
    return { action: 'APPLY', reason: 'Profile, experience and the stated language level all fit.' };
  }
  if (score >= 75 && germanGap) {
    return {
      action: 'APPLY',
      reason: `Strong fit, but say openly in the application that German is ${germanGap.has} and that a course to ${germanGap.required} is planned.`,
    };
  }
  if (score >= 50) {
    return {
      action: 'PREPARE FIRST',
      reason: germanGap
        ? `Close the German gap (${germanGap.has} → ${germanGap.required}) or add the missing document before applying.`
        : 'Fill the gaps in the profile first so the application is convincing.',
    };
  }
  return { action: 'SKIP', reason: 'Too far from what this vacancy asks for — better to spend the effort elsewhere.' };
}
