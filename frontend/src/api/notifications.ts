import { apiClient } from './client'

export type NotificationType = 'YeniStok' | 'DusukStok' | 'PlakaSatildi'
export type NotificationStatus = 'Pending' | 'Gonderildi' | 'Basarisiz'

export interface NotificationLogEntry {
  id: number
  type: NotificationType
  recipient: string
  subject: string
  status: NotificationStatus
  sentAt: string | null
  errorMessage: string | null
  createdAt: string
}

export async function fetchNotifications(): Promise<NotificationLogEntry[]> {
  const { data } = await apiClient.get<NotificationLogEntry[]>('/notifications')
  return data
}
