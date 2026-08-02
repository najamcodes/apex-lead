// backend/nodes/spreadsheet-node.ts
// Read CSV text/string into records, or collect records into a CSV string.

import { registerNode } from '../engine/registry'
import { makeDescriptor, selectField, strField, textField, mainOutput, mainInput } from './descriptors'
import { randomUUID } from 'crypto'
import type { NodeHandler } from '../engine/types'
import type { PipelineRecord } from '../../shared/types/pipeline.types'

export function registerSpreadsheetNode() {
  const handler: NodeHandler = {
    type: 'spreadsheet',
    async execute(ctx) {
      const mode = (ctx.config.mode as string) || 'read'
      const delimiter = (ctx.config.delimiter as string) || ','

      if (mode === 'read') {
        // Read mode: parse CSV from a field on incoming records (or from config)
        const sourceField = (ctx.config.source_field as string) || 'csv'
        const collection = (ctx.config.collection as string) || 'rows'

        const sources: string[] = []
        if (ctx.incoming.length === 0 && ctx.config.csv_data) {
          sources.push(ctx.config.csv_data as string)
        } else {
          for (const rec of ctx.incoming) {
            const csv = rec.data[sourceField]
            if (typeof csv === 'string') sources.push(csv)
          }
        }

        for (const csv of sources) {
          const rows = parseCSV(csv, delimiter)
          ctx.log('info', `Spreadsheet: parsed ${rows.length} rows`)
          for (const row of rows) {
            if (ctx.isCancelled()) break
            const outRec: PipelineRecord = {
              id: randomUUID(),
              collection,
              data: row,
              meta: {
                pipelineId: ctx.pipelineId,
                runId: ctx.runId,
                sourceNodeId: ctx.nodeId,
                orgId: ctx.orgId,
                createdAt: new Date().toISOString(),
                trace: [ctx.nodeId],
              },
            }
            ctx.emit(outRec)
          }
        }
      } else {
        // Write mode: collect all incoming records and produce a CSV string on a single output record
        const outputField = (ctx.config.output_field as string) || 'csv'
        const includeHeader = ctx.config.include_header !== false

        if (ctx.incoming.length === 0) {
          ctx.log('warn', 'Spreadsheet write: no records received')
          return
        }

        const keys = [...new Set(ctx.incoming.flatMap(r => Object.keys(r.data)))]
        const lines: string[] = []
        if (includeHeader) lines.push(keys.map(k => escapeCSV(k, delimiter)).join(delimiter))
        for (const rec of ctx.incoming) {
          lines.push(keys.map(k => escapeCSV(String(rec.data[k] ?? ''), delimiter)).join(delimiter))
        }
        const csv = lines.join('\n')

        const outRec: PipelineRecord = {
          id: randomUUID(),
          collection: ctx.incoming[0].collection,
          data: {
            [outputField]: csv,
            _row_count: ctx.incoming.length,
          },
          meta: {
            pipelineId: ctx.pipelineId,
            runId: ctx.runId,
            sourceNodeId: ctx.nodeId,
            orgId: ctx.orgId,
            createdAt: new Date().toISOString(),
            trace: [...(ctx.incoming[0].meta.trace ?? []), ctx.nodeId],
          },
        }
        ctx.emit(outRec)
        ctx.log('info', `Spreadsheet: produced CSV with ${ctx.incoming.length} rows`)
      }
    },
  }

  const descriptor = makeDescriptor({
    type: 'spreadsheet',
    name: 'Spreadsheet / CSV',
    description: 'Read mode: parse a CSV string into individual records. Write mode: collect records into a CSV string.',
    category: 'Transform',
    icon: 'Table',
    color: '#22c55e',
    isStart: true,
    produces: true,
    inputs: [mainInput],
    outputs: [mainOutput],
    configSchema: {
      mode: selectField('Mode', ['read', 'write'], 'read = parse CSV → records; write = records → CSV string.', 'read'),
      delimiter: strField('Delimiter', false, 'Column separator character.', ','),
      source_field: strField('CSV source field', false, 'In read mode: field on incoming record containing CSV text.', 'csv'),
      csv_data: textField('CSV data', false, 'In read mode (no upstream): paste CSV content directly here.'),
      collection: strField('Collection', false, 'Collection name for emitted row records.', 'rows'),
      output_field: strField('Output field', false, 'In write mode: field name to store the resulting CSV string.', 'csv'),
      include_header: { type: 'boolean', label: 'Include header row', default: true },
    },
    help: 'Read mode: connect to no upstream (paste CSV here) or connect to a node that outputs a csv field.\nWrite mode: connect to any node that emits multiple records — all will be collected into one CSV output.',
  })

  registerNode(handler, descriptor)
}

function parseCSV(csv: string, delimiter: string): Record<string, string>[] {
  const lines = csv.trim().split('\n').map(l => l.trimEnd())
  if (lines.length < 2) return []
  const headers = splitLine(lines[0], delimiter)
  return lines.slice(1).map(line => {
    const vals = splitLine(line, delimiter)
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = vals[i] ?? '' })
    return obj
  })
}

function splitLine(line: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === delimiter && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

function escapeCSV(val: string, delimiter: string): string {
  if (val.includes('"') || val.includes('\n') || val.includes(delimiter)) {
    return `"${val.replace(/"/g, '""')}"`
  }
  return val
}
