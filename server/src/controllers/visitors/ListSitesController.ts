import { Controller, type RequestContext } from 'katal';
import { getDataSource } from '../../db';
import { VisitorSiteEntity } from '../../db/entities/VisitorSiteEntity';
import { VisitorSessionEntity } from '../../db/entities/VisitorSessionEntity';

export class ListSitesController extends Controller {
  async handle(context: RequestContext) {
    const orgId = context.user?.orgId || context.state?.tenantId;
    if (!orgId) return this.unauthorized('Authentication required');

    try {
      const ds = getDataSource();
      const siteRepo = ds.getRepository(VisitorSiteEntity);
      const sessionRepo = ds.getRepository(VisitorSessionEntity);

      const sites = await siteRepo.find({ where: { org_id: orgId } });
      const siteIds = sites.map((s) => s.id);

      let highIntentVisitors: VisitorSessionEntity[] = [];
      if (siteIds.length > 0) {
        highIntentVisitors = await sessionRepo
          .createQueryBuilder('s')
          .where('s.site_id IN (:...siteIds)', { siteIds })
          .orderBy('s.intent_score', 'DESC')
          .limit(20)
          .getMany();
      }

      return this.success({ sites, highIntentVisitors });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      return this.badRequest(message || 'Failed to list sites');
    }
  }
}
