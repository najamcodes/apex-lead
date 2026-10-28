// LinkedIn & Sales Navigator Extractor Content Script
function extractLinkedInProfile() {
  const fullName =
    document.querySelector('h1.text-heading-xlarge')?.textContent?.trim() ||
    document.querySelector('.artdeco-entity-lockup__title')?.textContent?.trim() ||
    ''

  const headline =
    document.querySelector('.text-body-medium.break-words')?.textContent?.trim() ||
    document.querySelector('.artdeco-entity-lockup__subtitle')?.textContent?.trim() ||
    ''

  const company =
    document.querySelector('button[aria-label*="Current company"]')?.textContent?.trim() ||
    document.querySelector('.inline-show-more-text--is-collapsed')?.textContent?.trim() ||
    ''

  const location =
    document.querySelector('.text-body-small.inline.t-black--light.break-words')?.textContent?.trim() ||
    ''

  const [firstName, ...rest] = fullName.split(' ')
  const lastName = rest.join(' ')

  return {
    source: 'linkedin',
    fullName,
    firstName: firstName || '',
    lastName: lastName || '',
    headline,
    company,
    location,
    url: window.location.href,
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'SCRAPE_PAGE') {
    const data = extractLinkedInProfile()
    sendResponse({ success: true, data })
  }
})
