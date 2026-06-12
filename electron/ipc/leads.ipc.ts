// electron/ipc/leads.ipc.ts
import { ipcMain } from 'electron'
import { IPC, LeadFilters } from '../../src/types'
import {
  getAllLeads,
  getLeadById,
  insertLead,
  updateLeadStatus,
  deleteLead
} from '../../src/db/queries/leads.queries'
import { getDashboardStats } from '../../src/db/queries/stats.queries'
import { logActivity } from '../../src/db/queries/activity.queries'

export function registerLeadIpcHandlers(): void {
  ipcMain.handle(IPC.LEADS_GET_ALL, (_event, filters: LeadFilters) => {
    return getAllLeads(filters)
  })
  ipcMain.handle(IPC.LEADS_GET_BY_ID, (_event, id) => getLeadById(id))
  ipcMain.handle(IPC.LEADS_INSERT, (_event, data) => insertLead(data))
  ipcMain.handle(IPC.LEADS_UPDATE_STATUS, (_event, id, status, notes) => {
    updateLeadStatus(id, status, notes)
    if (status === 'approved') logActivity(id, 'lead_approved', notes)
    if (status === 'skipped') logActivity(id, 'lead_skipped', notes)
  })
  ipcMain.handle(IPC.LEADS_DELETE, (_event, id) => deleteLead(id))
  ipcMain.handle(IPC.STATS_GET_DASHBOARD, () => getDashboardStats())
}
