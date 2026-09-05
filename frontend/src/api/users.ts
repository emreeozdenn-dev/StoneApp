import { apiClient } from './client'

export interface UserListItem {
  id: number
  firstName: string
  lastName: string
  username: string
  email: string
  role: string
  status: 'Aktif' | 'Pasif'
  createdAt: string
  lastLoginAt: string | null
  twoFactorEnabled: boolean
}

export interface Role {
  id: number
  name: string
}

export async function fetchUsers(): Promise<UserListItem[]> {
  const { data } = await apiClient.get<UserListItem[]>('/users')
  return data
}

export async function fetchRoles(): Promise<Role[]> {
  const { data } = await apiClient.get<Role[]>('/roles')
  return data
}

export interface CreateUserPayload {
  firstName: string
  lastName: string
  username: string
  email: string
  password: string
  roleId: number
}

export async function createUser(payload: CreateUserPayload) {
  const { data } = await apiClient.post('/users', payload)
  return data as { message: string }
}

export async function setUserStatus(id: number, active: boolean) {
  const { data } = await apiClient.post(`/users/${id}/status`, { active })
  return data as { message: string }
}

export async function deleteUser(id: number) {
  const { data } = await apiClient.delete(`/users/${id}`)
  return data as { message: string }
}

export async function resetUserPassword(id: number, newPassword: string) {
  const { data } = await apiClient.post(`/users/${id}/reset-password`, { newPassword })
  return data as { message: string }
}
