// electron/pipeline/nightly-runner.ts
// Manages the two cron jobs: nightly scrape + morning digest send.

import cron from 'node-cron'
import nodemailer from 'nodemailer'
import { runNightlyPipeline } from './index'
import { buildDigestHtml, buildDigestText } from './digest-builder'
import { insertDigestRun } from '../../src/db/queries/digests.queries'
import { getSettings } from '../../src/db/queries/settings.queries'
import { getDataSource } from '../../src/db/index'

let _scrapeCronTask:  any | null = null
let _digestCronTask:  any | null = null
let _pendingDigest:   any = null  // stored between scrape run and digest send

const DEFAULT_SCRAPE_CRON = '0 2 * * *'   // 2:00am every day
const DEFAULT_DIGEST_CRON = '0 7 * * *'   // 7:00am every day

// ─── Start both cron jobs ─────────────────────────────────────────────────────

export async function startNightlyRunner(): Promise<void> {
  const settings = await getSettings()
  if (!settings.pipeline_enabled) return

  startScrapeCron(settings.pipeline_scrape_cron || DEFAULT_SCRAPE_CRON)
  startDigestCron(settings.pipeline_digest_cron || DEFAULT_DIGEST_CRON)

  console.log('[NightlyRunner] Started')
  console.log(`  Scrape:  ${settings.pipeline_scrape_cron || DEFAULT_SCRAPE_CRON}`)
  console.log(`  Digest:  ${settings.pipeline_digest_cron || DEFAULT_DIGEST_CRON}`)
}

export function stopNightlyRunner(): void {
  _scrapeCronTask?.stop()
  _digestCronTask?.stop()
  _scrapeCronTask = null
  _digestCronTask = null
  console.log('[NightlyRunner] Stopped')
}

export async function restartNightlyRunner(): Promise<void> {
  stopNightlyRunner()
  await startNightlyRunner()
}

// ─── Scrape cron ──────────────────────────────────────────────────────────────

function startScrapeCron(expression: string): void {
  if (!cron.validate(expression)) {
    console.error('[NightlyRunner] Invalid scrape cron:', expression)
    return
  }

  _scrapeCronTask = cron.schedule(expression, async () => {
    console.log('[NightlyRunner] Nightly scrape starting...')
    try {
      const result = await runNightlyPipeline()
      // Store result so digest cron can use it
      _pendingDigest = result
      console.log('[NightlyRunner] Scrape complete:', result)
    } catch (err) {
      console.error('[NightlyRunner] Scrape failed:', err)
    }
  })
}

// ─── Digest cron ──────────────────────────────────────────────────────────────

function startDigestCron(expression: string): void {
  if (!cron.validate(expression)) {
    console.error('[NightlyRunner] Invalid digest cron:', expression)
    return
  }

  _digestCronTask = cron.schedule(expression, async () => {
    console.log('[NightlyRunner] Morning digest starting...')
    await sendMorningDigest(_pendingDigest)
    _pendingDigest = null
  })
}

// ─── Send digest email ────────────────────────────────────────────────────────

export async function sendMorningDigest(pipelineResult?: any): Promise<void> {
  const settings = await getSettings()

  if (!settings.smtp_host || !settings.smtp_username) {
    console.warn('[Digest] SMTP not configured — skipping digest send')
    return
  }

  if (!settings.digest_recipient_email) {
    console.warn('[Digest] No recipient email — skipping digest send')
    return
  }

  // Build digest data — use pipeline result if available, else query DB
  const digestData = pipelineResult ?? await buildDigestFromDb()

  const topLeads = digestData.top_leads ?? []

  const htmlBody = buildDigestHtml(
    {
      run_at:           new Date().toISOString(),
      targets_run:      digestData.targets_run      ?? 0,
      total_scraped:    digestData.total_scraped     ?? 0,
      total_qualified:  digestData.total_qualified   ?? 0,
      total_no_website: digestData.total_no_website  ?? 0,
      total_new:        digestData.total_new         ?? 0,
      digest_sent:      false,
      digest_error:     null,
      top_leads:        JSON.stringify(topLeads),
    },
    topLeads,
    {
      developer_name: settings.developer_name || 'there',
      default_city:   settings.default_city   || '',
    }
  )

  const textBody = buildDigestText(digestData, topLeads)

  // Send via SMTP
  const transporter = nodemailer.createTransport({
    host:   settings.smtp_host,
    port:   settings.smtp_port  || 587,
    secure: settings.smtp_secure ?? false,
    auth: {
      user: settings.smtp_username,
      pass: settings.smtp_password,
    },
    tls: { rejectUnauthorized: false },
  })

  let digestSent  = false
  let digestError: string | null = null

  try {
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    await transporter.sendMail({
      from:    `"LeadHunter" <${settings.smtp_from_email || settings.smtp_username}>`,
      to:      settings.digest_recipient_email,
      subject: `🎯 ${digestData.total_new ?? 0} new leads found — LeadHunter Digest ${date}`,
      text:    textBody,
      html:    htmlBody,
    })
    digestSent = true
    console.log('[Digest] Sent to', settings.digest_recipient_email)
  } catch (err) {
    digestError = String(err)
    console.error('[Digest] Send failed:', err)
  }

  // Persist digest run to DB
  await insertDigestRun({
    run_at:           new Date().toISOString(),
    targets_run:      digestData.targets_run      ?? 0,
    total_scraped:    digestData.total_scraped     ?? 0,
    total_qualified:  digestData.total_qualified   ?? 0,
    total_no_website: digestData.total_no_website  ?? 0,
    total_new:        digestData.total_new         ?? 0,
    digest_sent:      digestSent,
    digest_error:     digestError,
    top_leads:        JSON.stringify(topLeads),
  })
}

// ─── Build digest from DB when no pipeline result available ──────────────────

async function buildDigestFromDb(): Promise<any> {
  const db = getDataSource()

  const stats = await db.createQueryBuilder()
    .select('COUNT(*)', 'total_new')
    .addSelect("SUM(CASE WHEN website_status = 'none' THEN 1 ELSE 0 END)", 'total_no_website')
    .addSelect("SUM(CASE WHEN ai_site_score IS NOT NULL THEN 1 ELSE 0 END)", 'total_qualified')
    .from('leads', 'leads')
    .where("scraped_at >= datetime('now', '-24 hours')")
    .getRawOne()

  const topLeads = await db.createQueryBuilder()
    .select(['business_name', 'city', 'category', 'ai_site_score', 'website_status', 'phone', 'website_url'])
    .from('leads', 'leads')
    .where("scraped_at >= datetime('now', '-24 hours')")
    .orderBy("CASE WHEN website_status = 'none' THEN 0 ELSE 1 END", 'ASC')
    .addOrderBy("COALESCE(ai_site_score, 50)", 'ASC')
    .limit(8)
    .getRawMany()

  const statsRow = stats || {}
  return {
    targets_run:      0,
    total_scraped:    Number(statsRow.total_new ?? 0),
    total_qualified:  Number(statsRow.total_qualified ?? 0),
    total_no_website: Number(statsRow.total_no_website ?? 0),
    total_new:        Number(statsRow.total_new ?? 0),
    top_leads:        topLeads,
  }
}

export async function getNightlyRunnerStatus() {
  const settings = await getSettings()
  return {
    enabled:      settings.pipeline_enabled ?? false,
    scrape_cron:  settings.pipeline_scrape_cron || DEFAULT_SCRAPE_CRON,
    digest_cron:  settings.pipeline_digest_cron || DEFAULT_DIGEST_CRON,
    scrape_running: _scrapeCronTask !== null,
    digest_running: _digestCronTask !== null,
  }
}
