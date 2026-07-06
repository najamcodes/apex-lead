// electron/pipeline/digest-builder.ts
// Builds a clean, professional HTML digest email.

import type { DigestRun } from '../../shared/types/pipeline.types'

interface TopLead {
  business_name:   string
  city:            string
  category:        string
  ai_site_score:   number | null
  website_status:  string
  phone:           string | null
  website_url:     string | null
}

export function buildDigestHtml(
  digest: Omit<DigestRun, 'id'>,
  topLeads: TopLead[],
  settings: { developer_name: string; default_city: string }
): string {
  const date    = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const leadsHtml = topLeads.slice(0, 8).map((lead) => {
    const scoreBg = !lead.ai_site_score
      ? '#3f3f46'
      : lead.ai_site_score < 35 ? '#dc2626'
      : lead.ai_site_score < 60 ? '#d97706'
      : '#16a34a'

    const websiteBadge = lead.website_status === 'none'
      ? '<span style="background:#fef2f2;color:#dc2626;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">NO WEBSITE</span>'
      : lead.website_status === 'outdated'
      ? '<span style="background:#fffbeb;color:#d97706;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">OUTDATED</span>'
      : '<span style="background:#f0fdf4;color:#16a34a;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">HAS SITE</span>'

    return `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #f4f4f5;">
          <div style="font-weight:600;color:#18181b;font-size:14px;">${escapeHtml(lead.business_name)}</div>
          <div style="color:#71717a;font-size:12px;margin-top:2px;">${escapeHtml(lead.category)} · ${escapeHtml(lead.city)}</div>
        </td>
        <td style="padding:12px 16px;border-bottom:1px solid #f4f4f5;text-align:center;">
          ${websiteBadge}
        </td>
        <td style="padding:12px 16px;border-bottom:1px solid #f4f4f5;text-align:center;">
          <span style="background:${scoreBg};color:#fff;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:700;">
            ${lead.ai_site_score ?? '—'}
          </span>
        </td>
        <td style="padding:12px 16px;border-bottom:1px solid #f4f4f5;color:#52525b;font-size:12px;">
          ${lead.phone ? `📞 ${escapeHtml(lead.phone)}` : '<span style="color:#d4d4d8;">—</span>'}
        </td>
      </tr>
    `
  }).join('')

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>LeadHunter Daily Digest — ${date}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

        <!-- Header -->
        <tr>
          <td style="background:#18181b;padding:28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div style="display:inline-block;background:#059669;width:32px;height:32px;border-radius:8px;text-align:center;line-height:32px;color:#fff;font-weight:800;font-size:18px;margin-bottom:12px;">L</div>
                  <div style="color:#ffffff;font-size:20px;font-weight:700;">LeadHunter Daily Digest</div>
                  <div style="color:#a1a1aa;font-size:14px;margin-top:4px;">${date}</div>
                </td>
                <td align="right" style="vertical-align:top;">
                  <div style="color:#71717a;font-size:12px;">Hi ${escapeHtml(settings.developer_name || 'there')} 👋</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Stats row -->
        <tr>
          <td style="padding:24px 32px;background:#fafafa;border-bottom:1px solid #f4f4f5;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                ${[
                  { label: 'New leads',    value: digest.total_new,        color: '#18181b' },
                  { label: 'No website',   value: digest.total_no_website, color: '#dc2626' },
                  { label: 'Qualified',    value: digest.total_qualified,  color: '#059669' },
                  { label: 'Total scraped',value: digest.total_scraped,    color: '#6366f1' },
                ].map((stat) => `
                  <td align="center" style="padding:0 8px;">
                    <div style="font-size:28px;font-weight:800;color:${stat.color};">${stat.value}</div>
                    <div style="font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;margin-top:4px;">${stat.label}</div>
                  </td>
                `).join('')}
              </tr>
            </table>
          </td>
        </tr>

        <!-- Opportunity callout -->
        ${digest.total_no_website > 0 ? `
        <tr>
          <td style="padding:16px 32px;">
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 16px;">
              <span style="color:#15803d;font-size:14px;">
                🎯 <strong>${digest.total_no_website} businesses</strong> have no website at all — prime targets for your web services.
              </span>
            </div>
          </td>
        </tr>
        ` : ''}

        <!-- Top leads table -->
        <tr>
          <td style="padding:8px 32px 0;">
            <div style="font-size:13px;font-weight:600;color:#52525b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;">
              Top leads this morning
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f4f4f5;border-radius:8px;overflow:hidden;">
              <thead>
                <tr style="background:#fafafa;">
                  <th style="padding:10px 16px;text-align:left;font-size:11px;color:#a1a1aa;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Business</th>
                  <th style="padding:10px 16px;text-align:center;font-size:11px;color:#a1a1aa;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Website</th>
                  <th style="padding:10px 16px;text-align:center;font-size:11px;color:#a1a1aa;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">AI Score</th>
                  <th style="padding:10px 16px;text-align:left;font-size:11px;color:#a1a1aa;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Phone</th>
                </tr>
              </thead>
              <tbody>
                ${leadsHtml || '<tr><td colspan="4" style="padding:24px;text-align:center;color:#a1a1aa;font-size:13px;">No leads found in this run</td></tr>'}
              </tbody>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:0 32px 32px;text-align:center;">
            <div style="color:#71717a;font-size:13px;margin-bottom:16px;">
              These leads are waiting in your LeadHunter pipeline, ready to review and contact.
            </div>
            <div style="display:inline-block;background:#059669;color:#ffffff;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">
              Open LeadHunter
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;background:#fafafa;border-top:1px solid #f4f4f5;">
            <div style="color:#a1a1aa;font-size:11px;text-align:center;">
              LeadHunter · Running locally on your machine ·
              <a href="#" style="color:#a1a1aa;">Manage schedule</a>
            </div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
  `
}

export function buildDigestText(
  digest: Omit<DigestRun, 'id'>,
  topLeads: TopLead[]
): string {
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const lines = [
    `LeadHunter Daily Digest — ${date}`,
    '─'.repeat(40),
    `New leads:      ${digest.total_new}`,
    `No website:     ${digest.total_no_website}`,
    `Qualified:      ${digest.total_qualified}`,
    `Total scraped:  ${digest.total_scraped}`,
    '',
    'TOP LEADS:',
    ...topLeads.slice(0, 8).map((l) =>
      `• ${l.business_name} (${l.city}) — ${l.website_status} — Score: ${l.ai_site_score ?? '—'} — ${l.phone ?? 'no phone'}`
    ),
    '',
    'Open LeadHunter to review and contact these leads.',
  ]
  return lines.join('\n')
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
