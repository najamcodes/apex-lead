// sdk/backend/nodes/export-node.ts
// Formatted batch data exporter supporting CSV, JSON, and NDJSON for data lakes and warehouses.

import { registerNode } from '../engine/registry'
import {
  makeDescriptor,
  strField,
  selectField,
  mainOutput,
  mainInput,
  anySchema,
} from './descriptors'
import type { NodeHandler } from '../engine/types'
import type { PipelineRecord } from '@sdk/core/types/pipeline.types'
import Papa from 'papaparse'
import { randomUUID } from 'crypto'

export function recordsToCsv(records: Array<Record<string, any>>, columns?: string[]): string {
  if (records.length === 0) return ''
  const selectedCols = columns && columns.length > 0 ? columns : undefined
  return Papa.unparse(records, {
    columns: selectedCols,
    quotes: true,
    skipEmptyLines: true,
  })
}

export function recordsToNdjson(records: Array<Record<string, any>>): string {
  return records.map((r) => JSON.stringify(r)).join('\n')
}

export function registerExportNode() {
  const handler: NodeHandler = {
    type: 'export' as any,
    async execute(ctx) {
      const format = (ctx.config.format as 'csv' | 'json' | 'ndjson') || 'csv'
      const columnsString = (ctx.config.columns as string) || ''
      const fileNameTemplate = (ctx.config.fileNameTemplate as string) || 'export_{{pipelineId}}_{{date}}'

      const columns = columnsString
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)

      const rawDataItems = ctx.incoming.map((rec) => {
        if (columns.length > 0) {
          const filtered: Record<string, any> = {}
          for (const col of columns) {
            filtered[col] = rec.data?.[col] ?? ''
          }
          return filtered
        }
        return rec.data || {}
      })

      let exportedPayload = ''
      let fileExt = '.csv'

      if (format === 'json') {
        exportedPayload = JSON.stringify(rawDataItems, null, 2)
        fileExt = '.json'
      } else if (format === 'ndjson') {
        exportedPayload = recordsToNdjson(rawDataItems)
        fileExt = '.ndjson'
      } else {
        exportedPayload = recordsToCsv(rawDataItems, columns.length > 0 ? columns : undefined)
        fileExt = '.csv'
      }

      const dateStr = new Date().toISOString().split('T')[0]
      const resolvedFileName = fileNameTemplate
        .replace(/\{\{pipelineId\}\}/g, ctx.pipelineId)
        .replace(/\{\{runId\}\}/g, ctx.runId)
        .replace(/\{\{date\}\}/g, dateStr) + fileExt

      const byteLength = Buffer.byteLength(exportedPayload, 'utf-8')

      const summaryRecord: PipelineRecord = {
        id: randomUUID(),
        collection: 'export_summaries',
        data: {
          exportSummary: {
            totalExported: rawDataItems.length,
            format,
            fileName: resolvedFileName,
            fileSizeBytes: byteLength,
            columnsExported: columns.length > 0 ? columns : Object.keys(rawDataItems[0] || {}),
            exportedPayload: byteLength < 500000 ? exportedPayload : `[Payload size: ${byteLength} bytes]`,
          },
        },
        meta: {
          pipelineId: ctx.pipelineId,
          runId: ctx.runId,
          sourceNodeId: ctx.nodeId,
          orgId: ctx.orgId,
          createdAt: new Date().toISOString(),
          trace: [ctx.nodeId],
        },
      }

      const taggedRecords: PipelineRecord[] = ctx.incoming.map((rec) => ({
        ...rec,
        data: {
          ...rec.data,
          _exported: true,
          _exportFileName: resolvedFileName,
        },
        meta: {
          ...rec.meta,
          sourceNodeId: ctx.nodeId,
          trace: [...(rec.meta.trace || []), ctx.nodeId],
        },
      }))

      ctx.log(
        'info',
        `[ExportNode] Exported ${taggedRecords.length} records to ${resolvedFileName} (${(byteLength / 1024).toFixed(1)} KB)`
      )

      ctx.emit(taggedRecords, 'main')
      ctx.emit([summaryRecord], 'summary')
    },
  }

  const descriptor = makeDescriptor({
    type: 'export' as any,
    name: 'Batch Data Export',
    description: 'Formats and exports processed lead records into CSV, JSON, or NDJSON data sinks.',
    category: 'Output',
    icon: 'FileSpreadsheet',
    color: '#059669',
    inputs: [mainInput],
    outputs: [
      mainOutput,
      { id: 'summary', label: 'Export Summary', schema: anySchema },
    ],
    configSchema: {
      format: selectField('Export Format', ['csv', 'json', 'ndjson'], 'File format for the exported records', 'csv'),
      columns: strField('Columns to Export', false, 'Comma-separated field names to export, or blank for all fields', ''),
      fileNameTemplate: strField('File Name Template', false, 'Supports {{pipelineId}}, {{runId}}, {{date}}', 'export_{{pipelineId}}_{{date}}'),
    },
    help: 'Packages records into clean CSV, JSON, or NDJSON format for reporting or importing into external warehouses.\n\nThe "Export Summary" port provides file size and column metadata.',
  })

  registerNode(handler, descriptor)
}
