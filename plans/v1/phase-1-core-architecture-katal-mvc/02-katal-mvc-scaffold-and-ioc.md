# Phase 1 — Prompt 02: Katal MVC Scaffolding & IoC Architecture

> **Objective:** Scaffold the clean MVC & Action-Domain-Responder architecture in `server/` using `katal@3.0.0`, wiring the Inversion-of-Control (IoC) container, request-scoped tenant contexts, and background job queues.

---

## 1. Katal Architectural Foundations

`katal@3.0.0` provides a zero-dependency, ultra-fast application architecture designed for Bun and modern Node.js. 

We will structure `server/src/` into strict, uncoupled layers:

```
server/src/
├── app.ts                    # Katal Application instance, middleware pipeline, route registration
├── config/                   # Cascading environment configurations (app, db, redis, auth, polar)
├── container.ts              # Inversion-of-Control (IoC) Service Provider bindings
├── context/
│   └── TenantContext.ts      # Request-scoped context holding current orgId, userId, and role
├── controllers/              # [C] Katal Controllers handling HTTP parameters and status codes
│   ├── AuthController.ts
│   ├── RecordController.ts
│   ├── PipelineController.ts
│   ├── OutreachController.ts
│   └── PolarWebhookController.ts
├── services/                 # [Domain] Pure business logic (LeadService, ScraperService, AiService)
│   ├── RecordService.ts
│   ├── PipelineService.ts
│   ├── EnrichmentService.ts
│   └── BillingService.ts
├── repositories/             # [M] Tenant-scoped Database Repositories
│   ├── BaseTenantRepository.ts
│   ├── RecordRepository.ts
│   └── OrganizationRepository.ts
├── models/                   # [M] TypeORM / Database Entities
│   ├── RecordEntity.ts
│   ├── RecordIdentityEntity.ts
│   ├── OrganizationEntity.ts
│   └── UserEntity.ts
├── views/                    # [V] Standard Schema / Zod DTOs & response serializers
│   ├── record.dto.ts
│   ├── pipeline.dto.ts
│   └── auth.dto.ts
├── jobs/                     # Katal Background Workers
│   ├── ScrapeJob.ts
│   ├── WaterfallEnrichJob.ts
│   └── WebhookDispatcherJob.ts
└── middleware/               # HTTP filters (Auth, TenantScope, RateLimit)
    ├── AuthMiddleware.ts
    ├── TenantMiddleware.ts
    └── RateLimitMiddleware.ts
```

---

## 2. Inversion-of-Control (IoC) Container Setup

### `server/src/container.ts`

```ts
import { Container, Lifecycle } from 'katal'
import { AppDataSource } from './db/data-source'
import { RecordRepository } from './repositories/RecordRepository'
import { OrganizationRepository } from './repositories/OrganizationRepository'
import { RecordService } from './services/RecordService'
import { PipelineService } from './services/PipelineService'
import { EnrichmentService } from './services/EnrichmentService'
import { BillingService } from './services/BillingService'
import { AuditService } from './services/AuditService'

export function configureContainer(container: Container): void {
  // 1. Singletons (Database DataSources, Shared Services, Caches)
  container.bind('DataSource', () => AppDataSource, { lifecycle: Lifecycle.Singleton })
  container.bind('AuditService', () => new AuditService(), { lifecycle: Lifecycle.Singleton })

  // 2. Repositories
  container.bind(RecordRepository, () => new RecordRepository(), { lifecycle: Lifecycle.Singleton })
  container.bind(OrganizationRepository, () => new OrganizationRepository(), { lifecycle: Lifecycle.Singleton })

  // 3. Domain Services
  container.bind(
    RecordService,
    (c) => new RecordService(c.resolve(RecordRepository), c.resolve('AuditService')),
    { lifecycle: Lifecycle.Singleton }
  )

  container.bind(
    BillingService,
    (c) => new BillingService(c.resolve(OrganizationRepository), c.resolve('AuditService')),
    { lifecycle: Lifecycle.Singleton }
  )

  container.bind(
    EnrichmentService,
    (c) => new EnrichmentService(c.resolve(RecordRepository)),
    { lifecycle: Lifecycle.Singleton }
  )

  container.bind(
    PipelineService,
    (c) => new PipelineService(c.resolve(RecordService), c.resolve(EnrichmentService)),
    { lifecycle: Lifecycle.Singleton }
  )
}
```

---

## 3. Base Repository with Automatic Tenant Scoping

### `server/src/repositories/BaseTenantRepository.ts`

