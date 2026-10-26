# Phase 1 — Prompt 04: Verification & Backward Compatibility Gates

> **Objective:** Define the complete test suite and verification gates for the Phase 1 Katal MVC migration, ensuring zero regression across tests, builds, and Electron desktop mode.

---

## 1. Automated Test Plan for Katal MVC

Create a dedicated integration test suite verifying Katal IoC container resolution, controller dispatch, Zod validation, and tenant isolation:

### `tests/unit/katal/katal-mvc.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { Container } from 'katal'
import { configureContainer } from '../../../server/src/container'
import { RecordService } from '../../../server/src/services/RecordService'
import { RecordRepository } from '../../../server/src/repositories/RecordRepository'
import { AppDataSource } from '../../../server/src/db/data-source'

describe('Katal MVC & IoC Architecture Suite', () => {
  let container: Container

  beforeAll(async () => {
    container = new Container()
    configureContainer(container)
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize()
    }
  })

  afterAll(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy()
    }
  })

  it('should autowire and resolve RecordService with dependencies from IoC container', () => {
    const recordService = container.resolve(RecordService)
    expect(recordService).toBeDefined()
    expect(recordService).toBeInstanceOf(RecordService)
  })

  it('should ingest dynamic JSON records and deduplicate domain identities', async () => {
    const recordService = container.resolve(RecordService)
    const orgId = 1

    // Ingest first record
    const res1 = await recordService.ingest(orgId, 1, {
      title: 'Katal Technologies Inc',
      collectionType: 'companies',
      data: { revenue: '$10M', employees: 50 },
      identities: [
        { type: 'domain', value: 'kataltech.io' },
        { type: 'email', value: 'contact@kataltech.io' }
      ]
    })

    expect(res1.isNew).toBe(true)
    expect(res1.record.id).toBeDefined()

    // Ingest second record with overlapping domain identity
    const res2 = await recordService.ingest(orgId, 1, {
      title: 'Katal Technologies (Updated)',
      data: { revenue: '$15M', valuation: '$75M' },
      identities: [
        { type: 'domain', value: 'kataltech.io' }
      ]
    })

    expect(res2.isNew).toBe(false)
    expect(res2.record.id).toBe(res1.record.id)
    expect((res2.record.data as any).valuation).toBe('$75M')
  })
})
```

---

## 2. Phase 1 Verification Checklist & Runbook

Execute the following commands in exact order:

```bash
# 1. Run unit test suite including Katal suite
bun test

# 2. Verify TypeScript across all compilation targets
npm run typecheck

# 3. Verify ESLint clean
npm run lint

# 4. Verify Server & Web builds
npm run build:server
npm run build:web
```

### Acceptance Criteria
- [ ] `bun test` passes with 0 failures across all test suites.
- [ ] `npm run typecheck` exits with code 0 across Node, Web, and Server tsconfigs.
- [ ] `npm run lint` exits with 0 errors.
- [ ] Next.js web application renders without import errors from the server models.
