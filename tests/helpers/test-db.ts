import '../../server/polyfill'
import { DataSource } from 'typeorm'
import { allEntities } from '@sdk/core/db/data-source'

export async function createTestDatabase(): Promise<DataSource> {
  const ds = new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    entities: allEntities,
    synchronize: true,
  })
  await ds.initialize()
  return ds
}
