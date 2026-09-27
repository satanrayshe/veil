export type EntityType =
  | 'AADHAAR'
  | 'AADHAAR_VID'
  | 'PAN'
  | 'GSTIN'
  | 'PASSPORT'
  | 'VOTER_ID'
  | 'DRIVING_LICENSE'
  | 'VEHICLE'
  | 'CARD'
  | 'BANK_ACCOUNT'
  | 'IFSC'
  | 'UPI'
  | 'PHONE'
  | 'EMAIL'
  | 'PERSON'
  | 'ADDRESS'
  | 'PINCODE'
  | 'DOB'
  | 'PLACE'
  | 'ORG'
  | 'IP'
  | 'SECRET'
  | 'OTP'
  | 'CUSTOM'
  | 'QR_CODE'

export type Group = 'identity' | 'financial' | 'contact' | 'personal' | 'secret' | 'custom'

export interface EntityMeta {
  label: string
  /** Name used inside placeholders, e.g. [AADHAAR_1] */
  token: string
  group: Group
  /** 3 = identity-theft grade, 2 = sensitive, 1 = low */
  severity: 1 | 2 | 3
  /** Overlap priority — higher wins when two findings collide. */
  priority: number
}

export const ENTITY: Record<EntityType, EntityMeta> = {
  AADHAAR: { label: 'Aadhaar number', token: 'AADHAAR', group: 'identity', severity: 3, priority: 80 },
  AADHAAR_VID: { label: 'Aadhaar VID', token: 'AADHAAR_VID', group: 'identity', severity: 3, priority: 88 },
  PAN: { label: 'PAN', token: 'PAN', group: 'identity', severity: 3, priority: 75 },
  GSTIN: { label: 'GSTIN', token: 'GSTIN', group: 'financial', severity: 2, priority: 85 },
  PASSPORT: { label: 'Passport number', token: 'PASSPORT', group: 'identity', severity: 3, priority: 70 },
  VOTER_ID: { label: 'Voter ID (EPIC)', token: 'VOTER_ID', group: 'identity', severity: 3, priority: 70 },
  DRIVING_LICENSE: { label: 'Driving licence', token: 'DL', group: 'identity', severity: 3, priority: 72 },
  VEHICLE: { label: 'Vehicle number', token: 'VEHICLE', group: 'personal', severity: 1, priority: 55 },
  CARD: { label: 'Payment card', token: 'CARD', group: 'financial', severity: 3, priority: 90 },
  BANK_ACCOUNT: { label: 'Bank account', token: 'BANK_ACCOUNT', group: 'financial', severity: 3, priority: 50 },
  IFSC: { label: 'IFSC', token: 'IFSC', group: 'financial', severity: 1, priority: 65 },
  UPI: { label: 'UPI ID', token: 'UPI', group: 'financial', severity: 2, priority: 76 },
  PHONE: { label: 'Phone number', token: 'PHONE', group: 'contact', severity: 2, priority: 60 },
  EMAIL: { label: 'Email', token: 'EMAIL', group: 'contact', severity: 2, priority: 78 },
  PERSON: { label: 'Name', token: 'PERSON', group: 'personal', severity: 2, priority: 40 },
  ADDRESS: { label: 'Address', token: 'ADDRESS', group: 'personal', severity: 2, priority: 45 },
  PINCODE: { label: 'PIN code', token: 'PINCODE', group: 'personal', severity: 1, priority: 30 },
  DOB: { label: 'Date of birth', token: 'DOB', group: 'personal', severity: 2, priority: 42 },
  PLACE: { label: 'Place', token: 'PLACE', group: 'personal', severity: 1, priority: 35 },
  ORG: { label: 'Organisation', token: 'ORG', group: 'personal', severity: 1, priority: 35 },
  IP: { label: 'IP address', token: 'IP', group: 'secret', severity: 1, priority: 58 },
  SECRET: { label: 'Secret / API key', token: 'SECRET', group: 'secret', severity: 3, priority: 100 },
  OTP: { label: 'OTP / PIN', token: 'OTP', group: 'secret', severity: 3, priority: 96 },
  CUSTOM: { label: 'Watchlist term', token: 'TERM', group: 'custom', severity: 2, priority: 95 },
  QR_CODE: { label: 'QR code', token: 'QR', group: 'identity', severity: 3, priority: 99 },
}

export const GROUP_LABEL: Record<Group, string> = {
  identity: 'Government ID',
  financial: 'Financial',
  contact: 'Contact',
  personal: 'Personal',
  secret: 'Secrets',
  custom: 'Watchlist',
}

export type Confidence = 'high' | 'medium'
export type Source = 'rule' | 'dictionary' | 'context' | 'ai' | 'custom' | 'manual'

export interface Finding {
  id: string
  type: EntityType
  start: number
  end: number
  value: string
  confidence: Confidence
  /** Human-readable reason, e.g. "Verhoeff checksum valid" */
  reason: string
  source: Source
  /** Extra detail such as card network or secret kind. */
  detail?: string
}

export interface DetectOptions {
  /** Types to skip entirely. */
  disabled?: Set<EntityType>
  /** Extra always-mask terms (company names, project codenames…). */
  watchlist?: string[]
  /** Findings from other engines (AI NER, manual selections) to merge in. */
  extra?: Finding[]
  /** Spans the user explicitly allowed through — keyed by `${type}:${value}`. */
  allow?: Set<string>
}
