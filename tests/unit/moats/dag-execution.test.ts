import { describe, it, expect } from 'bun:test'
import {
  TopologicalSorter,
  DagGraph,
} from '../../../server/src/core/engine/TopologicalSorter'
import { SandboxedCodeRunner } from '../../../server/src/core/engine/SandboxedCodeRunner'
import { DagExecutionEngine } from '../../../server/src/core/engine/DagExecutionEngine'

describe('Visual DAG Engine & Sandboxed Execution (Phase 6)', () => {
  describe('TopologicalSorter', () => {
    it('should correctly order linear DAG nodes and build execution layers', () => {
      const graph: DagGraph = {
        nodes: [
          { id: 'step-1', type: 'source', data: {} },
          { id: 'step-2', type: 'filter', data: {} },
          { id: 'step-3', type: 'enricher', data: {} },
        ],
        edges: [
          { source: 'step-1', target: 'step-2' },
          { source: 'step-2', target: 'step-3' },
        ],
      }

      const result = TopologicalSorter.sort(graph)
      expect(result.hasCycle).toBe(false)
      expect(result.sortedNodeIds).toEqual(['step-1', 'step-2', 'step-3'])
      expect(result.executionLayers).toEqual([['step-1'], ['step-2'], ['step-3']])
    })

    it('should order branching multi-path DAG into parallel execution layers', () => {
      const graph: DagGraph = {
        nodes: [
          { id: 'A', type: 'source', data: {} },
          { id: 'B1', type: 'filter', data: {} },
          { id: 'B2', type: 'transform', data: {} },
          { id: 'C', type: 'enricher', data: {} },
        ],
        edges: [
          { source: 'A', target: 'B1' },
          { source: 'A', target: 'B2' },
          { source: 'B1', target: 'C' },
          { source: 'B2', target: 'C' },
        ],
      }

      const result = TopologicalSorter.sort(graph)
      expect(result.hasCycle).toBe(false)
      expect(result.executionLayers[0]).toEqual(['A'])
      expect(result.executionLayers[1]).toContain('B1')
      expect(result.executionLayers[1]).toContain('B2')
      expect(result.executionLayers[2]).toEqual(['C'])
    })

    it('should detect cycles and mark hasCycle: true', () => {
      const cyclicGraph: DagGraph = {
        nodes: [
          { id: 'node-A', type: 'filter', data: {} },
          { id: 'node-B', type: 'transform', data: {} },
          { id: 'node-C', type: 'enricher', data: {} },
        ],
        edges: [
          { source: 'node-A', target: 'node-B' },
          { source: 'node-B', target: 'node-C' },
          { source: 'node-C', target: 'node-A' }, // Cycle back to A
        ],
      }

      const result = TopologicalSorter.sort(cyclicGraph)
      expect(result.hasCycle).toBe(true)
    })
  })

  describe('SandboxedCodeRunner', () => {
    it('should safely execute user transform code on record', () => {
      const transformCode = `
        (record) => ({
          ...record,
          normalizedPhone: record.phone.replace(/[^0-9]/g, ''),
          score: Math.round(record.rating * 20),
          tag: 'qualified'
        })
      `

      const raw = {
        name: 'Apex Solar',
        phone: '(555) 789-1234',
        rating: 4.8,
      }

      const transformed = SandboxedCodeRunner.executeTransform(transformCode, raw)
      expect(transformed.name).toBe('Apex Solar')
      expect(transformed.normalizedPhone).toBe('5557891234')
      expect(transformed.score).toBe(96)
      expect(transformed.tag).toBe('qualified')
    })

    it('should protect against prototype pollution exploits', () => {
      const maliciousCode = `
        (record) => {
          if (record.__proto__) {
            record.__proto__.polluted = true;
          }
          return { ...record, status: 'ok', __proto__: { polluted: true } };
        }
      `

      const raw = { name: 'Test Corp' }
      const output = SandboxedCodeRunner.executeTransform(maliciousCode, raw)
      expect(output.status).toBe('ok')
      expect((Object.prototype as any).polluted).toBeUndefined()
      expect((output as any).polluted).toBeUndefined()
    })


    it('should enforce execution timeout and terminate infinite loops', () => {
      const infiniteLoopCode = `
        (record) => {
          let count = 0;
          while (true) {
            count++;
          }
          return record;
        }
      `

      expect(() => {
        SandboxedCodeRunner.executeTransform(infiniteLoopCode, { test: 123 })
      }).toThrow()
    })

    it('should reject non-function evaluation strings', () => {
      expect(() => {
        SandboxedCodeRunner.executeTransform('"just a string, not a function"', { test: 123 })
      }).toThrow(/must evaluate to a function/)
    })
  })

  describe('DagExecutionEngine', () => {
    it('should reject cyclic graphs before execution', async () => {
      const engine = new DagExecutionEngine()
      const cyclicGraph: DagGraph = {
        nodes: [
          { id: 'A', type: 'source', data: {} },
          { id: 'B', type: 'filter', data: {} },
        ],
        edges: [
          { source: 'A', target: 'B' },
          { source: 'B', target: 'A' },
        ],
      }

      await expect(engine.executePipeline(cyclicGraph, [])).rejects.toThrow(/Cycle detected/)
    })

    it('should execute complete pipeline: source -> filter -> transform -> enricher', async () => {
      const engine = new DagExecutionEngine()

      const pipeline: DagGraph = {
        nodes: [
          {
            id: 'n-source',
            type: 'source',
            data: {
              records: [
                { name: 'Apex Roofing', rating: 4.9, email: 'sales@apexroofing.com' },
                { name: 'Bob Handyman', rating: 3.2, email: 'bob@gmail.com' },
                { name: 'Summit Electric', rating: 4.6, email: '' },
                { name: 'Lone Star HVAC', rating: 4.8, email: 'contact@lonestarhvac.com' },
              ],
            },
          },
          {
            id: 'n-filter',
            type: 'filter',
            data: {
              minRating: 4.5,
              requireEmail: true,
            },
          },
          {
            id: 'n-transform',
            type: 'transform',
            data: {
              code: `(record) => ({ ...record, slug: record.name.toLowerCase().replace(/\\s+/g, '-') })`,
            },
          },
          {
            id: 'n-enricher',
            type: 'enricher',
            data: {},
          },
        ],
        edges: [
          { source: 'n-source', target: 'n-filter' },
          { source: 'n-filter', target: 'n-transform' },
          { source: 'n-transform', target: 'n-enricher' },
        ],
      }

      const result = await engine.executePipeline(pipeline, [])

      expect(result.success).toBe(true)
      // Out of 4 records:
      // - Bob Handyman rejected (rating 3.2 < 4.5)
      // - Summit Electric rejected (no email)
      // Expected output: Apex Roofing and Lone Star HVAC
      expect(result.recordsEmitted).toBe(2)
      expect(result.records.length).toBe(2)

      const apex = result.records.find((r) => r.name === 'Apex Roofing')!
      expect(apex).toBeDefined()
      expect(apex.slug).toBe('apex-roofing')
      expect(apex.enriched).toBe(true)
      expect(apex.enrichmentTimestamp).toBeDefined()

      const loneStar = result.records.find((r) => r.name === 'Lone Star HVAC')!
      expect(loneStar).toBeDefined()
      expect(loneStar.slug).toBe('lone-star-hvac')
      expect(loneStar.enriched).toBe(true)

      // Validate execution node telemetry logs
      expect(result.nodeLogs['n-source'].outCount).toBe(4)
      expect(result.nodeLogs['n-filter'].outCount).toBe(2)
      expect(result.nodeLogs['n-transform'].outCount).toBe(2)
      expect(result.nodeLogs['n-enricher'].outCount).toBe(2)
    })
  })
})
