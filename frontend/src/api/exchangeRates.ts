import { apiClient } from './client'

export interface ExchangeRates {
  date: string
  usdTry: number | null
  eurTry: number | null
}

export async function fetchExchangeRates(): Promise<ExchangeRates | null> {
  const { data } = await apiClient.get<ExchangeRates | null>('/exchange-rates')
  return data
}

export async function fetchHistoricalExchangeRates(date: string): Promise<ExchangeRates | null> {
  const { data } = await apiClient.get<ExchangeRates | null>('/exchange-rates/historical', { params: { date } })
  return data
}
