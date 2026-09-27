// Checksum and structure validators for Indian and global identifiers.
// Pure functions, no dependencies — these are what let Veil flag an Aadhaar
// number with confidence instead of guessing from "12 digits".

const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
]
const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
]
const VERHOEFF_INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9]

export const digitsOnly = (s: string) => s.replace(/\D/g, '')

/** Verhoeff checksum — used by UIDAI for Aadhaar numbers and VIDs. */
export function verhoeffValid(num: string): boolean {
  const digits = digitsOnly(num)
  if (!digits) return false
  let c = 0
  const rev = digits.split('').reverse()
  for (let i = 0; i < rev.length; i++) c = VERHOEFF_D[c][VERHOEFF_P[i % 8][+rev[i]]]
  return c === 0
}

/** Computes the Verhoeff check digit to append to `num`. */
export function verhoeffCheckDigit(num: string): number {
  let c = 0
  const rev = digitsOnly(num).split('').reverse()
  for (let i = 0; i < rev.length; i++) c = VERHOEFF_D[c][VERHOEFF_P[(i + 1) % 8][+rev[i]]]
  return VERHOEFF_INV[c]
}

/** Aadhaar: 12 digits, never starts with 0 or 1, Verhoeff-valid. */
export function aadhaarValid(num: string): boolean {
  const d = digitsOnly(num)
  return d.length === 12 && /^[2-9]/.test(d) && verhoeffValid(d)
}

/** Luhn (mod 10) — payment cards. */
export function luhnValid(num: string): boolean {
  const d = digitsOnly(num)
  if (d.length < 12) return false
  let sum = 0
  let dbl = false
  for (let i = d.length - 1; i >= 0; i--) {
    let n = +d[i]
    if (dbl) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    dbl = !dbl
  }
  return sum % 10 === 0
}

export function cardNetwork(num: string): string | null {
  const d = digitsOnly(num)
  if (/^4/.test(d)) return 'Visa'
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(d)) return 'Mastercard'
  if (/^3[47]/.test(d)) return 'Amex'
  if (/^(508[5-9]|6069|607|608|652[1-9]|6530|81|82)/.test(d)) return 'RuPay'
  if (/^(6011|65|64[4-9])/.test(d)) return 'Discover'
  if (/^35(2[89]|[3-8])/.test(d)) return 'JCB'
  if (/^3(0[0-5]|[68])/.test(d)) return 'Diners'
  if (/^(50|5[6-9]|6)/.test(d)) return 'Maestro'
  return null
}

const PAN_HOLDER: Record<string, string> = {
  P: 'Individual',
  C: 'Company',
  H: 'HUF',
  F: 'Firm / LLP',
  A: 'Association of persons',
  T: 'Trust',
  B: 'Body of individuals',
  L: 'Local authority',
  J: 'Artificial juridical person',
  G: 'Government',
}

/** PAN: AAAAA9999A where the 4th letter encodes the holder type. */
export function panInfo(pan: string): { valid: boolean; holder?: string } {
  const p = pan.toUpperCase()
  if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(p)) return { valid: false }
  const holder = PAN_HOLDER[p[3]]
  if (!holder) return { valid: false }
  // All-zero serials are not issued.
  if (p.slice(5, 9) === '0000') return { valid: false }
  return { valid: true, holder }
}

const GST_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** GSTIN mod-36 check character over the first 14 characters. */
export function gstinCheckChar(first14: string): string {
  let sum = 0
  const s = first14.toUpperCase()
  for (let i = 0; i < 14; i++) {
    const v = GST_CHARS.indexOf(s[i])
    if (v < 0) return '?'
    const prod = v * (i % 2 === 0 ? 1 : 2)
    sum += Math.floor(prod / 36) + (prod % 36)
  }
  return GST_CHARS[(36 - (sum % 36)) % 36]
}

export const GST_STATES: Record<string, string> = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
  '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur',
  '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
  '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa',
  '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry',
  '35': 'Andaman & Nicobar', '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh',
  '97': 'Other territory', '99': 'Centre jurisdiction',
}

export function gstinInfo(gstin: string): { valid: boolean; state?: string; checksum: boolean } {
  const g = gstin.toUpperCase()
  if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) return { valid: false, checksum: false }
  const state = GST_STATES[g.slice(0, 2)]
  const checksum = gstinCheckChar(g.slice(0, 14)) === g[14]
  return { valid: !!state && panInfo(g.slice(2, 12)).valid, state, checksum }
}

export const IFSC_BANKS: Record<string, string> = {
  SBIN: 'State Bank of India', HDFC: 'HDFC Bank', ICIC: 'ICICI Bank', UTIB: 'Axis Bank',
  PUNB: 'Punjab National Bank', BARB: 'Bank of Baroda', CNRB: 'Canara Bank', KKBK: 'Kotak Mahindra Bank',
  UBIN: 'Union Bank of India', BKID: 'Bank of India', IDIB: 'Indian Bank', IOBA: 'Indian Overseas Bank',
  CBIN: 'Central Bank of India', UCBA: 'UCO Bank', YESB: 'Yes Bank', INDB: 'IndusInd Bank',
  IDFB: 'IDFC First Bank', FDRL: 'Federal Bank', KARB: 'Karnataka Bank', KVBL: 'Karur Vysya Bank',
  AUBL: 'AU Small Finance Bank', RATN: 'RBL Bank', SIBL: 'South Indian Bank', MAHB: 'Bank of Maharashtra',
  PSIB: 'Punjab & Sind Bank', IBKL: 'IDBI Bank', CIUB: 'City Union Bank', TMBL: 'Tamilnad Mercantile Bank',
  DBSS: 'DBS Bank', HSBC: 'HSBC', SCBL: 'Standard Chartered', CITI: 'Citibank', PYTM: 'Paytm Payments Bank',
  AIRP: 'Airtel Payments Bank', FINO: 'Fino Payments Bank', ESFB: 'Equitas SFB', UJVN: 'Ujjivan SFB',
  JAKA: 'J&K Bank', DLXB: 'Dhanlaxmi Bank', CSBK: 'CSB Bank', NTBL: 'Nainital Bank', BDBL: 'Bandhan Bank',
}

export function ipv4Info(ip: string): { valid: boolean; private?: boolean } {
  const parts = ip.split('.')
  if (parts.length !== 4) return { valid: false }
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) && (p === '0' || !p.startsWith('0')) ? +p : -1))
  if (nums.some((n) => n < 0 || n > 255)) return { valid: false }
  const [a, b] = nums
  const priv = a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)
  return { valid: true, private: priv }
}

export const VEHICLE_STATES = new Set(
  'AN AP AR AS BR CH CG DD DL DN GA GJ HR HP JK JH KA KL LA LD MP MH MN ML MZ NL OD OR PY PB RJ SK TN TS TR UP UK UA WB'.split(' '),
)
