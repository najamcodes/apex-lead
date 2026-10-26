# Implementation Prompt: Autonomous Conversational Voice AI SDR Phone Qualification Node

## Prompt Objective
Build an autonomous Voice AI SDR (Sales Development Representative) qualification node (`VoiceAiService`, `VoiceSdrNode`) utilizing ultra-low latency conversational voice (Vapi / Retell AI / ElevenLabs + Twilio SIP trunking) to execute automated phone qualification calls, overcome objections, extract answers to structured questions, and schedule qualified appointments directly into calendars.

---

## Context & Architectural Rationale
Apollo and legacy sales tools offer cold emails and manual dialers where human reps must sit and click to call numbers manually. 

ApexLead's **Autonomous Voice AI SDR** provides an unmatchable competitive advantage:
1. **Ultra-Low Latency Conversational AI (<600ms):** Employs state-of-the-art streaming conversational speech models capable of natural interruption, tone modulation, and realistic human inflections.
2. **Context-Informed Persona:** Injects enriched business data from Phase 1 polymorphic records (e.g. Google review count, verified owner name, scraped service specialties) so the AI sounds like a thoroughly prepared senior SDR.
3. **Structured Lead Qualification:** Gathers critical answers (e.g. *"Are you currently accepting commercial roofing bids in Dallas?"*, *"How many active installation crews do you have?"*).
4. **Autonomous In-Call Meeting Booking:** When the prospect indicates availability, the Voice AI executes a function call to fetch real-time Cal.com / Google Calendar slots and locks in the demo directly over the phone.
5. **Full Call Analytics:** Stores the call audio recording, time-stamped transcript, sentiment analysis score, and structured qualification JSON back into `records.data`.

---

## Database Schema Additions

```sql
-- PostgreSQL DDL for Voice AI Campaigns and Calls
CREATE TABLE IF NOT EXISTS voice_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    voice_provider VARCHAR(50) NOT NULL DEFAULT 'vapi', -- 'vapi', 'retell', 'elevenlabs'
    assistant_id VARCHAR(255) NOT NULL,
    system_prompt_template TEXT NOT NULL,
    first_sentence_template TEXT NOT NULL,
    phone_number_id VARCHAR(255) NOT NULL,
    max_duration_seconds INT NOT NULL DEFAULT 300,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS voice_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES voice_campaigns(id) ON DELETE CASCADE,
    record_id UUID NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    call_sid VARCHAR(255) UNIQUE NOT NULL,
    recipient_phone VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'initiated', -- 'initiated', 'in_progress', 'completed', 'busy', 'no_answer', 'failed'
    duration_seconds INT DEFAULT 0,
    transcript TEXT,
    summary TEXT,
    sentiment_score NUMERIC(3, 2), -- -1.00 to 1.00
    appointment_booked BOOLEAN NOT NULL DEFAULT FALSE,
    appointment_time TIMESTAMPTZ,
    qualification_answers JSONB NOT NULL DEFAULT '{}',
    recording_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_voice_calls_org_record 
ON voice_calls (org_id, record_id);
```

---

## File Changes & Additions

```
server/
├── src/
│   ├── services/
│   │   ├── voice/
│   │   │   ├── VoiceAiService.ts
│   │   │   ├── providers/
│   │   │   │   ├── VapiVoiceProvider.ts
│   │   │   │   └── RetellVoiceProvider.ts
│   │   │   └── CalComScheduler.ts
│   │   └── QuotaService.ts
│   ├── controllers/
│   │   └── VoiceWebhookController.ts
│   └── nodes/
│       └── VoiceSdrNode.ts
```

---

## Detailed Implementation Code

### 1. Voice AI Provider Service (`server/src/services/voice/VoiceAiService.ts`)

