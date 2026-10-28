// Google Maps Business Extractor Content Script
function extractGoogleMapsPlace() {
  const name = document.querySelector('h1.DUwDvf')?.textContent?.trim() || ''

  const ratingEl = document.querySelector('span.ceNzKf')
  const rating = ratingEl ? parseFloat(ratingEl.getAttribute('aria-label') || '0') : null

  const reviewsText = document.querySelector('span[aria-label*="reviews"]')?.textContent?.trim() || ''
  const reviews = parseInt(reviewsText.replace(/[^0-9]/g, ''), 10) || 0

  const websiteEl = document.querySelector('a[aria-label*="Website:"]') as HTMLAnchorElement | null
  const website = websiteEl ? websiteEl.href : ''

  const phoneEl = document.querySelector('button[aria-label*="Phone:"]') as HTMLButtonElement | null
  const phone = phoneEl ? phoneEl.getAttribute('aria-label')?.replace('Phone: ', '').trim() || '' : ''

  const addressEl = document.querySelector('button[aria-label*="Address:"]') as HTMLButtonElement | null
  const address = addressEl ? addressEl.getAttribute('aria-label')?.replace('Address: ', '').trim() || '' : ''

  return {
    source: 'google_maps',
    name,
    rating,
    reviews,
    website,
    phone,
    address,
    url: window.location.href,
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'SCRAPE_PAGE') {
    const data = extractGoogleMapsPlace()
    sendResponse({ success: true, data })
  }
})
