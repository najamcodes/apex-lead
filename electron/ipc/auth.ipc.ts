import { ipcMain } from 'electron'
import { getDataSource } from '../../backend/db'
import { UserEntity } from '../../backend/db/entities/UserEntity'
import { OrganizationEntity } from '../../backend/db/entities/OrganizationEntity'
import { hashPassword, verifyPassword } from '../../backend/core/utils/crypto'

export function registerAuthHandlers() {
  ipcMain.handle('auth:login', async (_, args: { email: string, password: string }) => {
    try {
      const userRepo = getDataSource().getRepository(UserEntity)
      const user = await userRepo.findOneBy({ email: args.email })
      
      if (!user) {
        return { success: false, error: 'Invalid email or password' }
      }

      if (!verifyPassword(args.password, user.password_hash)) {
        // Special case for our default admin user
        if (user.id === 1 && user.password_hash === 'local_admin_no_password_yet') {
          // Force update password for the first time
          user.password_hash = hashPassword(args.password)
          await userRepo.save(user)
        } else {
          return { success: false, error: 'Invalid email or password' }
        }
      }

      // Set global tenant context for Phase 3 queries
      global.currentUserId = user.id;
      global.currentOrgId = user.default_org_id ?? undefined;
      global.currentUserRole = user.role;

      let permissions: string[] = []
      try { permissions = JSON.parse(user.permissions) } catch (e) {}

      global.currentUserPermissions = permissions;

      return { 
        success: true, 
        user: { id: user.id, email: user.email, role: user.role, org_id: user.default_org_id ?? undefined, permissions } 
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('auth:register', async (_, args: { email: string, password: string }) => {
    try {
      const userRepo = getDataSource().getRepository(UserEntity)
      const existing = await userRepo.findOneBy({ email: args.email })
      
      if (existing) {
        return { success: false, error: 'Email already registered' }
      }

      const orgRepo = getDataSource().getRepository(OrganizationEntity)
      const org = orgRepo.create({ name: 'My Organization' })
      await orgRepo.save(org)

      const user = userRepo.create({
        email: args.email,
        password_hash: hashPassword(args.password),
        role: 'admin',
        default_org_id: org.id,
        permissions: JSON.stringify(['view_leads', 'run_scraper', 'manage_settings', 'send_outreach'])
      })
      await userRepo.save(user)

      // Set global tenant context for Phase 3 queries
      global.currentUserId = user.id;
      global.currentOrgId = user.default_org_id ?? undefined;
      global.currentUserRole = user.role;

      let permissions: string[] = []
      try { permissions = JSON.parse(user.permissions) } catch (e) {}

      global.currentUserPermissions = permissions;

      return { 
        success: true, 
        user: { id: user.id, email: user.email, role: user.role, org_id: user.default_org_id ?? undefined, permissions } 
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('auth:restoreSession', async (_, args: { userId: number }) => {
    try {
      const userRepo = getDataSource().getRepository(UserEntity)
      const user = await userRepo.findOneBy({ id: args.userId })
      if (!user) return { success: false }

      global.currentUserId = user.id;
      global.currentOrgId = user.default_org_id ?? undefined;
      global.currentUserRole = user.role;

      let permissions: string[] = []
      try { permissions = JSON.parse(user.permissions) } catch (e) {}

      global.currentUserPermissions = permissions;
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
