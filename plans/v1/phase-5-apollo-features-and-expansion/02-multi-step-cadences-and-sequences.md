# Implementation Prompt: Multi-Step Drip Cadences, Spintax Engine & Reply Auto-Pause

## Prompt Objective
Build an automated multi-step cold outreach cadence engine with dynamic spintax syntax evaluation, recipient business-hours delivery scheduling, and automated sequence pausing upon prospect reply detection within the Katal MVC architecture.

---

## Context & Architectural Rationale
Apollo's sequences allow automated follow-up cadences, but their deliverability often deteriorates because users send identical email templates at scale, triggering Gmail and Outlook spam cluster filters.

ApexLead's Cadence Engine provides three critical competitive improvements:
1. **Recursive Spintax Synthesizer:** Compiles templates with nested variations (e.g., `{Hi|Hey|Hello} {firstName}, I {noticed|came across} your business on {source}...`) to guarantee virtually every outgoing email is cryptographically unique.
2. **Timezone-Aware Delivery Windows:** Automatically calculates recipient local time from their scraped phone area code or location (e.g., Central Time vs Pacific Time) and only dispatches between 9:00 AM and 4:30 PM local Monday–Friday.
3. **Automated Reply Detection & Instant Pause:** Automatically scans incoming IMAP / Webhook responses; upon receiving a reply from `prospect@domain.com`, all subsequent steps for that enrollment are instantly halted to prevent embarrassing automated follow-ups.

---

## Database Schema Additions

```sql
-- PostgreSQL DDL for Sequences, Steps, and Enrollments
CREATE TABLE IF NOT EXISTS cadences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft', -- 'draft', 'active', 'paused', 'archived'
    daily_limit INT NOT NULL DEFAULT 100,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cadence_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cadence_id UUID NOT NULL REFERENCES cadences(id) ON DELETE CASCADE,
    step_number INT NOT NULL,
    delay_days INT NOT NULL DEFAULT 1, -- Days after previous step
    subject_template TEXT NOT NULL,
    body_template TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cadence_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cadence_id UUID NOT NULL REFERENCES cadences(id) ON DELETE CASCADE,
    record_id UUID NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    current_step INT NOT NULL DEFAULT 1,
    status VARCHAR(50) NOT NULL DEFAULT 'queued', -- 'queued', 'in_progress', 'replied', 'bounced', 'completed', 'paused'
    next_send_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    recipient_email VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_cadence_record UNIQUE (cadence_id, record_id)
);

CREATE INDEX IF NOT EXISTS idx_cadence_due_jobs 
ON cadence_enrollments (status, next_send_at);
```

---

## File Changes & Additions

```
server/
├── src/
│   ├── services/
│   │   ├── cadences/
│   │   │   ├── CadenceEngineService.ts
│   │   │   ├── SpintaxParser.ts
│   │   │   └── ReplyDetectorService.ts
│   │   └── mail/
│   │       └── SmtpSenderService.ts
│   ├── jobs/
│   │   └── CadenceDispatchJob.ts
│   └── controllers/
│       └── CadenceController.ts
```

---

## Detailed Implementation Code

### 1. Spintax Synthesizer (`server/src/services/cadences/SpintaxParser.ts`)

```typescript
export class SpintaxParser {
  private static readonly SPINTAX_REGEX = /\{([^{}]+)\}/g;

  /**
   * Recursively parses spintax patterns like "{Hi|Hello|Hey} {first_name}, {quick question|wondering if}..."
   */
  public static parse(template: string, variables: Record<string, any> = {}): string {
    let result = template;

    // Resolve spintax variations until no brackets remain
    while (this.SPINTAX_REGEX.test(result)) {
      result = result.replace(this.SPINTAX_REGEX, (_, match) => {
        const options = match.split('|');
        const selected = options[Math.floor(Math.random() * options.length)];
        return selected.trim();
      });
    }

    // Substitute variable placeholders: {{firstName}}, {{companyName}}, etc.
    return result.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
      return variables[key] !== undefined ? String(variables[key]) : '';
    });
  }
}
```

---

### 2. Cadence Dispatch Worker (`server/src/jobs/CadenceDispatchJob.ts`)

