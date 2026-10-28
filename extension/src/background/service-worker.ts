// Background Service Worker (Manifest V3)
chrome.runtime.onInstalled.addListener(() => {
  console.log('[ApexLead Extension] Installed successfully.')
})

// Enable side panel on click
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error))
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXTRACT_ACTIVE_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0]
      if (!activeTab || !activeTab.id) {
        sendResponse({ success: false, error: 'No active tab found' })
        return
      }

      chrome.tabs.sendMessage(activeTab.id, { type: 'SCRAPE_PAGE' }, (response) => {
        sendResponse(response || { success: false, error: 'Content script not responding' })
      })
    })
    return true // Keep channel open for async response
  }
})
