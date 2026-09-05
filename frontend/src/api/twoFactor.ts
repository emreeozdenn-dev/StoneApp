import { apiClient } from './client'

export async function fetchTwoFactorStatus() {
  const { data } = await apiClient.get<{ enabled: boolean }>('/2fa/status')
  return data.enabled
}

export interface TwoFactorSetup {
  secret: string
  otpAuthUri: string
}

export async function setupTwoFactor() {
  const { data } = await apiClient.post<TwoFactorSetup>('/2fa/setup')
  return data
}

export async function enableTwoFactor(code: string) {
  const { data } = await apiClient.post('/2fa/enable', { code })
  return data as { message: string }
}

export async function disableTwoFactor(code: string) {
  const { data } = await apiClient.post('/2fa/disable', { code })
  return data as { message: string }
}

export async function adminResetTwoFactor(userId: number) {
  const { data } = await apiClient.post(`/2fa/admin-reset/${userId}`)
  return data as { message: string }
}
