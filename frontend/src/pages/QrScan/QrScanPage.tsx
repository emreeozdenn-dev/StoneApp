import { useEffect, useRef, useState } from 'react'
import QrScanner from 'qr-scanner'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { scanQrCode, type QrScanResponse } from '../../api/qrScan'
import type { Plate } from '../../api/catalog'
import { fetchExchangeRates } from '../../api/exchangeRates'
import { ImageThumbnail } from '../../components/common/ImageThumbnail'
import { hasPermission, useCurrentUser } from '../../auth/useCurrentUser'

// TCMB döviz satış kuruyla, ilgili tutarı TL karşılığına çevirir. `multiplyByArea` ile birim
// (m² başına) fiyatlar plakanın alanıyla çarpılıp toplam TL değeri hesaplanır.
function tryEquivalent(
  amount: number,
  currency: string,
  rates: { usdTry: number | null; eurTry: number | null } | undefined,
  area?: number,
): string | null {
  if (currency === 'TRY' || !rates) return null
  const rate = currency === 'USD' ? rates.usdTry : currency === 'EUR' ? rates.eurTry : null
  if (!rate) return null
  const total = area != null ? amount * area * rate : amount * rate
  return `≈ ${total.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TRY`
}

const statusColor: Record<Plate['status'], 'success' | 'warning' | 'default' | 'error'> = {
  Aktif: 'success',
  Rezerve: 'warning',
  Satildi: 'default',
  Pasif: 'error',
}