```typescript
import { Cron, Inject, Job } from 'katal';
import { DataSource } from 'typeorm';
import { SpintaxParser } from '../services/cadences/SpintaxParser';
import { MailboxRotatorService } from '../services/mail/MailboxRotatorService';
import { SmtpSenderService } from '../services/mail/SmtpSenderService';

@Job({ name: 'cadence-dispatch-queue' })
export class CadenceDispatchJob {
  constructor(
    @Inject('DataSource') private dataSource: DataSource,
    @Inject(MailboxRotatorService) private mailboxRotator: MailboxRotatorService,
    @Inject(SmtpSenderService) private smtpSender: SmtpSenderService
  ) {}

  /**
   * Runs every 5 minutes to dispatch due cadence steps.
   */
  @Cron('*/5 * * * *')
  public async handle(): Promise<void> {
    const dueEnrollments = await this.dataSource.query(`
      SELECT 
        ce.id as enrollment_id,
        ce.cadence_id,
        ce.record_id,
        ce.org_id,
        ce.current_step,
        ce.recipient_email,
        cs.subject_template,
        cs.body_template,
        cs.delay_days,
        r.data as record_data
      FROM cadence_enrollments ce
      JOIN cadences c ON c.id = ce.cadence_id
      JOIN cadence_steps cs ON cs.cadence_id = ce.cadence_id AND cs.step_number = ce.current_step
      JOIN records r ON r.id = ce.record_id
      WHERE ce.status = 'in_progress'
        AND ce.next_send_at <= NOW()
        AND c.status = 'active'
      LIMIT 100
    `);

    for (const item of dueEnrollments) {
      try {
        // Step 1: Pick optimal warmed mailbox
        const mailbox = await this.mailboxRotator.getOptimalMailbox(item.org_id);
        if (!mailbox) {
          // No mailbox available with remaining daily quota; back off
          continue;
        }

        // Step 2: Parse spintax & personalize fields
        const subject = SpintaxParser.parse(item.subject_template, item.record_data);
        const body = SpintaxParser.parse(item.body_template, item.record_data);

        // Step 3: Dispatch via SMTP
        await this.smtpSender.sendMail({
          from: `"${mailbox.from_name}" <${mailbox.email}>`,
          to: item.recipient_email,
          subject,
          html: body,
          smtpConfig: mailbox.smtp_credentials,
        });

        // Step 4: Advance step or complete
        const nextStepRow = await this.dataSource.query(`
          SELECT step_number, delay_days 
          FROM cadence_steps 
          WHERE cadence_id = $1 AND step_number = $2
          LIMIT 1
        `, [item.cadence_id, item.current_step + 1]);

        if (nextStepRow.length > 0) {
          const nextDelay = nextStepRow[0].delay_days;
          await this.dataSource.query(`
            UPDATE cadence_enrollments 
            SET current_step = $1,
                next_send_at = NOW() + ($2 || ' days')::INTERVAL,
                updated_at = NOW()
            WHERE id = $3
          `, [item.current_step + 1, nextDelay, item.enrollment_id]);
        } else {
          // All steps completed!
          await this.dataSource.query(`
            UPDATE cadence_enrollments 
            SET status = 'completed', updated_at = NOW()
            WHERE id = $1
          `, [item.enrollment_id]);
        }

        // Record mailbox send count
        await this.mailboxRotator.incrementSendCount(mailbox.id);

      } catch (err: any) {
        console.error(`Failed to dispatch cadence enrollment ${item.enrollment_id}:`, err.message);
      }
    }
  }
}
```

---

### 3. Reply Auto-Pause Service (`server/src/services/cadences/ReplyDetectorService.ts`)

```typescript
import { Service, Inject } from 'katal';
import { DataSource } from 'typeorm';

@Service()
export class ReplyDetectorService {
  constructor(@Inject('DataSource') private dataSource: DataSource) {}

  /**
   * Called when an incoming email reply is detected via IMAP or Webhook.
   */
  public async handleIncomingReply(fromEmail: string): Promise<boolean> {
    const cleanEmail = fromEmail.toLowerCase().trim();

    // Look for any active enrollment with this email
    const result = await this.dataSource.query(`
      UPDATE cadence_enrollments 
      SET status = 'replied', updated_at = NOW()
      WHERE LOWER(recipient_email) = $1
        AND status IN ('queued', 'in_progress')
      RETURNING id, cadence_id, org_id
    `, [cleanEmail]);

    if (result.length > 0) {
      console.log(`[ReplyDetector] Auto-paused ${result.length} cadences for ${cleanEmail}`);
      return true;
    }

    return false;
  }
}
```

---

## Verification & Acceptance Criteria
1. **Spintax Uniqueness Test:** Run template with 3 variation sets 1,000 times; verify unique hashes exceed 95% of total generations.
2. **Cron Dispatch Lifecycle:** Enroll test record, trigger `CadenceDispatchJob.handle()`, verify step advances from Step 1 to Step 2 with proper `next_send_at` timestamp.
3. **Reply Auto-Pause Test:** Trigger `handleIncomingReply('lead@test.com')` and verify the enrollment status immediately changes to `'replied'` and cannot be re-dispatched.
