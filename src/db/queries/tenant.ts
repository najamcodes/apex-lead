// We use a global variable to store the current user's ID
// In Electron, the main process is shared, so this works perfectly for a single desktop instance.
// When migrating to a cloud API (Node.js/Next.js), this will be replaced by req.session.userId

declare global {
  var currentUserId: number | undefined;
  var currentOrgId: number | undefined;
  var currentUserRole: string | undefined;
  var currentUserPermissions: string[] | undefined;
}

export function getTenantId(): number {
  return global.currentOrgId || 1; // Default to org 1 if not set yet
}

export function getCurrentUserId(): number {
  return global.currentUserId || 1; 
}

export function getCurrentUserRole(): string {
  return global.currentUserRole || 'user';
}

export function getCurrentUserPermissions(): string[] {
  return global.currentUserPermissions || [];
}
