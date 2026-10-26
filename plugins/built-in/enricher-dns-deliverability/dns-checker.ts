import dns from 'dns/promises'

export interface DnsDeliverabilityResult {
  domain: string
  has_mx: boolean
  has_spf: boolean
  has_dmarc: boolean
  mail_provider: string
  deliverability_score: number
  mx_records: string[]
  errors: string[]
}

async function withTimeout<T>(promise: Promise<T>, ms = 5000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('DNS resolution timeout')), ms))
  ])
}

export async function checkDomainDeliverability(domainOrEmail: string, simulate = false): Promise<DnsDeliverabilityResult> {
  let domain = domainOrEmail.trim().toLowerCase()
  if (domain.includes('@')) {
    domain = domain.split('@')[1]
  } else if (domain.includes('://')) {
    try {
      domain = new URL(domain).hostname
    } catch {}
  }
  domain = domain.replace(/^www\./, '').split('/')[0].split(':')[0].trim()

  if (simulate) {
    return {
      domain: domain || 'simulated-domain.com',
      has_mx: true,
      has_spf: true,
      has_dmarc: true,
      mail_provider: 'Google Workspace',
      deliverability_score: 95,
      mx_records: ['aspmx.l.google.com', 'alt1.aspmx.l.google.com'],
      errors: [],
    }
  }

  const result: DnsDeliverabilityResult = {
    domain,
    has_mx: false,
    has_spf: false,
    has_dmarc: false,
    mail_provider: 'None / Unknown',
    deliverability_score: 0,
    mx_records: [],
    errors: [],
  }

  if (!domain) return result

  // 1. Resolve MX records with timeout
  try {
    const mxEntries = await withTimeout(dns.resolveMx(domain), 5000)
    if (mxEntries && mxEntries.length > 0) {
      result.has_mx = true
      result.mx_records = mxEntries.sort((a, b) => a.priority - b.priority).map(m => m.exchange)

      const mxStr = result.mx_records.join(' ').toLowerCase()
      if (mxStr.includes('google') || mxStr.includes('googlemail')) {
        result.mail_provider = 'Google Workspace'
        result.deliverability_score += 65 // 50 base + 15 major provider
      } else if (mxStr.includes('outlook') || mxStr.includes('microsoft')) {
        result.mail_provider = 'Microsoft 365'
        result.deliverability_score += 65
      } else if (mxStr.includes('zoho')) {
        result.mail_provider = 'Zoho Mail'
        result.deliverability_score += 60
      } else if (mxStr.includes('protonmail') || mxStr.includes('proton')) {
        result.mail_provider = 'ProtonMail'
        result.deliverability_score += 60
      } else {
        result.mail_provider = 'Custom / Self-hosted'
        result.deliverability_score += 50
      }
    }
  } catch (err: any) {
    // No MX found or DNS error
    result.has_mx = false
    result.deliverability_score = 0
    result.errors.push(err?.message || 'DNS resolution failed')
    return result
  }

  // 2. Resolve TXT records for SPF with timeout
  try {
    const txtEntries = await withTimeout(dns.resolveTxt(domain), 4000)
    const allTxt = txtEntries.map(arr => arr.join('')).join(' ')
    if (allTxt.toLowerCase().includes('v=spf1')) {
      result.has_spf = true
      result.deliverability_score = Math.min(100, result.deliverability_score + 20)
    }
  } catch {}

  // 3. Resolve TXT records for DMARC (_dmarc.<domain>) with timeout
  try {
    const dmarcEntries = await withTimeout(dns.resolveTxt(`_dmarc.${domain}`), 4000)
    const allDmarc = dmarcEntries.map(arr => arr.join('')).join(' ')
    if (allDmarc.toLowerCase().includes('v=dmarc1')) {
      result.has_dmarc = true
      result.deliverability_score = Math.min(100, result.deliverability_score + 15)
    }
  } catch {}

  return result
}
