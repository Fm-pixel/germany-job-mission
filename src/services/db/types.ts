/**
 * Every collection in SPEC section 25, typed.
 * The data layer keeps these plain so the database could be swapped later.
 */

export type Id = string;

export interface BaseDoc {
  id: Id;
  createdAt: string;
  updatedAt: string;
}

export type ConfidenceLabel = 'confirmed' | 'needs-confirmation';
export type SourceLabel = 'CONFIRMED' | 'LIKELY-NEEDS-CONFIRMATION' | 'USER-SPECIFIC';
export type LanguageLevel = 'none' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'native';
export type CandidateTrack = 'A-skilled' | 'B-apprenticeship' | 'unknown';

export type ApplicationStatus =
  | 'Potential'
  | 'Prepared'
  | 'Approved'
  | 'Applied'
  | 'Employer viewed'
  | 'Reply received'
  | 'Interview'
  | 'Second interview'
  | 'Offer'
  | 'Contract'
  | 'Rejected'
  | 'No response';

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'Potential',
  'Prepared',
  'Approved',
  'Applied',
  'Employer viewed',
  'Reply received',
  'Interview',
  'Second interview',
  'Offer',
  'Contract',
  'Rejected',
  'No response',
];

export interface Candidate extends BaseDoc {
  name: string;
  country: string;
  city?: string;
  email?: string;
  phone?: string;
  birthYear?: number;
  profession?: string;
  track: CandidateTrack;
  status: 'active' | 'paused' | 'arrived' | 'archived';
  relocate?: boolean;
  preferredCities?: string[];
  preferredStates?: string[];
  preferredOccupation?: string;
  workingTime?: 'full-time' | 'part-time' | 'either';
  salaryExpectation?: string;
  earliestAvailability?: string;
  notes?: string;
  portalToken?: string;
  portalTokenIssuedAt?: string;
  applicationsSentToday?: number;
  reviewedApplicationCount?: number;
  consentConfirmed?: boolean;
}

export interface NeedsConfirmationItem {
  field: string;
  value: string;
  reason: string;
}

export interface CandidateProfile extends BaseDoc {
  candidateId: Id;
  summary?: string;
  profession?: string;
  skills: string[];
  industries: string[];
  jobTitles: string[];
  yearsExperience?: number;
  qualificationLevel?: 'none' | 'vocational' | 'academic' | 'other';
  confirmed: boolean;
  needsConfirmation: NeedsConfirmationItem[];
  extractedFromDocumentId?: Id;
  extractedAt?: string;
}

export interface Education extends BaseDoc {
  candidateId: Id;
  school: string;
  degree?: string;
  field?: string;
  country?: string;
  graduationYear?: number;
  level?: 'school' | 'vocational' | 'bachelor' | 'master' | 'doctorate' | 'other';
}

export interface Qualification extends BaseDoc {
  candidateId: Id;
  title: string;
  issuer?: string;
  country?: string;
  year?: number;
  type: 'vocational' | 'academic' | 'certificate' | 'other';
  recognitionStatus?: 'unknown' | 'not-started' | 'in-progress' | 'recognised' | 'partly';
}

export interface WorkExperience extends BaseDoc {
  candidateId: Id;
  employer: string;
  title: string;
  from?: string;
  to?: string;
  country?: string;
  description?: string;
}

export interface LanguageSkill extends BaseDoc {
  candidateId: Id;
  language: string;
  level: LanguageLevel;
  certificate?: string;
  certificateDocumentId?: Id;
}

export type DocumentType =
  | 'CV'
  | 'certificate'
  | 'diploma'
  | 'reference'
  | 'language certificate'
  | 'passport'
  | 'contract'
  | 'school certificate'
  | 'other';

export interface StoredDocument extends BaseDoc {
  candidateId: Id;
  type: DocumentType;
  filename: string;
  mimeType: string;
  size: number;
  driveFileId?: string;
  storage: 'drive' | 'local-test';
  localPath?: string;
  textExtracted?: boolean;
}

export interface Company extends BaseDoc {
  name: string;
  industry?: string;
  location?: string;
  website?: string;
  careersUrl?: string;
  applicationMethod?: string;
  contactEmail?: string;
  contactName?: string;
  contactEvidenceUrl?: string;
  isAgency?: boolean;
  discoveredVia?: string;
  notes?: string;
}

