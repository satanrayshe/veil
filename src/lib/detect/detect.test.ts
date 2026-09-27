import { describe, expect, it } from 'vitest'
import { detect, insights } from './engine'
import { maskText, unmaskText, Vault, partialMask } from './mask'
import { aadhaarValid, gstinInfo, luhnValid, panInfo, verhoeffCheckDigit, verhoeffValid } from './validators'

// All identifiers below are fabricated; the Aadhaar numbers are generated to pass Verhoeff.
const AADHAAR = '4918 3527 4063'
const types = (text: string) => detect(text).map((f) => `${f.type}:${f.value}`)

describe('validators', () => {
  it('verhoeff round-trips', () => {
    for (const body of ['23456789012', '49183527406', '87654321098']) {
      expect(verhoeffValid(body + verhoeffCheckDigit(body))).toBe(true)
      expect(verhoeffValid(body + ((verhoeffCheckDigit(body) + 1) % 10))).toBe(false)
    }
  })
  it('aadhaar rejects 0/1 prefixes and bad checksums', () => {
    expect(aadhaarValid(AADHAAR)).toBe(true)
    expect(aadhaarValid('4918 3527 4064')).toBe(false)
    expect(aadhaarValid('1918 3527 4063')).toBe(false)
  })
  it('luhn', () => {
    expect(luhnValid('4111 1111 1111 1111')).toBe(true)
    expect(luhnValid('4111 1111 1111 1112')).toBe(false)
  })
  it('pan holder type', () => {
    expect(panInfo('BQRPM4821K')).toEqual({ valid: true, holder: 'Individual' })
    expect(panInfo('AAACR5055K').holder).toBe('Company')
    expect(panInfo('BQRXM4821K').valid).toBe(false)
  })
  it('gstin checksum', () => {
    expect(gstinInfo('27AAPFU0939F1ZV')).toMatchObject({ valid: true, checksum: true, state: 'Maharashtra' })
    expect(gstinInfo('27AAPFU0939F1ZX').checksum).toBe(false)
  })
})

describe('detect: Indian identifiers', () => {
  it('finds a checksum-valid Aadhaar without any context', () => {
    expect(types(`ref ${AADHAAR} ok`)).toContain(`AADHAAR:${AADHAAR}`)
  })
  it('ignores a random 12-digit number', () => {
    expect(types('order 4918 3527 4064 shipped')).toEqual([])
  })
  it('flags a bad-checksum Aadhaar only with context, at medium confidence', () => {
    const f = detect('Aadhaar: 4918 3527 4064')
    expect(f[0]).toMatchObject({ type: 'AADHAAR', confidence: 'medium' })
  })
  it('PAN, GSTIN (PAN inside GSTIN is not double counted), IFSC, UPI', () => {
    const t = types('PAN BQRPM4821K, GST 27AAPFU0939F1ZV, IFSC HDFC0001234, pay rohan.sample@okaxis')
    expect(t).toEqual(['PAN:BQRPM4821K', 'GSTIN:27AAPFU0939F1ZV', 'IFSC:HDFC0001234', 'UPI:rohan.sample@okaxis'])
  })
  it('phones in many shapes', () => {
    for (const p of ['+91 98765 43210', '+91-9876543210', '09876543210', '98765-43210', '987 654 3210'])
      expect(types(`call ${p} now`)).toContain(`PHONE:${p}`)
  })
  it('email is not mistaken for UPI', () => {
    expect(types('mail rohan@example.com')).toEqual(['EMAIL:rohan@example.com'])
  })
  it('bank account needs context', () => {
    expect(types('A/c no 50100234567891')).toContain('BANK_ACCOUNT:50100234567891')
    expect(types('invoice 50100234567891')).toEqual([])
  })
  it('vehicle, voter id, passport with context', () => {
    expect(types('my car KA 05 MX 2231')).toContain('VEHICLE:KA 05 MX 2231')
    expect(types('Voter ID: XYZ1234567')).toContain('VOTER_ID:XYZ1234567')
    expect(types('Passport No. K4829173')).toContain('PASSPORT:K4829173')
  })
  it('card via Luhn beats Aadhaar-shaped substrings', () => {
    expect(types('card 4111 1111 1111 1111 cvv 123')).toEqual(['CARD:4111 1111 1111 1111', 'CARD:123'])
  })
  it('dob only next to a birth keyword', () => {
    expect(types('DOB: 14/08/1999')).toContain('DOB:14/08/1999')
    expect(types('meeting on 14/08/1999')).toEqual([])
  })
})

