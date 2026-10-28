import { describe, it, expect } from 'vitest'
import { registerReplyClassifierNode } from '@sdk/core/nodes/reply-classifier-node'
import { registerEmailVerifierNode, auditEmailDeliverability } from '@sdk/core/nodes/email-verifier-node'
import { registerPriceTrackerNode, parsePriceString } from '@sdk/core/nodes/price-tracker-node'
import { getNodeHandler } from '@sdk/core/engine/registry'
import type { NodeExecutionContext } from '@sdk/core/engine/types'

describe('New Pipeline Nodes: ReplyClassifier, EmailVerifier, and PriceTracker', () => {
  describe('ReplyClassifierNode', () => {
    it('should classify meeting requests as positive and route to positive port', async () => {
      registerReplyClassifierNode()
      const handler = getNodeHandler('reply_classifier' as any)
      expect(handler).toBeDefined()

      const emitted: Record<string, any[]> = {}
      const mockCtx: NodeExecutionContext = {
        nodeId: 'reply-1',
        runId: 'run-1',
        pipelineId: 'p-1',
        orgId: 1,
        config: {
          textField: 'body',
          autoTag: true,
          fieldPrefix: 'reply_',
        },
        input: {},
        incoming: [
          {
            id: 'rec-pos',
            collection: 'inbox_replies',
            data: {
              sender: 'lead@target.com',
              body: 'Yes, this looks interesting! Are you free for a 15 min call next Tuesday?',
            },
            meta: {} as any,
          },
          {
            id: 'rec-neg',
            collection: 'inbox_replies',
            data: {
              sender: 'angry@target.com',
              body: 'Please unsubscribe me and remove me from your mailing list.',
            },
            meta: {} as any,
          },
          {
            id: 'rec-ref',
            collection: 'inbox_replies',
            data: {
              sender: 'boss@target.com',
              body: "I don't handle this directly, please reach out to our VP of Sales Jane Doe.",
            },
            meta: {} as any,
          },
        ],
        log: () => {},
        isCancelled: () => false,
        isPaused: async () => {},
        emit: (records, port = 'main') => {
          emitted[port] = records
        },
      }

      await handler!.execute(mockCtx)

      expect(emitted.main).toHaveLength(3)
      expect(emitted.positive).toHaveLength(1)
      expect(emitted.positive[0].data.reply_classification).toBe('positive')
      expect(emitted.positive[0].data.reply_is_positive).toBe(true)
      expect(emitted.positive[0].data.tags).toContain('reply:positive')

      expect(emitted.negative).toHaveLength(1)
      expect(emitted.negative[0].data.reply_classification).toBe('negative')
      expect(emitted.negative[0].data.reply_is_negative).toBe(true)

      expect(emitted.referral).toHaveLength(1)
      expect(emitted.referral[0].data.reply_is_referral).toBe(true)
    })
  })

  describe('EmailVerifierNode', () => {
    it('should correctly audit email deliverability using rule-based metrics', () => {
      // 1. Valid B2B enterprise email
      const corporate = auditEmailDeliverability('satya@microsoft.com')
      expect(corporate.isValidSyntax).toBe(true)
      expect(corporate.isDisposable).toBe(false)
      expect(corporate.isFreeProvider).toBe(false)
      expect(corporate.isRoleAccount).toBe(false)
      expect(corporate.tier).toBe('valid')
      expect(corporate.score).toBeGreaterThanOrEqual(90)

      // 2. Free consumer email
      const freeGmail = auditEmailDeliverability('alex.smith@gmail.com')
      expect(freeGmail.isFreeProvider).toBe(true)
      expect(freeGmail.tier).toBe('risky')
      expect(freeGmail.score).toBeLessThan(90)

      // 3. Generic role account
      const role = auditEmailDeliverability('support@enterprise.com')
      expect(role.isRoleAccount).toBe(true)
      expect(role.tier).toBe('risky')

      // 4. Burner / Disposable email
      const burner = auditEmailDeliverability('spambox@mailinator.com')
      expect(burner.isDisposable).toBe(true)
      expect(burner.tier).toBe('invalid')
      expect(burner.score).toBe(0)

      // 5. Malformed syntax
      const malformed = auditEmailDeliverability('not-an-email')
      expect(malformed.isValidSyntax).toBe(false)
      expect(malformed.tier).toBe('invalid')
    })

    it('should execute EmailVerifierNode and route records into valid, risky, and invalid ports', async () => {
      registerEmailVerifierNode()
      const handler = getNodeHandler('email_verifier' as any)
      expect(handler).toBeDefined()

      const emitted: Record<string, any[]> = {}
      const mockCtx: NodeExecutionContext = {
        nodeId: 'verifier-1',
        runId: 'run-v1',
        pipelineId: 'p-1',
        orgId: 1,
        config: {
          emailField: 'contactEmail',
          minScoreThreshold: 75,
          fieldPrefix: 'verify_',
        },
        input: {},
        incoming: [
          {
            id: 'rec-1',
            collection: 'leads',
            data: { contactEmail: 'tim.cook@apple.com' },
            meta: {} as any,
          },
          {
            id: 'rec-2',
            collection: 'leads',
            data: { contactEmail: 'fake.lead@guerrillamail.com' },
            meta: {} as any,
          },
          {
            id: 'rec-3',
            collection: 'leads',
            data: { contactEmail: 'billing@stripe.com' },
            meta: {} as any,
          },
        ],
        log: () => {},
        isCancelled: () => false,
        isPaused: async () => {},
        emit: (records, port = 'main') => {
          emitted[port] = records
        },
      }

      await handler!.execute(mockCtx)

      expect(emitted.main).toHaveLength(3)
      expect(emitted.valid).toHaveLength(1)
      expect(emitted.valid[0].data.verify_email).toBe('tim.cook@apple.com')
      expect(emitted.valid[0].data.verify_is_valid).toBe(true)

      expect(emitted.invalid).toHaveLength(1)
      expect(emitted.invalid[0].data.verify_is_disposable).toBe(true)

      expect(emitted.risky).toHaveLength(1)
      expect(emitted.risky[0].data.verify_is_role).toBe(true)
    })
  })

  describe('PriceTrackerNode', () => {
    it('should parse currency and pricing formats accurately', () => {
      expect(parsePriceString('$199.99')).toEqual({ amount: 199.99, currency: 'USD', raw: '$199.99' })
      expect(parsePriceString('£49.50')).toEqual({ amount: 49.50, currency: 'GBP', raw: '£49.50' })
      expect(parsePriceString('€ 1,250.00')).toEqual({ amount: 1250.00, currency: 'EUR', raw: '€ 1,250.00' })
      expect(parsePriceString(99)).toEqual({ amount: 99, currency: 'USD', raw: '99' })
      expect(parsePriceString(null)).toBeNull()
      expect(parsePriceString('out of stock')).toBeNull()
    })

    it('should execute PriceTrackerNode and trigger price drop and target met ports', async () => {
      registerPriceTrackerNode()
      const handler = getNodeHandler('price_tracker' as any)
      expect(handler).toBeDefined()

      const emitted: Record<string, any[]> = {}
      const mockCtx: NodeExecutionContext = {
        nodeId: 'price-1',
        runId: 'run-p1',
        pipelineId: 'p-1',
        orgId: 1,
        config: {
          priceField: 'currentPrice',
          comparePriceField: 'originalPrice',
          targetPriceField: 'targetPrice',
          minDropPercent: 10,
          fieldPrefix: 'price_',
        },
        input: {},
        incoming: [
          {
            id: 'item-1',
            collection: 'products',
            data: {
              title: 'Noise Cancelling Headphones',
              currentPrice: '$150.00',
              originalPrice: '$200.00',
              targetPrice: '$160.00',
              inStock: true,
            },
            meta: {} as any,
          },
          {
            id: 'item-2',
            collection: 'products',
            data: {
              title: 'Wireless Mouse',
              currentPrice: '$50.00',
              originalPrice: '$50.00',
              targetPrice: '$30.00',
              inStock: false,
            },
            meta: {} as any,
          },
        ],
        log: () => {},
        isCancelled: () => false,
        isPaused: async () => {},
        emit: (records, port = 'main') => {
          emitted[port] = records
        },
      }

      await handler!.execute(mockCtx)

      expect(emitted.main).toHaveLength(2)
      // Item 1: 25% discount ($200 -> $150), below target $160
      expect(emitted.price_drop).toHaveLength(1)
      expect(emitted.price_drop[0].data.price_discount_percent).toBe(25)
      expect(emitted.price_drop[0].data.price_is_price_drop).toBe(true)

      expect(emitted.target_met).toHaveLength(1)
      expect(emitted.target_met[0].data.price_is_target_met).toBe(true)

      // Item 2 has no price drop and out of stock
      expect(emitted.in_stock).toHaveLength(1)
      expect(emitted.in_stock[0].id).toBe('item-1')
    })
  })
})
