import { apiClient } from './client'
import type { Plate } from './catalog'

export type QrScanResultStatus = 'Success' | 'NotFound' | 'Invalid'

export interface QrScanResponse {
  result: QrScanResultStatus
  plate: Plate | null
}

export async function scanQrCode(rawValue: string): Promise<QrScanResponse> {
  const { data } = await apiClient.post<QrScanResponse>('/qr-scan', { rawValue })
  return data
}

export interface QrScanLogEntry {
  id: number
  scannedAt: string
  rawScannedValue: string
  result: QrScanResultStatus
  plateId: number | null
  plateNo: string | null
  stoneName: string | null
  scannedByUserName: string
}

export async function fetchQrScanHistory(): Promise<QrScanLogEntry[]> {
  const { data } = await apiClient.get<QrScanLogEntry[]>('/qr-scan/history')
  return data
}