export interface Job extends BaseDoc {
  source: string;
  sourceId: string;
  url: string;
  title: string;
  employer: string;
  location?: string;
  state?: string;
  description?: string;
  requirements?: string;
  salary?: string;
  languageRequirement?: LanguageLevel;
  workingTime?: 'full-time' | 'part-time' | 'either';
  kind: 'job' | 'apprenticeship';
  publishedAt?: string;
  discoveredAt: string;
  checkedAt: string;
  active: boolean;
  companyId?: Id;
  scamFlags?: string[];
  detailFetched?: boolean;
}

export interface JobSourceRecord extends BaseDoc {
  key: string;
  name: string;
  status: 'connected' | 'not-connected' | 'error';
  lastRunAt?: string;
  lastError?: string;
  jobsFound?: number;
}

export interface MatchExplanationItem {
  kind: 'positive' | 'warning';
  text: string;
}

export interface MatchBreakdownItem {
  factor: string;
  points: number;
  max: number;
  reason: string;
}

export interface JobMatch extends BaseDoc {
  candidateId: Id;
  jobId: Id;
  score: number;
  breakdown: MatchBreakdownItem[];
  explanation: MatchExplanationItem[];
  recommendedAction: 'APPLY' | 'PREPARE FIRST' | 'SKIP';
  actionReason: string;
  aiExplained: boolean;
  generatedAt: string;
  dismissed?: boolean;
}

export interface StatusHistoryItem {
  status: ApplicationStatus;
  at: string;
  note?: string;
  by: 'me' | 'agent' | 'system';
}

export interface Application extends BaseDoc {
  candidateId: Id;
  jobId?: Id;
  companyId?: Id;
  matchId?: Id;
  status: ApplicationStatus;
  statusHistory: StatusHistoryItem[];
  appliedAt?: string;
  lastContactAt?: string;
  replyAt?: string;
  followUpCount: number;
  speculative?: boolean;
  approvedAt?: string;
  approvedBy?: 'me' | 'policy';
  blockedReason?: string;
  scamFlags?: string[];
}

export interface ApplicationMessage extends BaseDoc {
  applicationId: Id;
  candidateId: Id;
  kind: 'application' | 'follow-up' | 'reply-draft' | 'speculative';
  channel: 'email' | 'linkedin' | 'form';
  language: 'de' | 'en';
  subject: string;
  body: string;
  englishSubject?: string;
  englishBody?: string;
  coverLetter?: string;
  shortMessage?: string;
  attachments: Id[];
  needsInfo: string[];
  approvedAt?: string;
  sentAt?: string;
  editedByMe?: boolean;
}

export interface EmailRecord extends BaseDoc {
  applicationId?: Id;
  candidateId?: Id;
  provider: 'gmail' | 'resend' | 'none';
  direction: 'outbound' | 'inbound';
  messageId?: string;
  threadId?: string;
  to?: string;
  from?: string;
  subject: string;
  body: string;
  sentAt?: string;
  receivedAt?: string;
}

export interface Interview extends BaseDoc {
  applicationId: Id;
  candidateId: Id;
  scheduledAt?: string;
  mode?: 'video' | 'phone' | 'onsite';
  notes?: string;
  prepPack?: InterviewPrepPack;
}

export interface InterviewPrepPack {
  generatedAt: string;
  questions: { de: string; en: string; suggestedAnswer: string }[];
  vocabulary: { de: string; en: string }[];
  questionsToAsk: string[];
  howGermanInterviewsWork: string;
}

export interface ContractRecord extends BaseDoc {
  candidateId: Id;
  applicationId?: Id;
  documentId?: Id;
  kind: 'offer' | 'contract';
  employer?: string;
  jobTitle?: string;
  grossSalary?: string;
  grossSalaryPerYearEur?: number;
  hoursPerWeek?: number;
  location?: string;
  duration?: string;
  startDate?: string;
  probation?: string;
  noticePeriod?: string;
  otherTerms?: string[];
  pointsToVerify: string[];
  extractedAt: string;
}

export interface VisaPathway extends BaseDoc {
  key: string;
  name: string;
  lawRef: string;
  summary: string;
  sourceUrl: string;
  checkedAt: string;
}

