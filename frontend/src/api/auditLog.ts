import { apiClient } from './client'

export interface AuditLogEntry {
  id: number
  createdAt: string
  userName: string
  action: string
  recordType: string
  recordId: string
  details: string | null
}

export async function fetchAuditLog(): Promise<AuditLogEntry[]> {
  const { data } = await apiClient.get<AuditLogEntry[]>('/audit-log')
  return data
}
