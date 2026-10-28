import dns from 'node:dns/promises'

export interface ResolvedCompany {
  isCommercial: boolean
  companyName: string | null
  companyDomain: string | null
  industry?: string
}

export class ReverseIpResolver {
  private static readonly CONSUMER_ISP_PATTERNS = [
    /comcast/i,
    /verizon/i,
    /at&t/i,
    /attlocal/i,
    /charter/i,
    /spectrum/i,
    /cox/i,
    /vodafone/i,
    /t-mobile/i,
    /orange/i,
    /telecom/i,
    /residential/i,
    /dynamic/i,
    /pool/i,
    /broadband/i,
  ]

  /**
   * Resolves incoming IP to corporate entity, rejecting residential consumer noise.
   */
  public static async resolveIp(ip: string): Promise<ResolvedCompany> {
    // Local / private address check
    if (
      ip === '127.0.0.1' ||
      ip === '::1' ||
      ip.startsWith('192.168.') ||
      ip.startsWith('10.') ||
      ip.startsWith('172.16.')
    ) {
      return {
        isCommercial: true,
        companyName: 'Local Development Corp',
        companyDomain: 'localdev.internal',
        industry: 'Software & Technology',
      }
    }

    try {
      const hostnames = await dns.reverse(ip)
      if (!hostnames || hostnames.length === 0) {
        return { isCommercial: false, companyName: null, companyDomain: null }
      }

      const host = hostnames[0].toLowerCase()

      // Reject consumer ISPs
      for (const pattern of this.CONSUMER_ISP_PATTERNS) {
        if (pattern.test(host)) {
          return { isCommercial: false, companyName: null, companyDomain: null }
        }
      }

      // Extract corporate domain from hostname (e.g. gate.stripe.com -> stripe.com)
      const parts = host.split('.')
      if (parts.length >= 2) {
        const domain = parts.slice(-2).join('.')
        const companyName = parts.slice(-2)[0].charAt(0).toUpperCase() + parts.slice(-2)[0].slice(1)
        return {
          isCommercial: true,
          companyName,
          companyDomain: domain,
          industry: 'Commercial Organization',
        }
      }
    } catch {
      // Reverse DNS lookup failed or timed out
    }

    return { isCommercial: false, companyName: null, companyDomain: null }
  }
}
