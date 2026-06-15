import { chromium, type Page, type Browser } from 'playwright'

export interface CrawledWebsiteData {
  url: string
  homepageText: string
  aboutText: string
  teamText: string
  contactText: string
  emailsFound: string[]
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g

async function extractTextAndEmails(page: Page): Promise<{ text: string; emails: string[] }> {
  try {
    // Remove unwanted elements like scripts, styles, navs, footers to reduce noise
    await page.evaluate(() => {
      const selectorsToRemove = ['script', 'style', 'nav', 'footer', 'header', 'noscript', 'svg']
      selectorsToRemove.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => el.remove())
      })
    })

    const text = await page.evaluate(() => document.body.innerText)
    const normalizedText = text.replace(/\s+/g, ' ').trim()
    
    // Extract emails using regex
    const emails = Array.from(new Set(normalizedText.match(EMAIL_REGEX) || []))
    
    return { text: normalizedText.slice(0, 5000), emails } // Limit text to 5000 chars per page
  } catch (err) {
    return { text: '', emails: [] }
  }
}

export async function crawlWebsiteForDecisionMakers(baseUrl: string): Promise<CrawledWebsiteData> {
  const data: CrawledWebsiteData = {
    url: baseUrl,
    homepageText: '',
    aboutText: '',
    teamText: '',
    contactText: '',
    emailsFound: []
  }

  let browser: Browser | null = null
  try {
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    })
    const page = await context.newPage()

    // 1. Visit Homepage
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => null)
    const homeResult = await extractTextAndEmails(page)
    data.homepageText = homeResult.text
    data.emailsFound.push(...homeResult.emails)

    // Find links to subpages
    const links = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a'))
      return anchors.map(a => ({ href: a.href, text: a.innerText.toLowerCase() }))
    })

    const aboutLink = links.find(l => l.text.includes('about') || l.href.includes('/about'))?.href
    const teamLink = links.find(l => l.text.includes('team') || l.text.includes('staff') || l.href.includes('/team'))?.href
    const contactLink = links.find(l => l.text.includes('contact') || l.href.includes('/contact'))?.href

    // 2. Visit About Page
    if (aboutLink && aboutLink.startsWith('http')) {
      await page.goto(aboutLink, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => null)
      const aboutResult = await extractTextAndEmails(page)
      data.aboutText = aboutResult.text
      data.emailsFound.push(...aboutResult.emails)
    }

    // 3. Visit Team Page
    if (teamLink && teamLink.startsWith('http') && teamLink !== aboutLink) {
      await page.goto(teamLink, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => null)
      const teamResult = await extractTextAndEmails(page)
      data.teamText = teamResult.text
      data.emailsFound.push(...teamResult.emails)
    }

    // 4. Visit Contact Page
    if (contactLink && contactLink.startsWith('http') && contactLink !== aboutLink && contactLink !== teamLink) {
      await page.goto(contactLink, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => null)
      const contactResult = await extractTextAndEmails(page)
      data.contactText = contactResult.text
      data.emailsFound.push(...contactResult.emails)
    }

    // Deduplicate emails
    data.emailsFound = Array.from(new Set(data.emailsFound))

  } catch (err) {
    console.error(`[WebsiteCrawler] Failed to crawl ${baseUrl}:`, err)
  } finally {
    if (browser) await browser.close()
  }

  return data
}
