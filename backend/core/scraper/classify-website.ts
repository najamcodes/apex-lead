// electron/scraper/classify-website.ts
// Quick synchronous classification based on URL alone.
// Phase 3 will add PageSpeed + AI analysis on top.

export function classifyWebsiteStatus(websiteUrl: string | null): 'none' | 'unchecked' {
  if (!websiteUrl || websiteUrl.trim() === '') return 'none'
  return 'unchecked' // Phase 3 will resolve 'unchecked' → 'outdated' | 'modern'
}
