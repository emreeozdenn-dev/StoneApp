import { apiClient } from './client'

export interface CurrentUser {
  id: number
  firstName: string
  lastName: string
  username: string
  email: string
  role: string
  permissions: string[]
}

export async function fetchCurrentUser(): Promise<CurrentUser> {
  const { data } = await apiClient.get<CurrentUser>('/auth/me')
  return data
}

export async function login(usernameOrEmail: string, password: string) {
  const { data } = await apiClient.post('/auth/login', { usernameOrEmail, password })
  return data as { message: string }
}

export async function logout() {
  const { data } = await apiClient.post('/auth/logout')
  return data as { message: string }
}

export async function fetchSetupRequired(): Promise<boolean> {
  const { data } = await apiClient.get<{ required: boolean }>('/auth/setup-required')
  return data.required
}

export interface SetupPayload {
  firstName: string
  lastName: string
  username: string
  email: string
  password: string
}

export async function setupAdmin(payload: SetupPayload) {
  const { data } = await apiClient.post('/auth/setup', payload)
  return data as { message: string }
}
