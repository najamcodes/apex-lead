// backend/nodes/filter-node.ts
// Drops records that don't match a condition.
// Supports both raw JS expressions and a structured rule builder.

import { registerNode } from '../engine/registry'
import { makeDescriptor, textField, selectField, jsonField, mainOutput, mainInput, getPath } from './descriptors'
import { evalCondition } from '../engine/graph'
import type { NodeHandler } from '../engine/types'

interface FilterRule {
  field: string
  op: '==' | '!=' | '>' | '>=' | '<' | '<=' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'exists' | 'not_exists' | 'in' | 'not_in'
  value?: unknown
}

interface FilterGroup {
  operator: 'AND' | 'OR'
  rules: FilterRule[]
}

function evalRule(rule: FilterRule, data: Record<string, unknown>): boolean {
  const val = getPath(rule.field, data)
  const v = val as any
  const rv = rule.value
  switch (rule.op) {
    case '==': return v == rv
    case '!=': return v != rv
    case '>': return Number(v) > Number(rv)
    case '>=': return Number(v) >= Number(rv)
    case '<': return Number(v) < Number(rv)
    case '<=': return Number(v) <= Number(rv)
    case 'contains': return typeof v === 'string' && v.toLowerCase().includes(String(rv).toLowerCase())
    case 'not_contains': return typeof v !== 'string' || !v.toLowerCase().includes(String(rv).toLowerCase())
    case 'starts_with': return typeof v === 'string' && v.startsWith(String(rv))
    case 'ends_with': return typeof v === 'string' && v.endsWith(String(rv))
    case 'exists': return v !== null && v !== undefined && v !== ''
    case 'not_exists': return v === null || v === undefined || v === ''
    case 'in': return Array.isArray(rv) ? rv.includes(v) : String(rv).split(',').map(s => s.trim()).includes(String(v))
    case 'not_in': return Array.isArray(rv) ? !rv.includes(v) : !String(rv).split(',').map(s => s.trim()).includes(String(v))
    default: return true
  }
}

function evalGroup(group: FilterGroup, data: Record<string, unknown>): boolean {
  const results = group.rules.map(r => evalRule(r, data))
  return group.operator === 'AND'
    ? results.every(Boolean)
    : results.some(Boolean)
}

export function registerFilterNode() {
  const handler: NodeHandler = {
    type: 'filter',
    async execute(ctx) {
      const mode = (ctx.config.filter_mode as string) || 'expression'
      const condition = ctx.config.condition as string
      const rules = ctx.config.rules as FilterGroup | undefined

      let kept = 0, dropped = 0

      for (const rec of ctx.incoming) {
        if (ctx.isCancelled()) break
        await ctx.isPaused()

        let pass = true
        if (mode === 'rules' && rules) {
          pass = evalGroup(rules, rec.data)
        } else if (condition) {
          pass = evalCondition(condition, rec.data)
        }

        if (pass) {
          ctx.emit(rec, 'main')
          kept++
        } else {
          ctx.emit(rec, 'discarded')
          dropped++
        }
      }
      ctx.log('info', `Filter: ${kept} kept, ${dropped} dropped`)
    },
  }

  const descriptor = makeDescriptor({
    type: 'filter',
    name: 'Filter',
    description: 'Drop records that don\'t match your conditions. Supports visual rule builder or custom JavaScript.',
    category: 'Logic',
    icon: 'Filter',
    color: '#64748b',
    inputs: [mainInput],
    outputs: [
      mainOutput,
      { id: 'discarded', label: 'Discarded', schema: { fields: {}, multiple: true, description: 'Records that failed the filter condition' } },
    ],
    configSchema: {
      filter_mode: selectField('Filter mode', ['expression', 'rules'],
        'expression: write JS; rules: use structured rule builder.', 'expression'),
      condition: textField('JS Condition', false,
        'JavaScript expression. Available: data (record fields). e.g. data.price > 100 && data.in_stock'),
      rules: jsonField('Rules (structured)', 'JSON rule group: { "operator": "AND", "rules": [{ "field": "price", "op": ">", "value": 100 }] }',
        { operator: 'AND', rules: [{ field: 'field_name', op: '==', value: 'expected_value' }] }),
    },
    help: 'Expression mode examples:\n• data.email !== null\n• data.price > 100 && data.in_stock\n• data.status === "approved"\n\nRule operators: ==, !=, >, >=, <, <=, contains, not_contains, starts_with, ends_with, exists, not_exists, in, not_in\n\n"in" accepts a comma-separated list or an array as value.',
  })

  registerNode(handler, descriptor)
}
