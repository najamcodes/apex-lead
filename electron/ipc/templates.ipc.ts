import { ipcMain } from 'electron'
import { getDataSource } from '../../src/db'
import { EmailTemplateEntity } from '../../src/db/entities/EmailTemplateEntity'
import { IPC } from './constants'

export function registerTemplatesIpc() {
  ipcMain.handle(IPC.TEMPLATES_GET_ALL, async () => {
    const repo = getDataSource().getRepository(EmailTemplateEntity)
    return await repo.find({ order: { created_at: 'DESC' } })
  })

  ipcMain.handle(IPC.TEMPLATES_CREATE, async (_event, data: Partial<EmailTemplateEntity>) => {
    const repo = getDataSource().getRepository(EmailTemplateEntity)
    const template = repo.create(data)
    return await repo.save(template)
  })

  ipcMain.handle(IPC.TEMPLATES_UPDATE, async (_event, id: number, data: Partial<EmailTemplateEntity>) => {
    const repo = getDataSource().getRepository(EmailTemplateEntity)
    await repo.update(id, data)
    return await repo.findOneBy({ id })
  })

  ipcMain.handle(IPC.TEMPLATES_DELETE, async (_event, id: number) => {
    const repo = getDataSource().getRepository(EmailTemplateEntity)
    await repo.delete(id)
  })
}
