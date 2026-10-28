import dns from 'node:dns/promises'
import type { MxRecord } from 'node:dns'
import net from 'node:net'

export interface SmtpVerifyResult {
  valid: boolean
  isCatchAll: boolean
  mxHost: string | null
  smtpResponse: string
}

export class SmtpVerifier {
  private static readonly TIMEOUT_MS = 6000

  /**
   * Performs an asynchronous MX resolution and SMTP handshake without sending an email.
   * Safe, zero-send, non-intrusive mailbox probe.
   */
  public static async verifyEmail(email: string): Promise<SmtpVerifyResult> {
    const domain = email.split('@')[1]?.toLowerCase().trim()
    if (!domain) {
      return { valid: false, isCatchAll: false, mxHost: null, smtpResponse: 'Invalid email syntax' }
    }

    let mxRecords: MxRecord[]
    try {
      mxRecords = await dns.resolveMx(domain)
      if (!mxRecords || mxRecords.length === 0) {
        return { valid: false, isCatchAll: false, mxHost: null, smtpResponse: 'No MX records found' }
      }
      mxRecords.sort((a, b) => a.priority - b.priority)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return { valid: false, isCatchAll: false, mxHost: null, smtpResponse: `DNS MX lookup failed: ${message}` }
    }

    const primaryMx = mxRecords[0].exchange

    return new Promise((resolve) => {
      let resolved = false
      const socket = net.createConnection(25, primaryMx)
      let step = 0
      let lastResponse = ''
      let timer: ReturnType<typeof setTimeout>

      const finish = (valid: boolean, catchAll = false, response = '') => {
        if (resolved) return
        resolved = true
        clearTimeout(timer)
        try {
          socket.destroy()
        } catch {}
        resolve({ valid, isCatchAll: catchAll, mxHost: primaryMx, smtpResponse: response || lastResponse })
      }

      timer = setTimeout(() => {
        finish(false, false, 'SMTP Socket timeout')
      }, this.TIMEOUT_MS)

      socket.setEncoding('ascii')

      socket.on('error', (err) => {
        finish(false, false, `Socket connection error: ${err.message}`)
      })

      socket.on('data', (chunk) => {
        const data = chunk.toString()
        lastResponse = data.trim()
        const code = parseInt(data.substring(0, 3), 10)

        if (code >= 400 && code < 600) {
          return finish(false, false, lastResponse)
        }

        if (step === 0 && code === 220) {
          step = 1
          socket.write(`HELO verify.apexlead.ai\r\n`)
        } else if (step === 1 && code === 250) {
          step = 2
          socket.write(`MAIL FROM:<probe@verify.apexlead.ai>\r\n`)
        } else if (step === 2 && code === 250) {
          step = 3
          socket.write(`RCPT TO:<${email}>\r\n`)
        } else if (step === 3) {
          if (code === 250) {
            // Target accepted. Now check for catch-all with fictitious address
            step = 4
            const randomCatchAll = `probe-nonexistent-${Date.now()}@${domain}`
            socket.write(`RCPT TO:<${randomCatchAll}>\r\n`)
          } else {
            finish(false, false, lastResponse)
          }
        } else if (step === 4) {
          if (code === 250) {
            // Server accepted completely fictitious address -> Catch-all domain
            finish(true, true, 'Catch-all detected; domain accepts all recipients')
          } else {
            // Legitimate address succeeded, fake address rejected -> 100% verified inbox
            finish(true, false, 'Recipient inbox verified OK')
          }
        }
      })
    })
  }
}
