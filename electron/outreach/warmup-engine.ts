import { getEmailAccounts } from '../../src/db/queries/email-accounts.queries'
import { sendEmail } from './smtp-sender'
import { getSettings } from '../../src/db/queries/settings.queries'
import { getAiClient } from '../ai/ai-client'

export async function runWarmupCycle() {
  const settings = await getSettings()
  if (!settings.ai_enabled || !settings.ai_enabled) {
    return
  }

  const accounts = await getEmailAccounts()
  const activeAccounts = accounts.filter(a => a.status === 'active')

  if (activeAccounts.length < 2) {
    return
  }

  // Pick two random distinct accounts
  const indexA = Math.floor(Math.random() * activeAccounts.length)
  let indexB = Math.floor(Math.random() * activeAccounts.length)
  while (indexA === indexB) {
    indexB = Math.floor(Math.random() * activeAccounts.length)
  }

  const sender = activeAccounts[indexA]
  const receiver = activeAccounts[indexB]

  try {
    const client = getAiClient(settings)
    
    // Generate a benign, conversational email
    const prompt = `You are an employee sending a casual, benign 3-sentence email to a coworker. 
The email should be about something normal like a project update, asking about lunch, or sharing a quick thought.
Return a JSON object with "subject" and "body". Do NOT include any placeholders.`

    const result = await client.completeJson<{subject: string, body: string}>({
      model: settings.ai_model_email_draft,
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.8
    })

    if (!result.subject || !result.body) {
      throw new Error('AI returned invalid warmup content')
    }

    console.log(`[Warmup] Sending from ${sender.email_address} to ${receiver.email_address}...`)
    const sendResult = await sendEmail(sender, receiver.email_address, result.subject, result.body)
    
    if (sendResult.success) {
      console.log(`[Warmup] Success! Message ID: ${sendResult.message_id}`)
    } else {
      console.error(`[Warmup] Failed to send: ${sendResult.error}`)
    }

  } catch (err) {
    console.error('[Warmup] Failed to run cycle:', err)
  }
}
