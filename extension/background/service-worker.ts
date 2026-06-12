// extension/background/service-worker.ts
// Handles context menu registration and routes messages between
// content script, popup, and the LeadHunter local API.

import { checkAppStatus, addLead, getRecentLeads } from '../shared/api'
import type { LeadPayload } from '../shared/types'

// ── Context menu setup ───────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id:       'add-to-leadhunter',
    title:    '🎯 Add to LeadHunter',
    contexts: ['page', 'link'],
  })
})

// ── Context menu click ───────────────────────────────────────────────
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'add-to-leadhunter' || !tab?.id) return

  // Get page data from content script
  let pageData: any = null
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_DATA' })
    pageData = response?.data ?? null
  } catch {
    // Content script not injected yet — inject it manually
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files:  ['content/extractor.js'],
    })
    await new Promise((r) => setTimeout(r, 300))
    try {
      const retry = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_DATA' })
      pageData = retry?.data ?? null
    } catch { /* give up, use URL only */ }
  }

  // Build payload — use extracted data or fallback to URL + tab title
  const url = info.pageUrl ?? tab.url ?? ''
  const payload: LeadPayload = {
    business_name: pageData?.business_name ?? tab.title ?? new URL(url).hostname,
    website_url:   pageData?.website_url   ?? new URL(url).origin,
    phone:         pageData?.phone         ?? undefined,
    email:         pageData?.email         ?? undefined,
    city:          pageData?.city          ?? undefined,
    category:      pageData?.category      ?? undefined,
  }

  // Send to LeadHunter
  const result = await addLead(payload)

  // Show Chrome notification
  chrome.notifications.create({
    type:    'basic',
    iconUrl: '/icons/icon48.png',
    title:   result.ok
      ? result.duplicate
        ? 'Already in LeadHunter'
        : '✓ Lead added!'
      : '✗ Failed to add lead',
    message: result.ok
      ? result.duplicate
        ? `${payload.business_name} is already in your leads list.`
        : `${payload.business_name} added to your pipeline.`
      : result.error ?? 'Open the LeadHunter app and try again.',
  })

  // Store result in chrome.storage for popup to display
  const recent = await chrome.storage.local.get(['recentAdded'])
  const list: any[] = Array.isArray(recent.recentAdded) ? recent.recentAdded : []
  list.unshift({ ...payload, result, ts: Date.now() })
  await chrome.storage.local.set({ recentAdded: list.slice(0, 10) })
})

// ── Message handler (from popup) ─────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'ADD_LEAD') {
    addLead(message.payload).then((result) => {
      sendResponse({ type: 'ADD_LEAD_RESULT', result })
    })
    return true
  }

  if (message.type === 'APP_STATUS') {
    checkAppStatus().then((status) => {
      sendResponse({ type: 'APP_STATUS', status })
    })
    return true
  }

  if (message.type === 'GET_RECENT_LEADS') {
    getRecentLeads().then((leads) => {
      sendResponse({ type: 'RECENT_LEADS', leads })
    })
    return true
  }
})
