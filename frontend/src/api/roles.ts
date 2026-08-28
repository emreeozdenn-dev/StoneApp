import { apiClient } from './client'

export interface RoleSummary {
  id: number
  name: string
  isSystemRole: boolean
  userCount: number
}

export async function fetchRolesSummary(): Promise<RoleSummary[]> {
  const { data } = await apiClient.get<RoleSummary[]>('/roles')
  return data
}

export interface PermissionInfo {
  id: number
  key: string
  description: string
}

export async function fetchPermissions(): Promise<PermissionInfo[]> {
  const { data } = await apiClient.get<PermissionInfo[]>('/roles/permissions')
  return data
}

export interface RolePermissions {
  roleId: number
  roleName: string
  isSystemRole: boolean
  permissionKeys: string[]
}

export async function fetchRolePermissions(roleId: number): Promise<RolePermissions> {
  const { data } = await apiClient.get<RolePermissions>(`/roles/${roleId}/permissions`)
  return data
}

export async function updateRolePermissions(roleId: number, permissionKeys: string[]) {
  const { data } = await apiClient.put(`/roles/${roleId}/permissions`, { permissionKeys })
  return data as { message: string }
}

export async function createRole(name: string) {
  const { data } = await apiClient.post('/roles', { name })
  return data as { message: string; id: number }
}

export async function updateRoleName(roleId: number, name: string) {
  const { data } = await apiClient.put(`/roles/${roleId}`, { name })
  return data as { message: string }
}

export async function deleteRole(roleId: number) {
  const { data } = await apiClient.delete(`/roles/${roleId}`)
  return data as { message: string }
}
