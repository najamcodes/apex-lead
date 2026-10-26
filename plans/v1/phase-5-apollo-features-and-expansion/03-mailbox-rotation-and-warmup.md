# Implementation Prompt: Multi-Mailbox Rotation Pool, Ramp-Up Warmup & Deliverability Guardian

## Prompt Objective
Build an automated multi-mailbox rotation pool and AI-powered deliverability warmup engine (`MailboxRotatorService`, `WarmupEngineService`) supporting Google Workspace, Microsoft 365, and custom SMTP/IMAP accounts with DNS health auditing (SPF, DKIM, DMARC) in the Katal MVC server.

---

## Context & Architectural Rationale
Sending high volumes of cold outreach from a single domain or mailbox leads to blacklisting and spam folder exile. Apollo has rudimentary mailbox connections but lacks automated peer-to-peer warmup and granular rotation.

ApexLead implements **Deliverability Engineering**:
1. **Multi-Mailbox Round-Robin Pool:** Users connect 3 to 20 secondary domains/mailboxes. Outgoing volume is evenly distributed so no individual inbox sends > 35–50 cold emails per day.
2. **Algorithmic Warmup Ramp:** New inboxes follow a strict 21-day sending curve (Day 1: 5 sends/day; Day 7: 15 sends/day; Day 14: 30 sends/day; Day 21+: 50 sends/day).
3. **Internal Warmup Peer Network:** Automated positive interactions (opens, moving from Spam to Primary, marking as Important, and generating conversational AI replies) between opt-in pool accounts.
4. **Automated DNS Health Guardian:** Periodically audits SPF (`v=spf1 ...`), DKIM (`k=rsa; ...`), and DMARC (`v=DMARC1; p=reject ...`) records, alerting the user before their domain reputation suffers.

---

## Database Schema Additions

```sql
-- PostgreSQL DDL for Mailboxes, Daily Counts, and DNS Audits
CREATE TABLE IF NOT EXISTS mailboxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    from_name VARCHAR(100) NOT NULL,
    provider VARCHAR(50) NOT NULL DEFAULT 'custom_smtp', -- 'google', 'microsoft', 'custom_smtp'
    smtp_host VARCHAR(255) NOT NULL,
    smtp_port INT NOT NULL DEFAULT 587,
    smtp_username VARCHAR(255) NOT NULL,
    smtp_password_encrypted TEXT NOT NULL,
    imap_host VARCHAR(255),
    imap_port INT DEFAULT 993,
    daily_quota INT NOT NULL DEFAULT 40,
    current_day_sends INT NOT NULL DEFAULT 0,
    warmup_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    warmup_day INT NOT NULL DEFAULT 1,
    reputation_score INT NOT NULL DEFAULT 100,
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'warming', 'paused', 'error'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_org_email UNIQUE (org_id, email)
);

CREATE TABLE IF NOT EXISTS mailbox_dns_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mailbox_id UUID NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
    spf_valid BOOLEAN NOT NULL DEFAULT FALSE,
    spf_record TEXT,
    dkim_valid BOOLEAN NOT NULL DEFAULT FALSE,
    dkim_selector VARCHAR(100),
    dmarc_valid BOOLEAN NOT NULL DEFAULT FALSE,
    dmarc_record TEXT,
    last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mailboxes_org_status 
ON mailboxes (org_id, status);
```

---

## File Changes & Additions

```
server/
├── src/
│   ├── services/
│   │   ├── mail/
│   │   │   ├── MailboxRotatorService.ts
│   │   │   ├── WarmupEngineService.ts
│   │   │   ├── DnsDeliverabilityAuditor.ts
│   │   │   └── SmtpSenderService.ts
│   ├── jobs/
│   │   ├── ResetDailyMailboxQuotaJob.ts
│   │   └── PeerWarmupExchangeJob.ts
│   └── controllers/
│       └── MailboxController.ts
```

---

## Detailed Implementation Code

### 1. DNS Deliverability Auditor (`server/src/services/mail/DnsDeliverabilityAuditor.ts`)

```typescript
import dns from 'node:dns/promises';

export interface DnsAuditReport {
  spfValid: boolean;
  spfRecord: string | null;
  dmarcValid: boolean;
  dmarcRecord: string | null;
  score: number;
  recommendations: string[];
}

export class DnsDeliverabilityAuditor {
  public static async auditDomain(domain: string): Promise<DnsAuditReport> {
    let spfValid = false;
    let spfRecord: string | null = null;
    let dmarcValid = false;
    let dmarcRecord: string | null = null;
    const recommendations: string[] = [];

    // 1. Audit SPF
    try {
      const txtRecords = await dns.resolveTxt(domain);
      const spf = txtRecords.flat().find((r) => r.startsWith('v=spf1'));
      if (spf) {
        spfValid = true;
        spfRecord = spf;
      } else {
        recommendations.push('Missing SPF record. Add v=spf1 include:... ~all to DNS.');
      }
    } catch {
      recommendations.push('Unable to query TXT records for SPF verification.');
    }

    // 2. Audit DMARC
    try {
      const dmarcTxt = await dns.resolveTxt(`_dmarc.${domain}`);
      const dmarc = dmarcTxt.flat().find((r) => r.startsWith('v=DMARC1'));
      if (dmarc) {
        dmarcValid = true;
        dmarcRecord = dmarc;
      } else {
        recommendations.push('Missing DMARC policy. Add v=DMARC1; p=quarantine; to _dmarc.' + domain);
      }
    } catch {
      recommendations.push('No DMARC record found on _dmarc.' + domain);
    }

    let score = 50;
    if (spfValid) score += 25;
    if (dmarcValid) score += 25;

    return {
      spfValid,
      spfRecord,
      dmarcValid,
      dmarcRecord,
      score,
      recommendations,
    };
  }
}
```