export interface VisaRequirement extends BaseDoc {
  pathwayKey: string;
  text: string;
  label: SourceLabel;
  sourceUrl: string;
  checkedAt: string;
}

export interface VisaAssessment extends BaseDoc {
  candidateId: Id;
  pathwayKey: string;
  eligible: 'likely' | 'possible' | 'not-currently';
  reasoning: { text: string; kind: 'positive' | 'warning' | 'blocking'; label: SourceLabel }[];
  documents: string[];
  nextSteps: string[];
  disclaimer: string;
  generatedAt: string;
}

export interface ChecklistItem extends BaseDoc {
  candidateId: Id;
  pathwayKey: string;
  title: string;
  status: 'open' | 'in-progress' | 'done' | 'not-applicable';
  owner: 'me' | 'candidate' | 'employer';
  deadline?: string;
  notes?: string;
  documentId?: Id;
  sourceUrl?: string;
  label: SourceLabel;
}

export interface Opportunity extends BaseDoc {
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
  targetCountries: string[];
  requirements: string[];
  minAge?: number;
  maxAge?: number;
  requiredGerman?: LanguageLevel;
  requiredEnglish?: LanguageLevel;
  requiredEducation?: 'none' | 'school' | 'vocational' | 'academic';
  windowOpens?: string;
  windowCloses?: string;
  nextDeadline?: string;
  checkedAt: string;
  status: 'open' | 'closed' | 'watching';
  label: SourceLabel;
  honestNote?: string;
}

export interface Task extends BaseDoc {
  title: string;
  detail?: string;
  priority: 'red' | 'orange' | 'green';
  candidateId?: Id;
  applicationId?: Id;
  owner: 'me' | 'candidate' | 'employer';
  due?: string;
  state: 'open' | 'done' | 'snoozed';
  snoozedUntil?: string;
  source: 'system' | 'agent' | 'me';
  link?: string;
}

export interface Note extends BaseDoc {
  candidateId?: Id;
  applicationId?: Id;
  text: string;
  author: 'me' | 'agent';
}

export interface SourceRecord extends BaseDoc {
  topic: string;
  url: string;
  checkedAt: string;
  summary?: string;
  contentHash?: string;
  changed?: boolean;
}

export interface AuditLog extends BaseDoc {
  who: string;
  what: string;
  why: string;
  candidateId?: Id;
  applicationId?: Id;
  outcome: 'ok' | 'skipped' | 'blocked' | 'error';
  detail?: string;
  at: string;
}

export interface SettingsDoc extends BaseDoc {
  rulesText?: string;
  rulesHash?: string;
  policy?: unknown;
  policyParsedAt?: string;
  policyParsedBy?: 'ai' | 'fallback';
  followUpDays?: number;
}

export interface Collections {
  candidates: Candidate;
  candidate_profiles: CandidateProfile;
  education: Education;
  qualifications: Qualification;
  work_experience: WorkExperience;
  languages: LanguageSkill;
  documents: StoredDocument;
  companies: Company;
  jobs: Job;
  job_sources: JobSourceRecord;
  job_matches: JobMatch;
  applications: Application;
  application_messages: ApplicationMessage;
  emails: EmailRecord;
  interviews: Interview;
  offers: ContractRecord;
  contracts: ContractRecord;
  visa_pathways: VisaPathway;
  visa_requirements: VisaRequirement;
  visa_assessments: VisaAssessment;
  checklist_items: ChecklistItem;
  opportunities: Opportunity;
  tasks: Task;
  notes: Note;
  sources: SourceRecord;
  audit_logs: AuditLog;
  settings: SettingsDoc;
}

export type CollectionName = keyof Collections;

export const COLLECTION_NAMES: CollectionName[] = [
  'candidates',
  'candidate_profiles',
  'education',
  'qualifications',
  'work_experience',
  'languages',
  'documents',
  'companies',
  'jobs',
  'job_sources',
  'job_matches',
  'applications',
  'application_messages',
  'emails',
  'interviews',
  'offers',
  'contracts',
  'visa_pathways',
  'visa_requirements',
  'visa_assessments',
  'checklist_items',
  'opportunities',
  'tasks',
  'notes',
  'sources',
  'audit_logs',
  'settings',
];
