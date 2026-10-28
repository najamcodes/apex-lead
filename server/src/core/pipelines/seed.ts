import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import { getDataSource } from '../../db'
import { PipelineDefinitionEntity } from '../../db/entities/PipelineDefinitionEntity'
import type { PipelineDefinition } from '@sdk/core/types/pipeline.types'

export async function seedDefaultPipelines(orgId: number): Promise<void> {
  const repo = getDataSource().getRepository(PipelineDefinitionEntity)
  let dir = resolve(__dirname, 'definitions')
  if (!existsSync(dir)) {
    dir = resolve(__dirname, '../../pipelines/definitions')
  }

  if (!existsSync(dir)) return

  const files = readdirSync(dir).filter(f => f.endsWith('.json'))
  for (const file of files) {
    try {
      const rawText = readFileSync(join(dir, file), 'utf8')
        .replace(/^\uFEFF/, '')
        .split('\n')
        .filter(line => !line.trim().startsWith('//'))
        .join('\n')
        .replace(/\/\*[\s\S]*?\*\//g, '')
      const def = JSON.parse(rawText) as PipelineDefinition

      const existing = await repo.findOneBy({ id: def.id })
      if (existing) {
        continue
      }

      const now = new Date().toISOString()
      await repo.save(repo.create({
        id: def.id,
        org_id: orgId,
        name: def.name,
        description: def.description ?? null,
        collection: def.collection,
        status: def.status,
        graph: JSON.stringify({ nodes: def.nodes, edges: def.edges }),
        trigger: def.trigger ? JSON.stringify(def.trigger) : null,
        version: def.version ?? 1,
        created_at: now,
        updated_at: now,
      }))
      console.log(`[pipelines] Seeded default pipeline: ${def.id}`)
    } catch (err) {
      console.warn(`[pipelines] Failed to seed ${file}:`, err)
    }
  }
}
