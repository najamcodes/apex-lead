import { ipcMain } from 'electron'
import { IPC } from '../../src/types'
import { getUsersInOrg, updateUserPermissions, deleteUser, createTeamMember } from '../../src/db/queries/users.queries'

export function registerUsersHandlers() {
  ipcMain.handle(IPC.USERS_LIST, async () => {
    try {
      const users = await getUsersInOrg()
      return { success: true, users }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle(IPC.USERS_ADD, async (_, args: { email: string, password: string }) => {
    try {
      const user = await createTeamMember(args.email, args.password)
      return { success: true, user }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle(IPC.USERS_UPDATE_PERMISSIONS, async (_, args: { userId: number, permissions: string[] }) => {
    try {
      await updateUserPermissions(args.userId, args.permissions)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle(IPC.USERS_DELETE, async (_, userId: number) => {
    try {
      await deleteUser(userId)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
