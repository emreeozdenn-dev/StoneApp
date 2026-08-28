import { apiClient } from './client'

export interface SystemSettings {
  companyName: string | null
  logoUrl: string | null
  smtpHost: string | null
  smtpPort: number | null
  smtpUsername: string | null
  hasSmtpPassword: boolean
  smtpSenderEmail: string | null
  smtpSenderName: string | null
  smtpUseSsl: boolean
  notifyNewStock: boolean
  notifyLowStock: boolean
  notifyPlateSold: boolean
  newStockSubjectTemplate: string
  newStockBodyTemplate: string
  lowStockSubjectTemplate: string
  lowStockBodyTemplate: string
  plateSoldSubjectTemplate: string
  plateSoldBodyTemplate: string
}

export async function fetchSystemSettings(): Promise<SystemSettings> {
  const { data } = await apiClient.get<SystemSettings>('/system-settings')
  return data
}

export interface UpdateSystemSettingsPayload {
  companyName: string | null
  smtpHost: string | null
  smtpPort: number | null
  smtpUsername: string | null
  smtpPassword: string | null
  clearSmtpPassword: boolean
  smtpSenderEmail: string | null
  smtpSenderName: string | null
  smtpUseSsl: boolean
  notifyNewStock: boolean
  notifyLowStock: boolean
  notifyPlateSold: boolean
  newStockSubjectTemplate?: string
  newStockBodyTemplate?: string
  lowStockSubjectTemplate?: string
  lowStockBodyTemplate?: string
  plateSoldSubjectTemplate?: string
  plateSoldBodyTemplate?: string
}

export async function updateSystemSettings(payload: UpdateSystemSettingsPayload) {
  const { data } = await apiClient.put('/system-settings', payload)
  return data as { message: string }
}

export async function sendTestEmail(testRecipientEmail: string) {
  const { data } = await apiClient.post('/system-settings/test-email', { testRecipientEmail })
  return data as { message: string }
}

export interface CompanyBranding {
  companyName: string | null
  logoUrl: string | null
}

export async function fetchCompanyBranding(): Promise<CompanyBranding> {
  const { data } = await apiClient.get<CompanyBranding>('/system-settings/branding')
  return data
}

export async function uploadCompanyLogo(file: File) {
  const formData = new FormData()
  formData.append('logo', file)
  const { data } = await apiClient.post('/system-settings/logo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data as { message: string; logoUrl: string }
}

export interface NotificationRecipient {
  id: number
  email: string
  isActive: boolean
}

export async function fetchNotificationRecipients(): Promise<NotificationRecipient[]> {
  const { data } = await apiClient.get<NotificationRecipient[]>('/notification-recipients')
  return data
}

export async function createNotificationRecipient(email: string) {
  const { data } = await apiClient.post('/notification-recipients', { email })
  return data as { message: string }
}

export async function setNotificationRecipientStatus(id: number, active: boolean) {
  const { data } = await apiClient.post(`/notification-recipients/${id}/status`, { active })
  return data as { message: string }
}

export async function deleteNotificationRecipient(id: number) {
  const { data } = await apiClient.delete(`/notification-recipients/${id}`)
  return data as { message: string }
}
