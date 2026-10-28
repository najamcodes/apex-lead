import { Repository, SelectQueryBuilder, ObjectLiteral, DataSource, type FindOptionsWhere } from 'typeorm';
import { getDataSource } from '../index';

export abstract class BaseTenantRepository<T extends ObjectLiteral & { org_id: number; id: number | string }> {
  constructor(protected targetEntity: new () => T) {}

  protected get dataSource(): DataSource {
    return getDataSource();
  }

  protected get repo(): Repository<T> {
    return this.dataSource.getRepository(this.targetEntity);
  }

  /**
   * Scopes any SelectQueryBuilder to the specified tenant org_id.
   * Parameterized to prevent SQL injection.
   */
  protected tenantQuery(orgId: number, alias = 'e'): SelectQueryBuilder<T> {
    if (!orgId || typeof orgId !== 'number' || orgId <= 0) {
      throw new Error(`Invalid orgId: ${orgId}. Tenant context is required.`);
    }
    return this.repo.createQueryBuilder(alias).where(`${alias}.org_id = :orgId`, { orgId });
  }

  async findById(orgId: number, id: number | string): Promise<T | null> {
    if (!orgId || typeof orgId !== 'number' || orgId <= 0) {
      throw new Error('Tenant context (orgId) is mandatory');
    }
    return this.repo.findOne({
      where: { id, org_id: orgId } as unknown as FindOptionsWhere<T>,
    });
  }

  async deleteById(orgId: number, id: number | string): Promise<boolean> {
    if (!orgId || typeof orgId !== 'number' || orgId <= 0) {
      throw new Error('Tenant context (orgId) is mandatory');
    }
    const result = await this.repo.delete({ id, org_id: orgId } as unknown as FindOptionsWhere<T>);
    return (result.affected ?? 0) > 0;
  }

  async count(orgId: number): Promise<number> {
    if (!orgId || typeof orgId !== 'number' || orgId <= 0) {
      throw new Error('Tenant context (orgId) is mandatory');
    }
    return this.repo.count({
      where: { org_id: orgId } as unknown as FindOptionsWhere<T>,
    });
  }
}