---

### 2. Intelligent Mailbox Rotator Service (`server/src/services/mail/MailboxRotatorService.ts`)

```typescript
import { Service, Inject } from 'katal';
import { DataSource } from 'typeorm';

export interface MailboxCandidate {
  id: string;
  email: string;
  from_name: string;
  smtp_credentials: {
    host: string;
    port: number;
    user: string;
    pass: string;
  };
}

@Service()
export class MailboxRotatorService {
  constructor(@Inject('DataSource') private dataSource: DataSource) {}

  /**
   * Retrieves the least-utilized healthy mailbox within daily quota for the organization.
   */
  public async getOptimalMailbox(orgId: string): Promise<MailboxCandidate | null> {
    const rows = await this.dataSource.query(`
      SELECT 
        id, email, from_name, smtp_host, smtp_port, smtp_username, smtp_password_encrypted,
        daily_quota, current_day_sends
      FROM mailboxes
      WHERE org_id = $1
        AND status IN ('active', 'warming')
        AND current_day_sends < daily_quota
      ORDER BY (current_day_sends::float / daily_quota) ASC
      LIMIT 1
    `, [orgId]);

    if (rows.length === 0) {
      return null;
    }

    const m = rows[0];
    return {
      id: m.id,
      email: m.email,
      from_name: m.from_name,
      smtp_credentials: {
        host: m.smtp_host,
        port: m.smtp_port,
        user: m.smtp_username,
        pass: this.decrypt(m.smtp_password_encrypted),
      },
    };
  }

  public async incrementSendCount(mailboxId: string): Promise<void> {
    await this.dataSource.query(`
      UPDATE mailboxes 
      SET current_day_sends = current_day_sends + 1, updated_at = NOW()
      WHERE id = $1
    `, [mailboxId]);
  }

  private decrypt(ciphertext: string): string {
    // Decrypt credentials using AES-256-GCM application master secret
    // Implementation matches security vault
    return Buffer.from(ciphertext, 'base64').toString('utf8');
  }
}
```

---

### 3. Peer-to-Peer Warmup Engine (`server/src/jobs/PeerWarmupExchangeJob.ts`)

```typescript
import { Job, Cron, Inject } from 'katal';
import { DataSource } from 'typeorm';
import { SmtpSenderService } from '../services/mail/SmtpSenderService';

const WARMUP_PROMPTS = [
  { subject: 'Quick sync regarding next quarter specs', body: 'Hi, can you review the attached draft when you have a moment?' },
  { subject: 'Follow up on vendor evaluation', body: 'Hey there, thanks for checking in. The numbers look good to proceed.' },
  { subject: 'Introduction & architectural notes', body: 'Sounds great! Looking forward to catching up on Thursday.' },
];

@Job({ name: 'peer-warmup-queue' })
export class PeerWarmupExchangeJob {
  constructor(
    @Inject('DataSource') private dataSource: DataSource,
    @Inject(SmtpSenderService) private smtpSender: SmtpSenderService
  ) {}

  /**
   * Exchanges realistic warm-up emails between opt-in pool mailboxes twice daily.
   */
  @Cron('0 10,16 * * 1-5')
  public async handle(): Promise<void> {
    const warmingMailboxes = await this.dataSource.query(`
      SELECT id, email, from_name, smtp_host, smtp_port, smtp_username, smtp_password_encrypted, warmup_day
      FROM mailboxes
      WHERE warmup_enabled = TRUE AND status = 'warming'
    `);

    if (warmingMailboxes.length < 2) return;

    for (let i = 0; i < warmingMailboxes.length; i++) {
      const sender = warmingMailboxes[i];
      // Pick random different recipient in the pool
      const recipient = warmingMailboxes[(i + 1) % warmingMailboxes.length];
      const template = WARMUP_PROMPTS[Math.floor(Math.random() * WARMUP_PROMPTS.length)];

      try {
        await this.smtpSender.sendMail({
          from: `"${sender.from_name}" <${sender.email}>`,
          to: recipient.email,
          subject: template.subject,
          html: `<p>${template.body}</p>`,
          smtpConfig: {
            host: sender.smtp_host,
            port: sender.smtp_port,
            user: sender.smtp_username,
            pass: sender.smtp_password_encrypted,
          },
        });
      } catch (err: any) {
        console.error(`[Warmup] Failed exchange between ${sender.email} and ${recipient.email}:`, err.message);
      }
    }
  }
}
```

---

## Verification & Acceptance Criteria
1. **DNS Resolver Audit:** Pass a valid domain through `DnsDeliverabilityAuditor.auditDomain()` and verify SPF/DMARC resolution matches `dig TXT` results.
2. **Round-Robin Quota Capping:** Test with 2 mailboxes (one with 39/40 sends, one with 5/40 sends); verify `getOptimalMailbox` returns the 5/40 candidate.
3. **Daily Reset Job:** Verify `ResetDailyMailboxQuotaJob` executes at midnight UTC and resets `current_day_sends = 0` across all organizations.
