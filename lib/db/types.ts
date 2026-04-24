/**
 * DB 行类型导出（spec-database-design §4.2）
 * Select = 查询返回；Insert = values() 接受
 */
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

import type {
  account,
  auditLog,
  manuscript,
  paragraph,
  promptVersion,
  quote,
  reference,
  referenceParagraph,
  reportSnapshot,
  resultReferenceHit,
  session,
  task,
  user,
  userAgreementAcceptance,
  verification,
  verificationResult,
} from './schema';

export type User = InferSelectModel<typeof user>;
export type NewUser = InferInsertModel<typeof user>;

export type Session = InferSelectModel<typeof session>;
export type NewSession = InferInsertModel<typeof session>;

export type Account = InferSelectModel<typeof account>;
export type NewAccount = InferInsertModel<typeof account>;

export type Verification = InferSelectModel<typeof verification>;
export type NewVerification = InferInsertModel<typeof verification>;

export type Manuscript = InferSelectModel<typeof manuscript>;
export type NewManuscript = InferInsertModel<typeof manuscript>;

export type Paragraph = InferSelectModel<typeof paragraph>;
export type NewParagraph = InferInsertModel<typeof paragraph>;

export type Quote = InferSelectModel<typeof quote>;
export type NewQuote = InferInsertModel<typeof quote>;

export type Reference = InferSelectModel<typeof reference>;
export type NewReference = InferInsertModel<typeof reference>;

export type ReferenceParagraph = InferSelectModel<typeof referenceParagraph>;
export type NewReferenceParagraph = InferInsertModel<typeof referenceParagraph>;

export type Task = InferSelectModel<typeof task>;
export type NewTask = InferInsertModel<typeof task>;

export type VerificationResult = InferSelectModel<typeof verificationResult>;
export type NewVerificationResult = InferInsertModel<typeof verificationResult>;

export type ResultReferenceHit = InferSelectModel<typeof resultReferenceHit>;
export type NewResultReferenceHit = InferInsertModel<typeof resultReferenceHit>;

export type ReportSnapshot = InferSelectModel<typeof reportSnapshot>;
export type NewReportSnapshot = InferInsertModel<typeof reportSnapshot>;

export type AuditLog = InferSelectModel<typeof auditLog>;
export type NewAuditLog = InferInsertModel<typeof auditLog>;

export type UserAgreementAcceptance = InferSelectModel<typeof userAgreementAcceptance>;
export type NewUserAgreementAcceptance = InferInsertModel<typeof userAgreementAcceptance>;

export type PromptVersion = InferSelectModel<typeof promptVersion>;
export type NewPromptVersion = InferInsertModel<typeof promptVersion>;
