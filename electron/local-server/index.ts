// electron/local-server/index.ts
// Lightweight Express server that listens on localhost only.
// The Chrome extension connects here to push leads into LeadHunter.

import express from 'express'
import cors from 'cors'
import type { Server } from 'http'
import { insertLead } from '../../backend/db/queries/leads.queries'
import { logActivity } from '../../backend/db/queries/activity.queries'
import { getDataSource } from '../../backend/db'

const PORT = 39521
let _server: Server | null = null

export function startLocalServer(): void {
  if (_server) return // already running

  const app = express()

  // Only accept requests from Chrome extensions and localhost
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || origin.startsWith('chrome-extension://') || origin === 'null') {
          cb(null, true)
        } else {
          cb(new Error('Not allowed'))
        }
      },
      methods: ['GET', 'POST']
    })
  )

  app.use(express.json({ limit: '256kb' }))

  // ─── Health check ────────────────────────────────────────────────
  app.get('/status', (_req, res) => {
    res.json({ ok: true, app: 'LeadHunter', version: '1.0.0' })
  })

  // ─── Add a lead from extension ──────────────────────────────────
  app.post('/leads', (req, res) => {
    const { business_name, category, city, country, phone, email, website_url, google_maps_url } =
      req.body

    if (!business_name || !website_url) {
      res.status(400).json({ error: 'business_name and website_url are required' })
      return
    }

    try {
      insertLead({
        business_name: String(business_name).trim(),
        category: String(category ?? '').trim(),
        city: String(city ?? '').trim(),
        country: String(country ?? 'Unknown').trim(),
        phone: phone ? String(phone).trim() : undefined,
        email: email ? String(email).trim() : undefined,
        website_url: String(website_url).trim(),
        google_maps_url: google_maps_url ? String(google_maps_url) : undefined,
        website_status: 'unchecked',
        source: 'extension'
      }).then(lead => {
        if (lead) {
          logActivity(lead.id, 'lead_scraped', 'Added via Chrome extension')
        }
        res.json({ ok: true, lead: lead ?? null, duplicate: lead === null })
      }).catch(err => {
        res.status(500).json({ error: String(err) })
      })
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // ─── Get recent extension-added leads ──────────────────────────
  app.get('/leads', async (_req, res) => {
    try {
      const leads = await getDataSource().createQueryBuilder()
        .select(['id', 'business_name', 'category', 'city', 'website_url', 'website_status', 'status', 'ai_site_score', 'scraped_at'])
        .from('leads', 'leads')
        .where("source = 'extension'")
        .orderBy('scraped_at', 'DESC')
        .limit(10)
        .getRawMany()
      res.json({ leads })
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  _server = app.listen(PORT, '127.0.0.1', () => {
    console.log(`[LocalServer] Listening on http://127.0.0.1:${PORT}`)
  })

  _server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[LocalServer] Port ${PORT} already in use — skipping`)
    }
  })
}

export function stopLocalServer(): void {
  if (_server) {
    _server.close()
    _server = null
  }
}
