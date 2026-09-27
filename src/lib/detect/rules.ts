import type { Confidence, EntityType } from './types'
import {
  aadhaarValid,
  cardNetwork,
  digitsOnly,
  gstinInfo,
  IFSC_BANKS,
  ipv4Info,
  luhnValid,
  panInfo,
  VEHICLE_STATES,
  verhoeffValid,
} from './validators'

export interface RuleHit {
  confidence: Confidence
  reason: string
  detail?: string
  /** Offsets relative to the regex match, for rules that only mask a capture. */
  start?: number
  end?: number
}

export interface Rule {
  type: EntityType
  re: RegExp
  verify: (m: RegExpExecArray, text: string) => RuleHit | null
}

/** True when any keyword appears within `before` chars ahead of the match (or `after` chars behind it). */
export function near(text: string, start: number, end: number, words: RegExp, before = 48, after = 0): boolean {
  const lo = Math.max(0, start - before)
  const hi = Math.min(text.length, end + after)
  return words.test(text.slice(lo, start)) || (after > 0 && words.test(text.slice(end, hi)))
}

const B = '(?<![A-Za-z0-9])' // start boundary that treats digits and letters alike
const E = '(?![A-Za-z0-9])'

const CTX = {
  aadhaar: /aadh?aa?r|\buid\b|uidai|आधार/i,
  vid: /\bvid\b|virtual\s*id/i,
  phone: /phone|mobile|\bmob\b|\bph\b|\btel\b|call|whats\s?app|contact|\bcell\b|फ़ोन|मोबाइल/i,
  bank: /a\/c|\bacc(?:oun)?t?\b|account|acct|\bbank\b|savings|current\s+a|खाता/i,
  upi: /\bupi\b|\bvpa\b|g\s?pay|phone\s?pe|paytm|bhim|pay\s+(?:to|me|at)|send\s+(?:money|payment)/i,
  passport: /passport|पासपोर्ट/i,
  voter: /voter|\bepic\b|election/i,
  dl: /driving|licen[cs]e|\bdl\b/i,
  vehicle: /vehicle|\bcar\b|bike|scooter|\breg(?:istration)?\b|number\s*plate|\brc\b/i,
  dob: /\bd\.?\s?o\.?\s?b\b|date\s+of\s+birth|birth\s*date|\bborn\b|\bbirthday\b|\byob\b|जन्म/i,
  pin: /\bpin\b|pin\s*code|pincode|postal|\bzip\b|address|nagar|colony|layout|road|street|sector|lane|district|\bdist\b|taluk|village|city|bengaluru|bangalore|mumbai|delhi|chennai|kolkata|hyderabad|pune|ahmedabad|jaipur|lucknow|noida|gurugram|gurgaon|kochi|chandigarh|indore|bhopal|nagpur|surat|patna|thane|mysuru|coimbatore|vizag|visakhapatnam|kerala|karnataka|maharashtra|tamil\s*nadu|telangana|gujarat|rajasthan|punjab|haryana|bihar|odisha|assam/i,
  aws: /aws|secret[_\s-]?access|access[_\s-]?key/i,
  gst: /\bgst/i,
}

const UPI_HANDLES = new Set(
  `okaxis okhdfcbank okicici oksbi ybl ibl axl paytm pthdfc ptsbi ptyes ptaxis upi apl yapl rapl
  abfspay axisbank axisb icici sbi hdfcbank kotak kmbl federal fbl idfcbank idfcfirst ikwik
  jupiteraxis freecharge airtel jio slice waaxis wahdfcbank wasbi waicici pingpay yesbank
  yesbankltd indus aubank barodampay cnrb pnb boi unionbank uboi allbank centralbank cboi dbs
  equitas hsbc idbi indianbank iob kvb mahb rbl sib ucobank kbl citi dcb superyes naviaxis
  niyoicici zoicici goaxb tapicici pockets amazonpay postbank`.split(/\s+/),
)

