;(function () {
  'use strict'

  var script = document.currentScript
  if (!script) return

  var siteKey = script.getAttribute('data-site')
  if (!siteKey) return

  var API_ENDPOINT = script.getAttribute('data-endpoint') || 'http://localhost:3000/api/v1/track'
  var sessionId =
    localStorage.getItem('_al_sid') ||
    'al_' + Math.random().toString(36).substring(2) + Date.now().toString(36)
  localStorage.setItem('_al_sid', sessionId)

  function sendBeacon(payload) {
    var data = JSON.stringify(payload)
    if (navigator.sendBeacon) {
      navigator.sendBeacon(API_ENDPOINT, data)
    } else {
      var xhr = new XMLHttpRequest()
      xhr.open('POST', API_ENDPOINT, true)
      xhr.setRequestHeader('Content-Type', 'application/json')
      xhr.send(data)
    }
  }

  var startTime = Date.now()

  // Track initial pageview
  sendBeacon({
    siteKey: siteKey,
    sessionId: sessionId,
    path: window.location.pathname,
    referrer: document.referrer || '',
    durationSeconds: 0,
  })

  // Track exit duration
  window.addEventListener('beforeunload', function () {
    var duration = Math.round((Date.now() - startTime) / 1000)
    sendBeacon({
      siteKey: siteKey,
      sessionId: sessionId,
      path: window.location.pathname,
      durationSeconds: duration,
    })
  })
})()
