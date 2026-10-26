import { ipcMain } from 'electron'
import { getDataSource } from '../../backend/db'
import { getTenantId } from '../../backend/db/queries/tenant'
import { EmailTemplateEntity } from '../../backend/db/entities/EmailTemplateEntity'
import { IPC } from '../../shared/types'
import { requirePermission } from '../../backend/db/queries/tenant'

export function registerTemplatesIpc() {
  ipcMain.handle(IPC.TEMPLATES_GET_ALL, async () => {

    const repo = getDataSource().getRepository(EmailTemplateEntity)
    const templates = await repo.find({ where: { org_id: getTenantId() }, order: { created_at: 'DESC' } })
    return templates
  })

  ipcMain.handle(IPC.TEMPLATES_CREATE, async (_event, data: Partial<EmailTemplateEntity>) => {
    requirePermission('manage_settings')
    const repo = getDataSource().getRepository(EmailTemplateEntity)
    const template = repo.create({ ...data, org_id: getTenantId() })
    return await repo.save(template)
  })

  ipcMain.handle(IPC.TEMPLATES_UPDATE, async (_event, id: number, data: Partial<EmailTemplateEntity>) => {
    requirePermission('manage_settings')
    const repo = getDataSource().getRepository(EmailTemplateEntity)
    await repo.update({ id: id, org_id: getTenantId() }, data)
    const updated = await repo.findOneBy({ id: id, org_id: getTenantId() })
    return updated
  })

  ipcMain.handle(IPC.TEMPLATES_DELETE, async (_event, id: number) => {
    requirePermission('manage_settings')
    const repo = getDataSource().getRepository(EmailTemplateEntity)
    await repo.delete({ id: id, org_id: getTenantId() })
  })
}
