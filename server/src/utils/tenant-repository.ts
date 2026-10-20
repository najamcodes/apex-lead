import { Repository, type FindManyOptions, type FindOneOptions, type ObjectLiteral } from 'typeorm'
import { getTenantId } from '@sdk/backend/db/queries/tenant'

export class ScopedTenantRepository<T extends ObjectLiteral> {
  constructor(private repo: Repository<T>) {}

  private injectTenantWhere(options?: FindManyOptions<T>): FindManyOptions<T> {
    const orgId = getTenantId()
    const opts = options || {}
    if (Array.isArray(opts.where)) {
      opts.where = opts.where.map(w => ({ ...w, org_id: orgId }))
    } else {
      opts.where = { ...(opts.where as any), org_id: orgId }
    }
    return opts
  }

  async find(options?: FindManyOptions<T>): Promise<T[]> {
    return this.repo.find(this.injectTenantWhere(options))
  }

  async findOne(options: FindOneOptions<T>): Promise<T | null> {
    const orgId = getTenantId()
    const opts = { ...options }
    if (Array.isArray(opts.where)) {
      opts.where = opts.where.map(w => ({ ...w, org_id: orgId }))
    } else {
      opts.where = { ...(opts.where as any), org_id: orgId }
    }
    return this.repo.findOne(opts)
  }

  async count(options?: FindManyOptions<T>): Promise<number> {
    return this.repo.count(this.injectTenantWhere(options))
  }

  create(entityLike: Partial<T>): T {
    const orgId = getTenantId()
    return this.repo.create({ ...entityLike, org_id: orgId } as any) as unknown as T
  }


  async save(entity: T): Promise<T> {
    if (!('org_id' in entity)) {
      (entity as any).org_id = getTenantId()
    }
    return this.repo.save(entity)
  }

  async delete(criteria: any): Promise<any> {
    const orgId = getTenantId()
    const scopedCriteria = typeof criteria === 'object' ? { ...criteria, org_id: orgId } : { id: criteria, org_id: orgId }
    return this.repo.delete(scopedCriteria)
  }

  get raw(): Repository<T> {
    return this.repo
  }
}

export function getScopedRepository<T extends ObjectLiteral>(repo: Repository<T>): ScopedTenantRepository<T> {
  return new ScopedTenantRepository<T>(repo)
}
