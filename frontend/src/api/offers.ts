import { apiClient } from './client'

export interface OfferItem {
  id: number
  plateId: number | null
  plateNo: string
  stoneName: string
  widthCm: number
  heightCm: number
  thicknessCm: number
  texture: string
  areaM2: number
  unitPrice: number
  lineTotal: number
  quantity: number
  plateIds: number[]
}

export interface Offer {
  id: number
  companyName: string
  companyAddress: string | null
  offerDate: string
  currency: string
  vatIncluded: boolean
  validityDays: number
  deliveryMethod: string | null
  deliveryAddress: string | null
  shippingIncluded: boolean
  usdRate: number | null
  totalAmount: number
  createdByUserName: string
  createdAt: string
  isSold: boolean
  soldAt: string | null
  items: OfferItem[]
}

export interface CreateOfferItemPayload {
  plateId: number | null
  plateNo: string
  stoneName: string
  widthCm: number
  heightCm: number
  thicknessCm: number
  texture: string
  areaM2: number
  unitPrice: number
  quantity: number
  plateIds: number[]
}

export interface CreateOfferPayload {
  companyName: string
  companyAddress: string | null
  offerDate: string
  currency: string
  vatIncluded: boolean
  validityDays: number
  deliveryMethod: string | null
  deliveryAddress: string | null
  shippingIncluded: boolean
  usdRate: number | null
  items: CreateOfferItemPayload[]
}

export async function fetchOffers(): Promise<Offer[]> {
  const { data } = await apiClient.get<Offer[]>('/offers')
  return data
}

export async function fetchOffer(id: number): Promise<Offer> {
  const { data } = await apiClient.get<Offer>(`/offers/${id}`)
  return data
}

export async function createOffer(payload: CreateOfferPayload) {
  const { data } = await apiClient.post('/offers', payload)
  return data as { message: string; id: number }
}

export async function deleteOffer(id: number) {
  const { data } = await apiClient.delete(`/offers/${id}`)
  return data as { message: string }
}

export async function markOfferSold(id: number) {
  const { data } = await apiClient.post(`/offers/${id}/mark-sold`)
  return data as { message: string }
}