describe('detect: secrets', () => {
  it('api keys and tokens', () => {
    const text = [
      'OPENAI_API_KEY=' + ['sk', 'proj', 'abcdefghijklmnopqrstuvwxyz123456'].join('-'),
      'token ' + ['ghp', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ'].join('_'),
      'AKIA' + 'IOSFODNN7EXAMPLE',
      'postgres://admin:hunter22@db.internal:5432/app',
    ].join('\n')
    const f = detect(text).filter((x) => x.type === 'SECRET')
    expect(f.map((x) => x.detail)).toEqual(['OpenAI API key', 'GitHub token', 'AWS access key ID', 'Database URL with password'])
  })
  it('masks only the value of key=value credentials and skips placeholders', () => {
    expect(types('DB_PASSWORD=Tr0ub4dor&3')).toEqual(['SECRET:Tr0ub4dor&3'])
    expect(types('api_key: "your_api_key_here"')).toEqual([])
  })
  it('otp', () => {
    expect(types('Your OTP is 482913. Do not share')).toEqual(['OTP:482913'])
  })
})

describe('detect: names and addresses', () => {
  it('context cues and dictionary names', () => {
    const t = types('Hi team, my name is Rohan Mehta. Priya Sharma will join.')
    expect(t).toContain('PERSON:Rohan Mehta')
    expect(t).toContain('PERSON:Priya Sharma')
  })
  it('propagates a known name to later mentions', () => {
    const f = detect('Name: Venkat Raghunathan\n\nLater, Venkat said yes.').filter((x) => x.type === 'PERSON')
    expect(f.map((x) => x.value)).toEqual(['Venkat Raghunathan', 'Venkat'])
  })
  it('does not treat "Dear Hiring Manager" or "address the issue" as PII', () => {
    expect(types('Dear Hiring Manager, please address the issue.')).toEqual([])
  })
  it('labelled multi-line address stops at the PIN code', () => {
    const f = detect('Address: Flat 402, Lotus Residency,\nHSR Layout, Bengaluru - 560102\nPhone: none')
    expect(f.find((x) => x.type === 'ADDRESS')?.value).toBe('Flat 402, Lotus Residency,\nHSR Layout, Bengaluru - 560102')
  })
  it('two labelled addresses in a row are both found (OCR form layout)', () => {
    const t = 'Permanent address 23, Shanti Kunj, Paldi,\nAhmedabad - 380007\nCurrent address Flat 402, Lotus Residency,\nHSR Layout, Bengaluru - 560102\nEmployer Infosys'
    const a = detect(t).filter((x) => x.type === 'ADDRESS').map((x) => x.value)
    expect(a).toEqual(['23, Shanti Kunj, Paldi,\nAhmedabad - 380007', 'Flat 402, Lotus Residency,\nHSR Layout, Bengaluru - 560102'])
  })
  it('email address label is not a street address', () => {
    expect(types('Email address: a@b.co')).toEqual(['EMAIL:a@b.co'])
  })
})

describe('mask → ask → unmask', () => {
  const text = `I'm Rohan Mehta (Aadhaar ${AADHAAR}, +91 98765 43210). Rohan needs a loan.`
  it('placeholders are consistent and reversible', () => {
    const vault = new Vault()
    const f = detect(text)
    const { text: masked } = maskText(text, f, 'token', vault)
    expect(masked).toBe("I'm [PERSON_1] (Aadhaar [AADHAAR_1], [PHONE_1]). [PERSON_1] needs a loan.")
    const reply = 'Dear [PERSON_1], lenders will verify **PERSON_1** and [Aadhaar 1]. Call from [PHONE_1].'
    const back = unmaskText(reply, vault)
    expect(back.text).toBe(`Dear Rohan Mehta, lenders will verify **Rohan Mehta** and ${AADHAAR}. Call from +91 98765 43210.`)
    expect(back.restored).toBe(4)
    expect(unmaskText('Good luck, PERSON_1 and good day.', vault).text).toBe('Good luck, Rohan Mehta and good day.')
  })
  it('look-alike values are valid-format and reversible', () => {
    const vault = new Vault()
    const { text: masked } = maskText(text, detect(text), 'synthetic', vault)
    expect(masked).not.toContain('Rohan')
    const fakeAadhaar = vault.entries.find((e) => e.type === 'AADHAAR')!.replacement
    expect(aadhaarValid(fakeAadhaar)).toBe(true)
    expect(unmaskText(masked, vault).text).toBe(text)
  })
  it('partial masks follow UIDAI style', () => {
    expect(partialMask('AADHAAR', AADHAAR)).toBe('XXXX XXXX 4063')
    expect(partialMask('EMAIL', 'rohan@example.com')).toBe('r•••n@example.com')
  })
  it('insights explain dangerous combinations', () => {
    expect(insights(detect(text)).map((i) => i.title)).toContain('Aadhaar + phone/DOB')
  })
})
