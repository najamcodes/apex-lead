import {
  Repository,
  type FindManyOptions,
  type FindOneOptions,
  type ObjectLiteral,
  type FindOptionsWhere,
  type DeepPartial,
  type DeleteResult,
} from 'typeorm';
import { getTenantId } from './queries/tenant';

export class ScopedTenantRepository<T extends ObjectLiteral> {
  constructor(private repo: Repository<T>) {}

  private injectTenantWhere(options?: FindManyOptions<T>): FindManyOptions<T> {
    const orgId = getTenantId();
    const opts = options || {};
    if (Array.isArray(opts.where)) {
      opts.where = opts.where.map((w) => ({ ...w, org_id: orgId }));
    } else {
      opts.where = { ...(opts.where as FindOptionsWhere<T>), org_id: orgId };
    }
    return opts;
  }

  async find(options?: FindManyOptions<T>): Promise<T[]> {
    return this.repo.find(this.injectTenantWhere(options));
  }

  async findOne(options: FindOneOptions<T>): Promise<T | null> {
    const orgId = getTenantId();
    const opts = { ...options };
    if (Array.isArray(opts.where)) {
      opts.where = opts.where.map((w) => ({ ...w, org_id: orgId }));
    } else {
      opts.where = { ...(opts.where as FindOptionsWhere<T>), org_id: orgId };
    }
    return this.repo.findOne(opts);
  }

  async count(options?: FindManyOptions<T>): Promise<number> {
    return this.repo.count(this.injectTenantWhere(options));
  }

  create(entityLike: DeepPartial<T>): T {
    const orgId = getTenantId();
    return this.repo.create({ ...entityLike, org_id: orgId } as DeepPartial<T>);
  }

  async save(entity: T): Promise<T> {
    if (!('org_id' in entity)) {
      (entity as Record<string, unknown>).org_id = getTenantId();
    }
    return this.repo.save(entity);
  }

  async delete(criteria: string | number | FindOptionsWhere<T>): Promise<DeleteResult> {
    const orgId = getTenantId();
    const scopedCriteria = typeof criteria === 'object' && criteria !== null
      ? ({ ...criteria, org_id: orgId } as FindOptionsWhere<T>)
      : ({ id: criteria, org_id: orgId } as unknown as FindOptionsWhere<T>);
    return this.repo.delete(scopedCriteria);
  }

  get raw(): Repository<T> {
    return this.repo;
  }
}

export function getScopedRepository<T extends ObjectLiteral>(repo: Repository<T>): ScopedTenantRepository<T> {
  return new ScopedTenantRepository<T>(repo);
}
