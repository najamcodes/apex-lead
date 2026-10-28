import dns from 'node:dns/promises'

export interface DnsAuditReport {
  spfValid: boolean
  spfRecord: string | null
  dmarcValid: boolean
  dmarcRecord: string | null
  dkimValid: boolean
  score: number
  recommendations: string[]
}

export class DnsDeliverabilityAuditor {
  /**
   * Performs real DNS audits for SPF, DMARC, and DKIM to prevent mailbox spam exile.
   */
  public static async auditDomain(domain: string, dkimSelector = 'default'): Promise<DnsAuditReport> {
    const cleanDomain = domain.toLowerCase().trim().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0]
    let spfValid = false
    let spfRecord: string | null = null
    let dmarcValid = false
    let dmarcRecord: string | null = null
    let dkimValid = false
    const recommendations: string[] = []

    // 1. Audit SPF
    try {
      const txtRecords = await dns.resolveTxt(cleanDomain)
      for (const recordChunks of txtRecords) {
        const full = recordChunks.join('')
        if (full.startsWith('v=spf1')) {
          spfRecord = full
          spfValid = true
          break
        }
      }
    } catch {}

    if (!spfValid) {
      recommendations.push(`Missing SPF record. Add 'v=spf1 include:_spf.google.com ~all' (or your provider's SPF) to domain TXT.`)
    }

    // 2. Audit DMARC
    try {
      const dmarcDomain = `_dmarc.${cleanDomain}`
      const dmarcTxt = await dns.resolveTxt(dmarcDomain)
      for (const recordChunks of dmarcTxt) {
        const full = recordChunks.join('')
        if (full.startsWith('v=DMARC1')) {
          dmarcRecord = full
          dmarcValid = true
          break
        }
      }
    } catch {}

    if (!dmarcValid) {
      recommendations.push(`Missing DMARC policy. Add 'v=DMARC1; p=quarantine; rua=mailto:dmarc@${cleanDomain}' to _dmarc.${cleanDomain} TXT.`)
    }

    // 3. Audit DKIM
    try {
      const dkimDomain = `${dkimSelector}._domainkey.${cleanDomain}`
      const dkimTxt = await dns.resolveTxt(dkimDomain)
      if (dkimTxt && dkimTxt.length > 0) {
        dkimValid = true
      }
    } catch {}

    if (!dkimValid) {
      recommendations.push(`DKIM selector '${dkimSelector}' not found. Ensure DKIM public key is published at ${dkimSelector}._domainkey.${cleanDomain}.`)
    }

    // Compute Health Score
    let score = 20
    if (spfValid) score += 40
    if (dmarcValid) score += 25
    if (dkimValid) score += 15

    return {
      spfValid,
      spfRecord,
      dmarcValid,
      dmarcRecord,
      dkimValid,
      score,
      recommendations,
    }
  }
}
