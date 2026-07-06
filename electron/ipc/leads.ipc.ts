// electron/ipc/leads.ipc.ts
import { ipcMain } from 'electron'
import { IPC, LeadFilters } from '../../shared/types'
import {
  getAllLeads,
  getLeadById,
  insertLead,
  updateLeadStatus,
  deleteLead
} from '../../backend/db/queries/leads.queries'
import { getDashboardStats, getCityRoiStats } from '../../backend/db/queries/stats.queries'
import { logActivity } from '../../backend/db/queries/activity.queries'
import { getCurrentUserRole, getCurrentUserPermissions } from '../../backend/db/queries/tenant'

function requirePermission(perm: string) {
  if (getCurrentUserRole() === 'admin') return;
  const perms = getCurrentUserPermissions();
  if (!perms.includes(perm)) {
    throw new Error(`Unauthorized: Missing permission ${perm}`);
  }
}

export function registerLeadIpcHandlers(): void {
  ipcMain.handle(IPC.LEADS_GET_ALL, (_event, filters: LeadFilters) => {
    requirePermission('view_leads')
    return getAllLeads(filters)
  })
  ipcMain.handle(IPC.LEADS_GET_BY_ID, (_event, id) => {
    requirePermission('view_leads')
    return getLeadById(id)
  })
  ipcMain.handle(IPC.LEADS_INSERT, (_event, data) => {
    requirePermission('manage_settings')
    return insertLead(data)
  })
  ipcMain.handle(IPC.LEADS_UPDATE_STATUS, (_event, id, status, notes) => {
    requirePermission('view_leads')
    updateLeadStatus(id, status, notes)
    if (status === 'approved') logActivity(id, 'lead_approved', notes)
    if (status === 'skipped') logActivity(id, 'lead_skipped', notes)
  })
  ipcMain.handle(IPC.LEADS_DELETE, (_event, id) => {
    requirePermission('manage_settings')
    return deleteLead(id)
  })
  ipcMain.handle(IPC.STATS_GET_DASHBOARD, () => {
    requirePermission('view_leads')
    return getDashboardStats()
  })
  ipcMain.handle(IPC.STATS_GET_CITY_ROI, () => {
    requirePermission('view_leads')
    return getCityRoiStats()
  })
}
