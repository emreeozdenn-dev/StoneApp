import { apiClient } from './client'

export interface Stone {
  id: number
  name: string
  code: string
  type: string
  origin: string
  color: string
  status: 'Aktif' | 'Pasif'
  minimumStock: number
  currentStock: number
  isBelowMinimumStock: boolean
  imageUrl?: string | null
}

export interface CreateStonePayload {
  name: string
  code: string
  type: string
  origin: string
  color: string
  minimumStock: number
}

export async function fetchStones(): Promise<Stone[]> {
  const { data } = await apiClient.get<Stone[]>('/stones')
  return data
}

export async function createStone(payload: CreateStonePayload) {
  const { data } = await apiClient.post('/stones', payload)
  return data as { message: string; id: number }
}

export interface UpdateStonePayload {
  name: string
  type: string
  origin: string
  color: string
  minimumStock: number
  status: 'Aktif' | 'Pasif'
}

export async function updateStone(id: number, payload: UpdateStonePayload) {
  const { data } = await apiClient.put(`/stones/${id}`, payload)
  return data as { message: string }
}

export async function uploadStoneImage(id: number, file: File) {
  const formData = new FormData()
  formData.append('image', file)
  const { data } = await apiClient.post(`/stones/${id}/image`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data as { message: string; imageUrl: string }
}

export async function deleteStone(id: number) {
  const { data } = await apiClient.delete(`/stones/${id}`)
  return data as { message: string }
}

export async function downloadStoneImportTemplate() {
  const { data } = await apiClient.get('/stones/import-template', { responseType: 'blob' })
  return data as Blob
}

export interface StoneImportRowError {
  row: number
  code: string | null
  message: string
}

export interface StoneImportResult {
  created: number
  failed: number
  errors: StoneImportRowError[]
}

export async function importStones(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await apiClient.post('/stones/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data as StoneImportResult
}

export interface IncomingStock {
  id: number
  stoneId: number
  stoneName: string
  arrivalDate: string
  supplyType: string
  supplier: string
  batchCode: string
  quantity: number
  thickness: number
  texture: string
  warehouse: string
  saleCurrency: string
  saleCost: number | null
  description: string | null
  createdByUserName: string
  plateCountAdded: number
  totalArea: number
  createdAt: string
  unitCost?: number
  costCurrency?: string
  customsCost?: number
  shippingCost?: number
  otherCost?: number
  totalAdditionalCost?: number
}

export interface CreateIncomingStockPayload {
  stoneId: number
  arrivalDate: string
  supplyType: string
  supplier: string
  quantity: number
  thickness: number
  texture: string
  warehouse: string
  unitCost: number
  costCurrency: string
  saleCurrency: string
  saleCost: number | null
  description: string | null
  customsCost: number
  shippingCost: number
  otherCost: number
}

export async function fetchIncomingStocks(): Promise<IncomingStock[]> {
  const { data } = await apiClient.get<IncomingStock[]>('/incoming-stock')
  return data
}

export async function createIncomingStock(payload: CreateIncomingStockPayload) {
  const { data } = await apiClient.post('/incoming-stock', payload)
  return data as { message: string; id: number }
}

export interface UpdateIncomingStockPayload {
  arrivalDate: string
  supplyType: string
  supplier: string
  quantity: number
  thickness: number
  texture: string
  warehouse: string
  unitCost: number
  costCurrency: string
  saleCurrency: string
  saleCost: number | null
  description: string | null
  customsCost: number
  shippingCost: number
  otherCost: number
}

export async function updateIncomingStock(id: number, payload: UpdateIncomingStockPayload) {
  const { data } = await apiClient.put(`/incoming-stock/${id}`, payload)
  return data as { message: string }
}

export async function deleteIncomingStock(id: number) {
  const { data } = await apiClient.delete(`/incoming-stock/${id}`)
  return data as { message: string }
}

export interface Plate {
  id: number
  plateNo: string
  batchCode: string
  stoneId: number
  stoneName: string
  incomingStockId: number
  texture: string
  thickness: number
  width: number
  height: number
  area: number
  warehouse: string
  status: 'Aktif' | 'Rezerve' | 'Satildi' | 'Pasif'
  saleCost: number | null
  saleCurrency: string
  saleAmount: number | null
  soldAt: string | null
  soldByUserName: string | null
  qrToken: string
  createdAt: string
  imageUrl?: string | null
  unitCost?: number
  costCurrency?: string
}

export interface CreatePlatePayload {
  stoneId: number
  incomingStockId: number
  width: number
  height: number
  warehouse: string
}

export async function fetchPlates(): Promise<Plate[]> {
  const { data } = await apiClient.get<Plate[]>('/plates')
  return data
}

export async function createPlate(payload: CreatePlatePayload) {
  const { data } = await apiClient.post('/plates', payload)
  return data as { message: string; id: number; qrToken: string }
}

export interface UpdatePlatePayload {
  plateNo: string
  width: number
  height: number
  warehouse: string
}

export async function updatePlate(id: number, payload: UpdatePlatePayload) {
  const { data } = await apiClient.put(`/plates/${id}`, payload)
  return data as { message: string }
}

export async function reservePlate(id: number) {
  const { data } = await apiClient.post(`/plates/${id}/reserve`)
  return data as { message: string }
}

export async function unreservePlate(id: number) {
  const { data } = await apiClient.post(`/plates/${id}/unreserve`)
  return data as { message: string }
}

export async function markPlateSold(id: number, saleAmount: number | null) {
  const { data } = await apiClient.post(`/plates/${id}/sell`, { saleAmount })
  return data as { message: string }
}

export async function uploadPlateImage(id: number, file: File) {
  const formData = new FormData()
  formData.append('image', file)
  const { data } = await apiClient.post(`/plates/${id}/image`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data as { message: string; imageUrl: string }
}

export async function deletePlate(id: number) {
  const { data } = await apiClient.delete(`/plates/${id}`)
  return data as { message: string }
}

export const SUPPLY_TYPES = ['Ocak', 'Ithalat', 'YerelTedarikci', 'Diger'] as const
export const SUPPLY_TYPE_LABELS: Record<string, string> = {
  Ocak: 'Ocak',
  Ithalat: 'İthalat',
  YerelTedarikci: 'Yerel Tedarikçi',
  Diger: 'Diğer',
}
export const CURRENCIES = ['TRY', 'USD', 'EUR'] as const

export interface TextureOption {
  id: number
  name: string
}

export async function fetchTextures(): Promise<TextureOption[]> {
  const { data } = await apiClient.get<TextureOption[]>('/textures')
  return data
}

export async function createTexture(name: string) {
  const { data } = await apiClient.post<TextureOption>('/textures', { name })
  return data
}

export async function deleteTexture(id: number) {
  const { data } = await apiClient.delete(`/textures/${id}`)
  return data as { message: string }
}

export interface WarehouseOption {
  id: number
  name: string
}

export async function fetchWarehouses(): Promise<WarehouseOption[]> {
  const { data } = await apiClient.get<WarehouseOption[]>('/warehouses')
  return data
}

export async function createWarehouse(name: string) {
  const { data } = await apiClient.post<WarehouseOption>('/warehouses', { name })
  return data
}

export async function deleteWarehouse(id: number) {
  const { data } = await apiClient.delete(`/warehouses/${id}`)
  return data as { message: string }
}