const PLACEHOLDER_VALUE = /^(?:x+|\*+|\.+|<.*>|\{.*\}|\$\{.*\}|your[_-].*|changeme|example|test|none|null|undefined|process\.env.*|os\.environ.*|env\(.*)$/i

const SECRET_PATTERNS: [RegExp, string][] = [
  [/-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----[\s\S]+?-----END (?:[A-Z0-9]+ )*PRIVATE KEY-----/g, 'Private key'],
  [/\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|rediss|amqps?|mssql):\/\/[^\s:@/]+:[^\s@/]+@[^\s'"`<>]+/g, 'Database URL with password'],
  [/\bsk-ant-(?:api|admin)\d{2}-[A-Za-z0-9_-]{20,}/g, 'Anthropic API key'],
  [/\bsk-(?!ant-)(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}/g, 'OpenAI API key'],
  [/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,255}\b/g, 'GitHub token'],
  [/\bgithub_pat_[A-Za-z0-9_]{22,255}\b/g, 'GitHub fine-grained token'],
  [/\bglpat-[A-Za-z0-9_-]{20,}\b/g, 'GitLab token'],
  [/\b(?:AKIA|ASIA|AGPA|AIDA|AROA|ANPA|ANVA|AIPA)[0-9A-Z]{16}\b/g, 'AWS access key ID'],
  [/\bAIza[0-9A-Za-z_-]{35}\b/g, 'Google API key'],
  [/\bGOCSPX-[A-Za-z0-9_-]{28}\b/g, 'Google OAuth secret'],
  [/\bxox[baprse]-[A-Za-z0-9-]{10,}\b/g, 'Slack token'],
  [/https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+/g, 'Slack webhook'],
  [/https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+/g, 'Discord webhook'],
  [/\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g, 'Stripe secret key'],
  [/\brzp_(?:live|test)_[A-Za-z0-9]{14,}\b/g, 'Razorpay key'],
  [/\bhf_[A-Za-z0-9]{30,}\b/g, 'Hugging Face token'],
  [/\bnpm_[A-Za-z0-9]{36}\b/g, 'npm token'],
  [/\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/g, 'SendGrid key'],
  [/\bSK[0-9a-f]{32}\b/g, 'Twilio API key'],
  [/\b\d{8,10}:AA[A-Za-z0-9_-]{33}\b/g, 'Telegram bot token'],
  [/\b[MNO][A-Za-z\d]{23,25}\.[\w-]{6}\.[\w-]{27,38}\b/g, 'Discord bot token'],
  [/\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, 'JWT'],
]

export const RULES: Rule[] = [
  // ---------- Secrets (highest priority — checked on raw text) ----------
  ...SECRET_PATTERNS.map(
    ([re, kind]): Rule => ({
      type: 'SECRET',
      re,
      verify: () => ({ confidence: 'high', reason: `Matches ${kind} format`, detail: kind }),
    }),
  ),
  {
    // key = value assignments in code/config: mask only the value
    type: 'SECRET',
    re: /(?<![A-Za-z])(?:password|passwd|pwd|secret|client[_-]?secret|api[_-]?key|apikey|access[_-]?token|auth[_-]?token|refresh[_-]?token|private[_-]?key|secret[_-]?key|db[_-]?pass(?:word)?|aws_secret_access_key)(?![A-Za-z])["']?\s*[:=]\s*["'`]?([^\s"'`,;)]{6,})/gi,
    verify: (m) => {
      const val = m[1]
      if (PLACEHOLDER_VALUE.test(val)) return null
      const off = m[0].lastIndexOf(val)
      return { confidence: 'medium', reason: 'Value assigned to a credential-named key', detail: 'Credential', start: off, end: off + val.length }
    },
  },
  {
    // "my password is hunter2"
    type: 'SECRET',
    re: /\b(?:password|passcode|login pin|atm pin|upi pin|mpin)\s+(?:is|was|=|:|-)\s*["']?(\S{4,64})/gi,
    verify: (m) => {
      const val = m[1].replace(/[.,;!?"']+$/, '')
      if (val.length < 4 || PLACEHOLDER_VALUE.test(val)) return null
      const off = m[0].lastIndexOf(val)
      return { confidence: 'high', reason: 'Password written in plain text', detail: 'Password', start: off, end: off + val.length }
    },
  },
  {
    type: 'OTP',
    re: /\b(?:otp|one[\s-]time\s+password|verification\s+code|security\s+code|auth(?:entication)?\s+code)\b[^\d\n]{0,24}(\d{4,8})(?!\d)/gi,
    verify: (m) => {
      const off = m[0].lastIndexOf(m[1])
      return { confidence: 'high', reason: 'One-time password next to an OTP keyword', start: off, end: off + m[1].length }
    },
  },
  {
    type: 'CARD',
    re: /\b(?:cvv2?|cvc|card\s+verification)\b\s*(?:no\.?|number|code)?\s*[:#-]?\s*(\d{3,4})(?!\d)/gi,
    verify: (m) => {
      const off = m[0].lastIndexOf(m[1])
      return { confidence: 'high', reason: 'Card security code', detail: 'CVV', start: off, end: off + m[1].length }
    },
  },

  // ---------- Government identity ----------
  {
    type: 'AADHAAR_VID',
    re: new RegExp(`${B}\\d{4}([ -]?)\\d{4}\\1\\d{4}\\1\\d{4}${E}`, 'g'),
    verify: (m, t) => {
      if (!near(t, m.index, m.index + m[0].length, CTX.vid, 40)) return null
      return verhoeffValid(m[0])
        ? { confidence: 'high', reason: 'Verhoeff checksum valid, next to "VID"' }
        : { confidence: 'medium', reason: '16 digits next to "VID"' }
    },
  },
  {
    type: 'AADHAAR',
    re: new RegExp(`${B}[2-9]\\d{3}([ .-]?)\\d{4}\\1\\d{4}${E}`, 'g'),
    verify: (m, t) => {
      if (aadhaarValid(m[0])) return { confidence: 'high', reason: 'Verhoeff checksum valid (UIDAI algorithm)' }
      if (near(t, m.index, m.index + m[0].length, CTX.aadhaar, 40))
        return { confidence: 'medium', reason: 'Next to "Aadhaar" but checksum fails — typo or OCR error?' }
      return null
    },
  },
  {
    type: 'PAN',
    re: new RegExp(`${B}[A-Za-z]{5}\\d{4}[A-Za-z]${E}`, 'g'),
    verify: (m) => {
      const info = panInfo(m[0])
      if (!info.valid) return null
      // lower-case PAN-shaped strings are rare but real; keep them at medium
      const upper = m[0] === m[0].toUpperCase()
      return { confidence: upper ? 'high' : 'medium', reason: `Valid PAN structure · holder: ${info.holder}`, detail: info.holder }
    },
  },
  {
    type: 'GSTIN',
    re: new RegExp(`${B}\\d{2}[A-Za-z]{5}\\d{4}[A-Za-z][1-9A-Za-z][Zz][0-9A-Za-z]${E}`, 'g'),
    verify: (m, t) => {
      const info = gstinInfo(m[0])
      if (info.valid && info.checksum) return { confidence: 'high', reason: `Mod-36 checksum valid · ${info.state}`, detail: info.state }
      if (info.valid || near(t, m.index, m.index + m[0].length, CTX.gst, 30))
        return { confidence: 'medium', reason: 'GSTIN shape, checksum fails', detail: info.state }
      return null
    },
  },
  {
    type: 'PASSPORT',
    re: new RegExp(`${B}[A-PR-WYa-pr-wy][1-9]\\d\\s?\\d{4}[1-9]${E}`, 'g'),
    verify: (m, t) =>
      near(t, m.index, m.index + m[0].length, CTX.passport, 60)
        ? { confidence: 'high', reason: 'Indian passport format next to "passport"' }
        : null,
  },
  {
    type: 'VOTER_ID',
    re: new RegExp(`${B}[A-Z]{3}\\d{7}${E}`, 'g'),
    verify: (m, t) =>
      near(t, m.index, m.index + m[0].length, CTX.voter, 60)
        ? { confidence: 'high', reason: 'EPIC format next to "voter"' }
        : { confidence: 'medium', reason: 'Matches EPIC (voter ID) format' },
  },
  {
    type: 'DRIVING_LICENSE',
    re: new RegExp(`${B}([A-Z]{2})[ -]?\\d{2}[ -]?(?:19|20)\\d{2}[ -]?\\d{7}${E}`, 'g'),
    verify: (m, t) => {
      if (!VEHICLE_STATES.has(m[1])) return null
      return near(t, m.index, m.index + m[0].length, CTX.dl, 60)
        ? { confidence: 'high', reason: 'DL format next to "licence"' }
        : { confidence: 'medium', reason: 'Matches Indian DL format' }
    },
  },
  {
    type: 'VEHICLE',
    re: new RegExp(`${B}(?:([A-Z]{2})[ -]?\\d{1,2}[ -]?[A-Z]{1,3}[ -]?\\d{4}|\\d{2}[ -]?BH[ -]?\\d{4}[ -]?[A-Z]{1,2})${E}`, 'g'),
    verify: (m, t) => {
      if (m[1] && !VEHICLE_STATES.has(m[1])) return null
      return near(t, m.index, m.index + m[0].length, CTX.vehicle, 40)
        ? { confidence: 'high', reason: 'Registration plate next to vehicle keyword' }
        : { confidence: 'medium', reason: 'Matches Indian registration plate format' }
    },
  },

  // ---------- Financial ----------
  {
    type: 'CARD',
    re: /(?<![\d-])\d(?:[ -]?\d){12,18}(?![\d-])/g,
    verify: (m) => {
      const d = digitsOnly(m[0])
      if (d.length < 13 || d.length > 19 || !luhnValid(d)) return null
      const net = cardNetwork(d)
      if (!net) return null
      return { confidence: 'high', reason: `Luhn checksum valid · ${net}`, detail: net }
    },
  },
  {
    type: 'IFSC',
    re: new RegExp(`${B}[A-Za-z]{4}0[A-Za-z0-9]{6}${E}`, 'g'),
    verify: (m) => {
      const bank = IFSC_BANKS[m[0].slice(0, 4).toUpperCase()]
      if (bank) return { confidence: 'high', reason: `IFSC · ${bank}`, detail: bank }
      return m[0] === m[0].toUpperCase() ? { confidence: 'medium', reason: 'Matches IFSC format' } : null
    },
  },
  {
    type: 'UPI',
    re: /(?<![\w.@-])[a-zA-Z0-9][a-zA-Z0-9._-]{1,255}@([a-zA-Z]{2,64})(?![\w@-]|\.[a-zA-Z])/g,
    verify: (m, t) => {
      const handle = m[1].toLowerCase()
      if (UPI_HANDLES.has(handle)) return { confidence: 'high', reason: `Known UPI handle @${handle}`, detail: handle }
      if (near(t, m.index, m.index + m[0].length, CTX.upi, 40)) return { confidence: 'medium', reason: 'Handle-style ID next to a UPI keyword' }
      return null
    },
  },
  {
    type: 'BANK_ACCOUNT',
    re: new RegExp(`${B}\\d{9,18}${E}`, 'g'),
    verify: (m, t) =>
      near(t, m.index, m.index + m[0].length, CTX.bank, 40)
        ? { confidence: 'high', reason: 'Long number next to an account keyword' }
        : null,
  },

  // ---------- Contact ----------
  {
    type: 'EMAIL',
    re: /(?<![\w.+-])[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,24}(?![\w-])/g,
    verify: () => ({ confidence: 'high', reason: 'Email address' }),
  },
  {
    type: 'PHONE',
    re: /(?<![\w+])(?:(?:\+|00)91[\s.-]?|91[\s.-]|0)?[6-9](?:[\s.-]?\d){9}(?!\w)/g,
    verify: (m, t) => {
      const d = digitsOnly(m[0]).replace(/^(?:0091|91|0)(?=\d{10}$)/, '')
      if (d.length !== 10) return null
      if (/^(\d)\1{9}$/.test(d)) return null
      const prefixed = /^(?:\+|00)?91|^0/.test(m[0].trim()) && digitsOnly(m[0]).length > 10
      if (prefixed || near(t, m.index, m.index + m[0].length, CTX.phone, 40))
        return { confidence: 'high', reason: prefixed ? 'Indian mobile with country code' : 'Indian mobile next to a phone keyword' }
      return { confidence: 'medium', reason: '10-digit Indian mobile format' }
    },
  },
  {
    type: 'PHONE',
    re: /(?<![\w+])\+(?!91)[1-9]\d{0,2}[\s.-]?\(?\d{1,4}\)?(?:[\s.-]?\d{2,4}){2,4}(?!\w)/g,
    verify: (m) => {
      const n = digitsOnly(m[0]).length
      return n >= 8 && n <= 15 ? { confidence: 'high', reason: 'International phone number', detail: 'International' } : null
    },
  },

  // ---------- Personal ----------
  {
    type: 'DOB',
    re: /\b(?:(?:0?[1-9]|[12]\d|3[01])[/.-](?:0?[1-9]|1[0-2])[/.-](?:19|20)\d{2}|(?:19|20)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])|(?:0?[1-9]|[12]\d|3[01])(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*,?\s+(?:19|20)\d{2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+(?:0?[1-9]|[12]\d|3[01])(?:st|nd|rd|th)?,?\s+(?:19|20)\d{2})\b/gi,
    verify: (m, t) =>
      near(t, m.index, m.index + m[0].length, CTX.dob, 40)
        ? { confidence: 'high', reason: 'Date next to a birth-date keyword' }
        : null,
  },
  {
    type: 'ADDRESS',
    re: /\b(?:(?:permanent|current|residential|correspondence|home|postal|billing|shipping|delivery)\s+)?(address|addr\.?|residing\s+at|resident\s+of|lives?\s+at|r\/o)(?![a-z])(\s*[:\-–]\s*|[ \t]+)([^\n]{6,})((?:\n(?![^\n]{0,30}:)[^\n]{3,80}){0,2})/gi,
    verify: (m, t) => {
      // "email address: …", "IP address …" are not street addresses
      if (/(?:e-?mail|\bip|\bmac|\bweb|wallet|\burl|server|memory)\s*$/i.test(t.slice(Math.max(0, m.index - 12), m.index))) return null
      const label = m[1].toLowerCase()
      const hasSep = /[:\-–]/.test(m[2])
      // "please address the issue" — the verb, not a location
      if (label.startsWith('addr') && !hasSep && !/\d/.test(m[3])) return null
      if (!label.startsWith('addr') && !hasSep && !/[\d,]/.test(m[3])) return null
      // Stretch over up to two continuation lines (form layouts), stopping at the PIN code.
      let body = m[3] + (m[4] || '')
      const pin = /(?<!\d)[1-9]\d{2}\s?\d{3}(?!\d)/.exec(body)
      body = pin ? body.slice(0, pin.index + pin[0].length) : m[3]
      body = body.replace(/[\s,.;]+$/, '')
      if (body.replace(/\W/g, '').length < 6) return null
      const off = m[1].length + m[2].length + m[0].indexOf(m[1])
      return { confidence: 'high', reason: 'Text following an address label', start: off, end: off + body.length }
    },
  },
  {
    type: 'ADDRESS',
    re: /(?:\b(?:flat|house|h\.?\s?no\.?|plot|door|apt\.?|apartment|villa|room)|#)\s*(?:no\.?\s*)?[\w/-]*\d[\w/-]*[^\n]{3,140}?(?<!\d)[1-9]\d{2}\s?\d{3}(?!\d)/gi,
    verify: () => ({ confidence: 'high', reason: 'Street address ending in a PIN code' }),
  },
  {
    type: 'PINCODE',
    re: /(?<![\d,.])[1-9]\d{2}\s?\d{3}(?![\d,.]\d|\d)/g,
    verify: (m, t) =>
      near(t, m.index, m.index + m[0].length, CTX.pin, 50)
        ? { confidence: 'medium', reason: 'Six-digit PIN next to an address word' }
        : null,
  },
  {
    type: 'IP',
    re: /(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.]|\.\d)/g,
    verify: (m) => {
      const info = ipv4Info(m[0])
      if (!info.valid) return null
      return info.private
        ? { confidence: 'medium', reason: 'Private/internal IPv4 address', detail: 'Private' }
        : { confidence: 'high', reason: 'Public IPv4 address', detail: 'Public' }
    },
  },
]
