// Demo content. Every identifier here is fictional; the Aadhaar number is generated
// to pass the checksum. Key-shaped strings are assembled at runtime so the source
// never contains anything a secret scanner would mistake for a real credential.

const k = (...parts: string[]) => parts.join('')

export const TEXT_SAMPLES: { id: string; label: string; text: string }[] = [
  {
    id: 'loan',
    label: 'Loan query',
    text: `Hi, I'm Rohan Mehta, 29, working at Infosys in Pune. I want a personal loan of ₹5 lakh.

My PAN is BQRPM4821K, Aadhaar 4918 3527 4063, DOB 14/08/1996. Salary comes into my HDFC a/c 50100234567891 (IFSC HDFC0001234). I can afford an EMI of about ₹15,000.

Which banks should I apply to, and what documents will they ask for? Reply to rohan.mehta@example.com or call +91 98765 43210.`,
  },
  {
    id: 'job',
    label: 'Cover letter',
    text: `Please make this cover letter sound more confident, keep it under 200 words.

Dear Hiring Manager,

I am Ananya Krishnamurthy, a final-year B.Tech student at VJTI Mumbai. I built a UPI expense tracker used by 300 students and interned at Zeta as a backend developer.

I live at Flat 12B, Palm Grove Apartments, Andheri West, Mumbai 400053 and can join from June.

Regards,
Ananya Krishnamurthy
+91 91234 56780 · ananya.k@example.com`,
  },
  {
    id: 'code',
    label: 'Bug report with keys',
    text: `My Node app can't reach Postgres in production. Here's my .env and the error. What's wrong?

DATABASE_URL=${k('postgres', '://admin:', 'S3cure!Pass', '@db.prod.internal:5432/orders')}
OPENAI_API_KEY=${k('sk-', 'proj-', '9fQx2LmR7vT1pZk4NwY8aB3cD5eF6gH7iJ0kL')}
RAZORPAY_KEY_ID=${k('rzp_', 'live_', '3Kx9PqR2mT7vLw')}
JWT_SECRET=${k('hunter2', '-but-longer-9921')}

Server 13.234.56.78, alerts go to devops@example.com

Error: connect ETIMEDOUT 13.234.56.78:5432`,
  },
  {
    id: 'scam',
    label: '“Bank” caller',
    text: `Someone from my bank called about a wrong charge. To reverse it they asked me to read out the OTP 482913 and my card 4111 1111 1111 1111 with CVV 123. They also want my UPI ID rohan.sample@okaxis to send the refund.

Is this normal? What should I say when they call back?`,
  },
]

export const DOC_SAMPLES: { id: string; label: string; file: string; type: string }[] = [
  { id: 'tenant', label: 'Tenant form (phone photo)', file: 'samples/tenant-form.jpg', type: 'image/jpeg' },
  { id: 'statement', label: 'Bank statement (PDF)', file: 'samples/bank-statement.pdf', type: 'application/pdf' },
]

export async function fetchSample(id: string): Promise<File | null> {
  const s = DOC_SAMPLES.find((d) => d.id === id)
  if (!s) return null
  const res = await fetch(`${import.meta.env.BASE_URL}${s.file}`)
  if (!res.ok) return null
  return new File([await res.blob()], s.file.split('/').pop()!, { type: s.type })
}
