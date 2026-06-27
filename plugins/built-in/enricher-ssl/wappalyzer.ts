// electron/analysis/wappalyzer.ts
// Uses wappalyzer-core to detect tech stack from a URL.
// Runs locally — no external API calls.

import Wappalyzer from 'wappalyzer-core'
import type { WappalyzerResult, DetectedTech } from '../../../shared/types/analysis.types'

// Category IDs that signal an outdated or legacy stack
const LEGACY_TECH_SIGNALS = [
  'flash',
  'silverlight',
  'jquery ui',
  'mootools',
  'prototype',
  'dreamweaver',
  'frontpage'
]

export async function detectTechStack(websiteUrl: string): Promise<WappalyzerResult> {
  try {
    const wappalyzer = new Wappalyzer()
    await wappalyzer.init()

    const site = await wappalyzer.open(websiteUrl)
    const results = await site.analyze()

    const technologies: DetectedTech[] = (results.technologies ?? []).map((t: any) => ({
      name: t.name,
      category: t.categories?.[0]?.name ?? 'unknown',
      version: t.version ?? null
    }))

    // Check for legacy signals
    const techNames = technologies.map((t) => t.name.toLowerCase())
    const hasLegacySignal = LEGACY_TECH_SIGNALS.some((sig) => techNames.includes(sig))

    // Try to infer mobile responsiveness from detected meta
    const isMobileResponsive =
      !hasLegacySignal &&
      technologies.some((t) =>
        ['bootstrap', 'tailwind css', 'foundation', 'bulma'].includes(t.name.toLowerCase())
      )

    await wappalyzer.destroy()

    return {
      technologies,
      site_built_year: null, // Wappalyzer can't give us year — SSL checker handles this
      is_mobile_responsive: isMobileResponsive ? true : null
    }
  } catch {
    return { technologies: [], site_built_year: null, is_mobile_responsive: null }
  }
}