```ts
import { Repository, SelectQueryBuilder, ObjectLiteral } from 'typeorm'
import { AppDataSource } from '../db/data-source'

export abstract class BaseTenantRepository<T extends ObjectLiteral & { org_id: number }> {
  constructor(protected targetEntity: new () => T) {}

  protected get repo(): Repository<T> {
    return AppDataSource.getRepository(this.targetEntity)
  }

  /**
   * Automatically scopes any SelectQueryBuilder to the current tenant org_id.
   */
  protected tenantQuery(orgId: number, alias = 'e'): SelectQueryBuilder<T> {
    return this.repo.createQueryBuilder(alias).where(`${alias}.org_id = :orgId`, { orgId })
  }

  async findById(orgId: number, id: number): Promise<T | null> {
    return this.repo.findOne({
      where: { id, org_id: orgId } as any,
    })
  }

  async deleteById(orgId: number, id: number): Promise<boolean> {
    const result = await this.repo.delete({ id, org_id: orgId } as any)
    return (result.affected ?? 0) > 0
  }
}
```

---

## 4. Katal Controller Implementation with Standard Schema (Zod)

### `server/src/controllers/RecordController.ts`

```ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query, Context, Inject } from 'katal'
import { RecordService } from '../services/RecordService'
import { IngestRecordSchema, RecordFilterQuerySchema } from '../views/record.dto'

export class RecordController extends Controller {
  constructor(@Inject() private recordService: RecordService) {
    super()
  }

  @Post('/api/records')
  async create(@Body(IngestRecordSchema) body: any, c: Context) {
    const orgId = c.get('tenantId')
    const userId = c.get('userId')
    const result = await this.recordService.ingest(orgId, userId, body)
    return c.json({ success: true, data: result.record, isNew: result.isNew }, result.isNew ? 201 : 200)
  }

  @Get('/api/records')
  async list(@Query(RecordFilterQuerySchema) query: any, c: Context) {
    const orgId = c.get('tenantId')
    const paginated = await this.recordService.listRecords(orgId, query)
    return c.json({ success: true, ...paginated })
  }

  @Get('/api/records/:id')
  async getOne(@Param('id') id: string, c: Context) {
    const orgId = c.get('tenantId')
    const record = await this.recordService.getRecord(orgId, Number(id))
    if (!record) return c.json({ error: 'Record not found' }, 404)
    return c.json({ success: true, data: record })
  }

  @Delete('/api/records/:id')
  async deleteOne(@Param('id') id: string, c: Context) {
    const orgId = c.get('tenantId')
    const deleted = await this.recordService.softDelete(orgId, Number(id))
    return c.json({ success: deleted })
  }
}
```

---

## 5. Built-in Background Queue Architecture

Instead of running long scrapers or webhook dispatch synchronously during HTTP requests, we dispatch them to **Katal Background Jobs**:

### `server/src/jobs/ScrapeJob.ts`

```ts
import { Job } from 'katal'
import { executePipeline } from '../engine/graph'

export interface ScrapeJobPayload {
  pipelineId: string
  orgId: number
  userId: number
  configOverrides?: Record<string, unknown>
}

export class ScrapeJob extends Job<ScrapeJobPayload> {
  static queueName = 'scrapers'

  async handle(payload: ScrapeJobPayload): Promise<void> {
    console.log(`[ScrapeJob] Starting execution for pipeline ${payload.pipelineId} in Org ${payload.orgId}`)
    await executePipeline(payload.pipelineId, payload.orgId, payload.configOverrides)
    console.log(`[ScrapeJob] Pipeline ${payload.pipelineId} completed.`)
  }

  failed(error: Error, payload: ScrapeJobPayload): void {
    console.error(`[ScrapeJob] Failed execution for pipeline ${payload.pipelineId}:`, error.message)
  }
}
```

### In Controller:
```ts
@Post('/api/pipelines/:id/run')
async run(@Param('id') id: string, @Body() overrides: any, c: Context) {
  const orgId = c.get('tenantId')
  const userId = c.get('userId')
  
  // Instantly dispatch to background queue — returns HTTP 202
  await ScrapeJob.dispatch({ pipelineId: id, orgId, userId, configOverrides: overrides })
  return c.json({ status: 'queued', message: 'Pipeline scraping job dispatched to worker queue' }, 202)
}
```

---

## 6. Verification Protocol
1. Install `katal` in `server/`:
   ```bash
   cd server && bun add katal@3.0.0
   ```
2. Verify IoC resolution by resolving `RecordService` from container in a test script.
3. Verify Zod validation in Katal controllers by posting invalid payloads and asserting HTTP 422 with structured field errors.
4. Verify background queue by dispatching a dummy `ScrapeJob` and asserting background completion.
