// sdk/backend/nodes/price-tracker-node.ts
// Pipeline node for e-commerce and competitor pricing intelligence.
// Parses raw pricing strings/currencies, tracks historical deltas, discount percentages, stock availability,
// and emits triggers when prices drop below threshold or target prices are met.

import { registerNode } from '../engine/registry'
import {
  makeDescriptor,
  strField,
  numField,
  mainOutput,
  mainInput,
  anySchema,
} from './descriptors'
import type { NodeHandler } from '../engine/types'
import type { PipelineRecord } from '@sdk/core/types/pipeline.types'

export interface ParsedPrice {
  amount: number
  currency: string
  raw: string
}

export function parsePriceString(val: unknown): ParsedPrice | null {
  if (typeof val === 'number') {
    return { amount: val, currency: 'USD', raw: String(val) }
  }
  if (!val || typeof val !== 'string') return null

  const clean = val.trim()
  if (!clean) return null

  let currency = 'USD'
  if (clean.includes('$')) currency = 'USD'
  else if (clean.includes('€')) currency = 'EUR'
  else if (clean.includes('£')) currency = 'GBP'
  else if (clean.includes('¥')) currency = 'JPY'
  else if (/usd/i.test(clean)) currency = 'USD'
  else if (/eur/i.test(clean)) currency = 'EUR'
  else if (/gbp/i.test(clean)) currency = 'GBP'

  // Normalize decimal separators (e.g., European 19,99 -> 19.99 or 1,299.00 -> 1299.00)
  const numMatches = clean.match(/[\d,.]+/g)
  if (!numMatches || numMatches.length === 0) return null

  let numStr = numMatches[0]
  if (numStr.includes(',') && numStr.includes('.')) {
    // 1,234.56 -> strip comma
    numStr = numStr.replace(/,/g, '')
  } else if (numStr.includes(',') && !numStr.includes('.')) {
    // 19,99 -> 19.99
    numStr = numStr.replace(',', '.')
  }

  const amount = parseFloat(numStr)
  if (isNaN(amount)) return null

  return {
    amount: Number(amount.toFixed(2)),
    currency,
    raw: clean,
  }
}

export function registerPriceTrackerNode() {
  const handler: NodeHandler = {
    type: 'price_tracker' as any,
    async execute(ctx) {
      const priceField = (ctx.config.priceField as string) || 'price'
      const compareField = (ctx.config.comparePriceField as string) || 'originalPrice'
      const targetPriceField = (ctx.config.targetPriceField as string) || 'targetPrice'
      const stockField = (ctx.config.stockField as string) || 'inStock'
      const minDropPercent = Number(ctx.config.minDropPercent ?? 5)
      const prefix = ctx.config.fieldPrefix !== undefined ? String(ctx.config.fieldPrefix) : 'price_'

      const priceDropRecords: PipelineRecord[] = []
      const targetMetRecords: PipelineRecord[] = []
      const inStockRecords: PipelineRecord[] = []
      const allRecords: PipelineRecord[] = []

      for (const rec of ctx.incoming) {
        if (ctx.isCancelled()) break
        await ctx.isPaused()

        const recData = (rec && typeof rec.data === 'object' && rec.data !== null) ? rec.data : {}

        const parsedCurrent = parsePriceString(recData[priceField])
        const parsedCompare = parsePriceString(recData[compareField] || recData.previousPrice || recData.listPrice)
        const parsedTarget = parsePriceString(recData[targetPriceField])

        const currentAmount = parsedCurrent ? parsedCurrent.amount : 0
        const compareAmount = parsedCompare ? parsedCompare.amount : 0
        const targetAmount = parsedTarget ? parsedTarget.amount : (Number(ctx.config.staticTargetPrice) || 0)

        const delta = compareAmount > 0 ? Number((currentAmount - compareAmount).toFixed(2)) : 0
        const discountPercent = compareAmount > 0
          ? Number((((compareAmount - currentAmount) / compareAmount) * 100).toFixed(2))
          : 0

        const isPriceDrop = delta < 0 && discountPercent >= minDropPercent
        const isTargetMet = targetAmount > 0 && currentAmount <= targetAmount

        // Check stock status
        const rawStock = recData[stockField]
        const inStock = rawStock === undefined
          ? true
          : Boolean(rawStock === true || rawStock === 'true' || rawStock === 1 || String(rawStock).toLowerCase() === 'in stock')

        const enrichedData: Record<string, unknown> = {
          ...recData,
          [`${prefix}current`]: currentAmount,
          [`${prefix}currency`]: parsedCurrent?.currency || 'USD',
          [`${prefix}previous`]: compareAmount || null,
          [`${prefix}delta`]: delta,
          [`${prefix}discount_percent`]: discountPercent,
          [`${prefix}is_price_drop`]: isPriceDrop,
          [`${prefix}is_target_met`]: isTargetMet,
          [`${prefix}in_stock`]: inStock,
        }

        const enrichedRec: PipelineRecord = {
          ...rec,
          data: enrichedData,
          meta: {
            ...rec.meta,
            sourceNodeId: ctx.nodeId,
            trace: [...(rec.meta?.trace || []), ctx.nodeId],
          },
        }

        allRecords.push(enrichedRec)

        if (isPriceDrop) priceDropRecords.push(enrichedRec)
        if (isTargetMet) targetMetRecords.push(enrichedRec)
        if (inStock) inStockRecords.push(enrichedRec)
      }

      ctx.log(
        'info',
        `[PriceTracker] Evaluated ${allRecords.length} items: ${priceDropRecords.length} price drops (>=${minDropPercent}%), ${targetMetRecords.length} target price met, ${inStockRecords.length} in-stock`
      )

      ctx.emit(allRecords, 'main')
      if (priceDropRecords.length > 0) ctx.emit(priceDropRecords, 'price_drop')
      if (targetMetRecords.length > 0) ctx.emit(targetMetRecords, 'target_met')
      if (inStockRecords.length > 0) ctx.emit(inStockRecords, 'in_stock')
    },
  }

  const descriptor = makeDescriptor({
    type: 'price_tracker' as any,
    name: 'Competitor Price & Stock Tracker',
    description: 'E-commerce price intelligence: extracts currency and prices, calculates discounts & price drops, checks stock, and emits re-pricing triggers.',
    category: 'Process',
    icon: 'DollarSign',
    color: '#F59E0B',
    inputs: [mainInput],
    outputs: [
      mainOutput,
      { id: 'price_drop', label: 'Price Drop Detected', schema: anySchema },
      { id: 'target_met', label: 'Target Price Met', schema: anySchema },
      { id: 'in_stock', label: 'In Stock Only', schema: anySchema },
    ],
    configSchema: {
      priceField: strField('Current Price Field', false, 'Field holding the active item price', 'price'),
      comparePriceField: strField('Comparison / Original Price Field', false, 'Field holding original/list price to calculate discounts', 'originalPrice'),
      targetPriceField: strField('Target Price Key', false, 'Property holding target price threshold', 'targetPrice'),
      staticTargetPrice: numField('Static Target Price', false, 'Static target price threshold if not provided on record', 0),
      minDropPercent: numField('Minimum Price Drop %', false, 'Minimum discount/drop percentage to trigger alert', 5),
      stockField: strField('Stock Property Key', false, 'Field holding inventory/stock availability', 'inStock'),
      fieldPrefix: strField('Field Prefix', false, 'Prefix for generated price metrics', 'price_'),
    },
  })

  registerNode(handler, descriptor)
}
