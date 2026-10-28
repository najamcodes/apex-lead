import type { RequestContext, Next } from 'katal'
import type { AuthRequestContext } from './AuthMiddleware'
import { QuotaService, QuotaFeature } from '../services/QuotaService'

export function enforceQuota(feature: QuotaFeature, quantity = 1) {
  const quotaService = new QuotaService()

  return async (context: RequestContext, next: Next) => {
    const authCtx = context as AuthRequestContext
    const orgId = typeof authCtx.user?.orgId === 'number'
      ? authCtx.user.orgId
      : (typeof authCtx.state?.tenantId === 'number' ? authCtx.state.tenantId : 1)
    const check = await quotaService.checkQuota(orgId, feature, quantity)

    if (!check.allowed) {
      const message = feature === 'cloudScrapes'
        ? 'Cloud browser scraping requires Pro or Agency tier. Run via Desktop App or upgrade your plan.'
        : `Monthly quota exceeded for ${feature}. Upgrade your plan to unlock more credits.`

      return new Response(JSON.stringify({
        error: message,
        feature,
        remaining: check.remaining,
        limit: check.limit,
        currentUsage: check.currentUsage,
        upgradeUrl: '/pricing',
      }), {
        status: 402,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return await next()
  }
}