export function QrScanPage() {
  const { user } = useCurrentUser()
  const canSeeCost =
    hasPermission(user?.permissions, 'cost.unit.view') &&
    hasPermission(user?.permissions, 'cost.currency.view')

  const ratesQuery = useQuery({
    queryKey: ['exchange-rates'],
    queryFn: fetchExchangeRates,
    staleTime: 30 * 60_000,
  })
  const rates = ratesQuery.data ?? undefined

  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<QrScanner | null>(null)
  const processingRef = useRef(false)

  const [cameraAvailable, setCameraAvailable] = useState<boolean | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [manualValue, setManualValue] = useState('')
  const [response, setResponse] = useState<QrScanResponse | null>(null)

  const scanMutation = useMutation({
    mutationFn: scanQrCode,
    onSuccess: (data) => setResponse(data),
  })

  const runScan = (rawValue: string) => {
    if (processingRef.current) return
    processingRef.current = true
    setResponse(null)
    scannerRef.current?.pause()
    scanMutation.mutate(rawValue, {
      onSettled: () => {
        processingRef.current = false
      },
    })
  }

  useEffect(() => {
    if (!videoRef.current) return

    const scanner = new QrScanner(videoRef.current, (result) => runScan(result.data), {
      highlightScanRegion: true,
      highlightCodeOutline: true,
      maxScansPerSecond: 4,
      preferredCamera: 'environment',
    })
    scannerRef.current = scanner

    QrScanner.hasCamera().then(setCameraAvailable)

    scanner.start().catch((err: unknown) => {
      setCameraError(err instanceof Error ? err.message : 'Kamera başlatılamadı.')
    })

    return () => {
      scanner.destroy()
      scannerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleManualSubmit = () => {
    const value = manualValue.trim()
    if (!value) return
    runScan(value)
  }

  const resumeScanning = () => {
    setResponse(null)
    setManualValue('')
    scanMutation.reset()
    scannerRef.current?.start().catch(() => undefined)
  }

  const plate = response?.plate
  const showBusy = scanMutation.isPending
  const showRetry = <Button onClick={resumeScanning}>Tekrar Tara</Button>

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
        QR Kod Tara
      </Typography>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
        <Paper variant="outlined" sx={{ p: 2, flex: '0 0 360px', maxWidth: 360 }}>
          {cameraAvailable === false && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Bu cihazda kamera bulunamadı. Aşağıdan QR kodu elle girebilirsiniz.
            </Alert>
          )}
          {cameraError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {cameraError}
            </Alert>
          )}
          <Box
            sx={{
              position: 'relative',
              width: '100%',
              aspectRatio: '1 / 1',
              borderRadius: 2,
              overflow: 'hidden',
              bgcolor: 'action.hover',
            }}
          >
            <Box
              component="video"
              ref={videoRef}
              muted
              playsInline
              sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
            Plaka üzerindeki QR kodu kamera görüş alanına getirin.
          </Typography>

          <Divider sx={{ my: 2 }} />

          <Stack spacing={1.5}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Elle Kod Girişi
            </Typography>
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                fullWidth
                placeholder="QR kod değeri veya Plaka No"
                value={manualValue}
                onChange={(e) => setManualValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
              />
              <Button variant="outlined" onClick={handleManualSubmit} disabled={showBusy}>
                Ara
              </Button>
            </Stack>
          </Stack>
        </Paper>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          {showBusy && (
            <Stack sx={{ alignItems: 'center', py: 6 }}>
              <CircularProgress size={28} />
            </Stack>
          )}

          {!showBusy && response?.result === 'NotFound' && (
            <Alert severity="warning" action={showRetry}>
              Bu QR koduna ait bir plaka bulunamadı.
            </Alert>
          )}

          {!showBusy && response?.result === 'Invalid' && (
            <Alert severity="error" action={showRetry}>
              Geçersiz QR kodu.
            </Alert>
          )}

          {!showBusy && scanMutation.isError && (
            <Alert severity="error" action={showRetry}>
              Tarama sırasında bir hata oluştu.
            </Alert>
          )}

          {!showBusy && plate && (
            <Paper variant="outlined" sx={{ p: 3 }}>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start', mb: 2 }}>
                <ImageThumbnail src={plate.imageUrl} alt={plate.plateNo} size={72} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {plate.plateNo}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {plate.stoneName} — {plate.batchCode}
                  </Typography>
                </Box>
                <Chip label={plate.status} color={statusColor[plate.status]} size="small" />
              </Stack>

              <Stack spacing={1} divider={<Divider flexItem />}>
                <Row
                  label="Boyut"
                  value={`${Math.round(plate.width * 10000) / 100} x ${Math.round(plate.height * 10000) / 100} cm`}
                />
                <Row label="Alan" value={`${plate.area.toLocaleString('tr-TR')} m²`} />
                <Row label="Doku" value={plate.texture} />
                <Row label="Kalınlık" value={`${plate.thickness} cm`} />
                <Row label="Depo" value={plate.warehouse} />
                {canSeeCost && plate.unitCost != null && (
                  <Row
                    label="Birim Maliyet"
                    value={`${plate.unitCost.toLocaleString('tr-TR')} ${plate.costCurrency}`}
                    hint={tryEquivalent(plate.unitCost, plate.costCurrency ?? 'TRY', rates, plate.area)}
                  />
                )}
                {plate.saleCost != null && (
                  <Row
                    label="Satış Maliyeti"
                    value={`${plate.saleCost.toLocaleString('tr-TR')} ${plate.saleCurrency}`}
                    hint={tryEquivalent(plate.saleCost, plate.saleCurrency, rates, plate.area)}
                  />
                )}
                {plate.saleAmount != null && (
                  <Row
                    label="Satış Tutarı"
                    value={`${plate.saleAmount.toLocaleString('tr-TR')} ${plate.saleCurrency}`}
                    hint={tryEquivalent(plate.saleAmount, plate.saleCurrency, rates)}
                  />
                )}
              </Stack>

              {rates && (rates.usdTry || rates.eurTry) && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                  TCMB döviz satış kuru ({rates.date}): 1 USD ≈ {rates.usdTry?.toLocaleString('tr-TR')} TRY, 1 EUR ≈{' '}
                  {rates.eurTry?.toLocaleString('tr-TR')} TRY
                </Typography>
              )}

              <Button variant="contained" sx={{ mt: 3 }} onClick={resumeScanning}>
                Tekrar Tara
              </Button>
            </Paper>
          )}

          {!showBusy && !response && !scanMutation.isError && (
            <Typography variant="body2" color="text.secondary">
              Taranan plaka bilgileri burada görünecek.
            </Typography>
          )}
        </Box>
      </Stack>
    </Box>
  )
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string | null }) {
  return (
    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Stack sx={{ alignItems: 'flex-end' }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {value}
        </Typography>
        {hint && (
          <Typography variant="caption" color="text.secondary">
            {hint}
          </Typography>
        )}
      </Stack>
    </Stack>
  )
}
