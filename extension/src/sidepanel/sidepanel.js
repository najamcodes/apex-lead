// Sidepanel controller
document.getElementById('extractBtn')?.addEventListener('click', async () => {
  const resultCard = document.getElementById('resultCard')
  const contactName = document.getElementById('contactName')
  const contactDetails = document.getElementById('contactDetails')
  const enrichmentStatus = document.getElementById('enrichmentStatus')

  chrome.runtime.sendMessage({ type: 'EXTRACT_ACTIVE_TAB' }, async (response) => {
    if (!response || !response.success || !response.data) {
      alert('Unable to extract data from current tab. Open a LinkedIn profile or Google Maps place.')
      return
    }

    const data = response.data
    resultCard.style.display = 'block'
    contactName.textContent = data.fullName || data.name || 'Unnamed Contact'
    contactDetails.textContent = `${data.company || data.website || ''} • ${data.headline || data.address || ''}`
    enrichmentStatus.innerHTML = '<span style="color: #818cf8;">Cascading through waterfall enrichment...</span>'

    // Call ApexLead waterfall API
    try {
      const res = await fetch('http://localhost:3000/api/enrichment/waterfall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: data.firstName || data.name?.split(' ')[0] || '',
          lastName: data.lastName || data.name?.split(' ').slice(1).join(' ') || '',
          domain: data.company || data.website || '',
          phone: data.phone || '',
        }),
      })

      const json = await res.json()
      if (json.success && json.data) {
        const email = json.data.email || 'No email found'
        const status = json.data.emailStatus || 'unknown'
        enrichmentStatus.innerHTML = `<span style="color: #34d399; font-weight: bold;">✔ ${email}</span> (${status})`
      } else {
        enrichmentStatus.innerHTML = '<span style="color: #f87171;">Enrichment failed or quota exceeded</span>'
      }
    } catch {
      enrichmentStatus.innerHTML = '<span style="color: #a1a1aa;">Saved to local leads</span>'
    }
  })
})
