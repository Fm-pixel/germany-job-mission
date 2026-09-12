/**
 * Scam protection (SPEC section 21).
 * Runs over every job text and every incoming message before anything is
 * generated or approved. It flags, it never silently deletes.
 */

export interface ScamFlag {
  label: string;
  explanation: string;
  evidence: string;
}

interface Pattern {
  label: string;
  explanation: string;
  test: RegExp;
}

const PATTERNS: Pattern[] = [
  {
    label: 'Payment demanded for a job',
    explanation:
      'Somebody is asking for money in exchange for a job or a placement. Legitimate German employers and the Bundesagentur für Arbeit never charge the applicant.',
    test: /(pay|zahlen|gebühr|fee|charge|überweisen|transfer)\D{0,40}(job|stelle|placement|vermittlung|arbeitsplatz)|(job|stelle|placement)\D{0,40}(fee|gebühr|payment|zahlung)/i,
  },
  {
    label: 'Payment demanded for a visa guarantee',
    explanation:
      'Nobody can sell a visa. Visa decisions are made only by the German embassy or the Ausländerbehörde.',
    test: /(visa|visum)\D{0,40}(guarantee|garantie|guaranteed|garantiert|100%)|(pay|zahlen|fee|gebühr)\D{0,40}(visa|visum)/i,
  },
  {
    label: 'Passport requested by an unknown party',
    explanation:
      'Send passport scans only to the embassy, a known employer or an authority — never to a recruiter you cannot verify.',
    test: /(send|schicken|senden|share|upload)\D{0,40}(passport|reisepass|pass copy|passkopie)/i,
  },
  {
    label: 'Guaranteed visa or job claimed',
    explanation: 'A guarantee is always false. No job and no visa can be guaranteed.',
    test: /(guaranteed|garantiert|100\s?%\s?(sure|sicher|guarantee))\D{0,30}(visa|visum|job|stelle|arbeit)/i,
  },
  {
    label: 'Unrealistic salary',
    explanation:
      'The advertised pay looks far above the normal German range for this kind of work. Verify it against the employer’s own website before applying.',
    test: /(\d{1,3}[.,]?\d{3})\s?(€|eur|euro)\s?(pro\s?monat|per month|monthly|\/\s?monat)/i,
  },
  {
    label: 'Unusual payment requested by a recruiter',
    explanation:
      'Deposits, "training fees", "processing fees" or crypto payments to a recruiter are the classic pattern of a fraud.',
    test: /(western union|moneygram|bitcoin|crypto|usdt|deposit|kaution|processing fee|bearbeitungsgebühr|training fee)/i,
  },
  {
    label: 'Money asked before a contract exists',
    explanation:
      'Money should never move before a signed employment contract exists — and even then never to a private person.',
    test: /(advance payment|vorauszahlung|anzahlung|upfront payment)/i,
  },
];

const UNREALISTIC_MONTHLY_EUR = 12000;

export function scanForScamPatterns(text: string | undefined | null): ScamFlag[] {
  if (!text) return [];
  const flags: ScamFlag[] = [];
  for (const pattern of PATTERNS) {
    const match = pattern.test.exec(text);
    if (!match) continue;
    if (pattern.label === 'Unrealistic salary') {
      const amount = Number(match[1].replace(/[.,]/g, ''));
      if (!Number.isFinite(amount) || amount < UNREALISTIC_MONTHLY_EUR) continue;
    }
    flags.push({
      label: pattern.label,
      explanation: pattern.explanation,
      evidence: match[0].slice(0, 160),
    });
  }
  return flags;
}

export const SCAM_ADVICE =
  'Verify this through an official source before you act: the employer’s own website, the Bundesagentur für Arbeit, or the German embassy. Never pay anyone for a job or a visa, and never send your passport to a party you cannot verify.';