```typescript
import { Service, Inject } from 'katal';
import { DataSource } from 'typeorm';
import { SpintaxParser } from '../cadences/SpintaxParser';
import { QuotaService } from '../QuotaService';

export interface InitiateCallParams {
  orgId: string;
  campaignId: string;
  recordId: string;
  recipientPhone: string;
  recordData: Record<string, any>;
}

@Service()
export class VoiceAiService {
  constructor(
    @Inject('DataSource') private dataSource: DataSource,
    @Inject(QuotaService) private quotaService: QuotaService
  ) {}

  /**
   * Initiates an autonomous AI qualification phone call via Vapi API.
   */
  public async dispatchCall(params: InitiateCallParams): Promise<{ callId: string }> {
    const { orgId, campaignId, recordId, recipientPhone, recordData } = params;

    // Check voice minutes quota
    await this.quotaService.assertQuotaAvailable(orgId, 'voice_minutes', 5);

    // Fetch campaign config
    const campaigns = await this.dataSource.query(
      `SELECT * FROM voice_campaigns WHERE id = $1 AND org_id = $2`,
      [campaignId, orgId]
    );

    if (campaigns.length === 0) {
      throw new Error(`Voice campaign ${campaignId} not found`);
    }

    const campaign = campaigns[0];
    const personalizedPrompt = SpintaxParser.parse(campaign.system_prompt_template, recordData);
    const firstSentence = SpintaxParser.parse(campaign.first_sentence_template, recordData);

    const vapiApiKey = process.env.VAPI_API_KEY;
    if (!vapiApiKey) {
      throw new Error('Missing VAPI_API_KEY environment variable');
    }

    // Call Vapi Outbound API
    const response = await fetch('https://api.vapi.ai/call/phone', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${vapiApiKey}`,
      },
      body: JSON.stringify({
        phoneNumberId: campaign.phone_number_id,
        customer: {
          number: recipientPhone,
          name: recordData.contact_name || recordData.businessName,
        },
        assistantId: campaign.assistant_id,
        assistantOverrides: {
          firstMessage: firstSentence,
          model: {
            messages: [
              {
                role: 'system',
                content: personalizedPrompt,
              },
            ],
            tools: [
              {
                type: 'function',
                function: {
                  name: 'bookAppointment',
                  description: 'Locks in a confirmed meeting time on the calendar with the prospect',
                  parameters: {
                    type: 'object',
                    properties: {
                      datetimeIso: { type: 'string', description: 'Selected ISO 8601 date and time' },
                      prospectEmail: { type: 'string', description: 'Email address of the prospect' },
                    },
                    required: ['datetimeIso'],
                  },
                },
              },
            ],
          },
        },
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(`Failed to initiate Vapi call: ${JSON.stringify(err)}`);
    }

    const data = await response.json();

    // Insert call row
    await this.dataSource.query(
      `INSERT INTO voice_calls (campaign_id, record_id, org_id, call_sid, recipient_phone, status)
       VALUES ($1, $2, $3, $4, $5, 'initiated')`,
      [campaignId, recordId, orgId, data.id, recipientPhone]
    );

    return { callId: data.id };
  }
}
```

---

### 2. Inbound Voice Webhook Handler (`server/src/controllers/VoiceWebhookController.ts`)

```typescript
import { Controller, Post, Body, Inject } from 'katal';
import { DataSource } from 'typeorm';
import { QuotaService } from '../services/QuotaService';

@Controller('/api/v1/voice/webhooks')
export class VoiceWebhookController {
  constructor(
    @Inject('DataSource') private dataSource: DataSource,
    @Inject(QuotaService) private quotaService: QuotaService
  ) {}

  /**
   * Receives real-time call updates and end-of-call transcripts from Vapi.
   */
  @Post('/vapi')
  public async handleVapiEvent(@Body() event: any) {
    const { type, call } = event.message || event;

    if (type === 'end-of-call-report') {
      const callSid = call.id;
      const durationSeconds = Math.ceil(call.duration || 0);
      const transcript = call.transcript || '';
      const summary = call.summary || '';
      const structuredAnswers = call.analysis?.structuredData || {};
      const recordingUrl = call.recordingUrl || null;

      // Update call record
      const updated = await this.dataSource.query(
        `UPDATE voice_calls 
         SET status = 'completed',
             duration_seconds = $1,
             transcript = $2,
             summary = $3,
             qualification_answers = $4,
             recording_url = $5,
             finished_at = NOW()
         WHERE call_sid = $6
         RETURNING org_id, record_id`,
        [durationSeconds, transcript, summary, JSON.stringify(structuredAnswers), recordingUrl, callSid]
      );

      if (updated.length > 0) {
        const { org_id, record_id } = updated[0];

        // Deduct duration in minutes
        const minutes = Math.ceil(durationSeconds / 60);
        await this.quotaService.incrementUsage(org_id, 'voice_minutes', minutes);

        // Update polymorphic record with voice qualification data
        await this.dataSource.query(
          `UPDATE records 
           SET data = jsonb_set(
             jsonb_set(data, '{voice_qualification}', $1::jsonb),
             '{voice_summary}', to_jsonb($2::text)
           ),
           updated_at = NOW()
           WHERE id = $3`,
          [JSON.stringify(structuredAnswers), summary, record_id]
        );
      }
    }

    return { status: 'ok' };
  }
}
```

---

### 3. Pipeline DAG Voice Node (`server/src/nodes/VoiceSdrNode.ts`)

```typescript
import { BaseNode, NodeContext } from './BaseNode';
import { VoiceAiService } from '../services/voice/VoiceAiService';
import { Container } from 'katal';

export class VoiceSdrNode extends BaseNode {
  public static readonly type = 'voice.ai_caller';

  public async execute(context: NodeContext): Promise<void> {
    const voiceService = Container.get(VoiceAiService);
    const { orgId, records, nodeConfig } = context;
    const campaignId = nodeConfig.campaignId;

    for (const record of records) {
      const phone = record.data?.phone;
      if (phone) {
        try {
          await voiceService.dispatchCall({
            orgId,
            campaignId,
            recordId: record.id,
            recipientPhone: phone,
            recordData: record.data,
          });
        } catch (err: any) {
          console.error(`Voice caller failed on record ${record.id}:`, err.message);
        }
      }
    }
  }
}
```

---

## Verification & Acceptance Criteria
1. **Outbound Call Dispatch:** Trigger test dispatch with simulated phone number; verify Vapi API returns 200 with active call identifier.
2. **Quota Deduction:** Verify call of 150 seconds deducts exactly 3 minutes from `organization_usage.voice_minutes_used`.
3. **End-of-Call Payload Ingestion:** Deliver mock `end-of-call-report` webhook payload; verify `records.data.voice_qualification` is populated with structured answers and summary.
4. **Calendar Tool Trigger:** Verify `bookAppointment` function call in Vapi creates an event and sets `appointment_booked: true` on the call entity.
