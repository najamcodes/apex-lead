import type { UserEntity } from '../db/entities/UserEntity';

export interface UserResponseDto {
  id: number;
  email: string;
  name: string | null;
  role: string;
  defaultOrgId: number;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

export class UserResponseAdapter {
  static toDto(entity: UserEntity | null | undefined): UserResponseDto | null {
    if (!entity) return null;

    let parsedPermissions: string[] = [];
    if (entity.permissions) {
      try {
        parsedPermissions = typeof entity.permissions === 'string'
          ? JSON.parse(entity.permissions)
          : entity.permissions;
      } catch {
        parsedPermissions = [];
      }
    }

    return {
      id: entity.id,
      email: entity.email,
      name: entity.name || null,
      role: entity.role || 'viewer',
      defaultOrgId: entity.default_org_id || 1,
      permissions: parsedPermissions,
      createdAt: entity.created_at ? new Date(entity.created_at).toISOString() : new Date().toISOString(),
      updatedAt: entity.updated_at ? new Date(entity.updated_at).toISOString() : new Date().toISOString(),
    };
  }

  static toDtoList(entities: (UserEntity | null | undefined)[]): UserResponseDto[] {
    return entities
      .map((e) => UserResponseAdapter.toDto(e))
      .filter((dto): dto is UserResponseDto => dto !== null);
  }
}
