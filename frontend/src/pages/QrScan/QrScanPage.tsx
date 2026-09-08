import { useEffect, useMemo, useRef, useState } from 'react'
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
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import { scanQrCode, type QrScanResponse } from '../../api/qrScan'
import { fetchStones, type Plate } from '../../api/catalog'
import { ImageThumbnail } from '../../components/common/ImageThumbnail'
import { PlateInfoCard } from '../../components/common/PlateInfoCard'
import {
  exportPlateInfoJpeg,
  exportPlateInfoPdf,
  openPlateInfoWhatsApp,
  sharePlateInfoJpegToWhatsApp,
  type PlateInfoItem,
} from '../../utils/plateExport'

const statusColor: Record<Plate['status'], 'success' | 'warning' | 'default' | 'error'> = {
  Aktif: 'success',
  Rezerve: 'warning',
  Satildi: 'default',
  Pasif: 'error',
}

export function QrScanPage() {
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

  const stonesQuery = useQuery({ queryKey: ['stones'], queryFn: fetchStones, enabled: !!plate })

  const plateInfoItem = useMemo<PlateInfoItem | null>(() => {
    if (!plate) return null
    return {
      plateId: plate.id,
      plateNo: plate.plateNo,
      stoneName: plate.stoneName,
      widthCm: Math.round(plate.width * 10000) / 100,
      heightCm: Math.round(plate.height * 10000) / 100,
      thicknessCm: plate.thickness,
      color: stonesQuery.data?.find((s) => s.id === plate.stoneId)?.color ?? '—',
      texture: plate.texture,
      imageUrl: plate.imageUrl,
    }
  }, [plate, stonesQuery.data])

  const plateInfoCardRef = useRef<HTMLDivElement | null>(null)
  const [plateInfoExporting, setPlateInfoExporting] = useState<'pdf' | 'jpeg' | 'whatsapp' | null>(null)
  const [plateInfoExportError, setPlateInfoExportError] = useState<string | null>(null)

  const getPlateInfoCardElements = () => (plateInfoCardRef.current ? [plateInfoCardRef.current] : [])

  const handleExportPlateInfoPdf = async () => {
    setPlateInfoExportError(null)
    setPlateInfoExporting('pdf')
    try {
      await exportPlateInfoPdf(getPlateInfoCardElements())
    } catch {
      setPlateInfoExportError('PDF oluşturulamadı.')
    } finally {
      setPlateInfoExporting(null)
    }
  }

  const handleExportPlateInfoJpeg = async () => {
    setPlateInfoExportError(null)
    setPlateInfoExporting('jpeg')
    try {
      await exportPlateInfoJpeg(getPlateInfoCardElements())
    } catch {
      setPlateInfoExportError('JPEG oluşturulamadı.')
    } finally {
      setPlateInfoExporting(null)
    }
  }

  const handleShareWhatsAppPlateInfo = async () => {
    if (!plateInfoItem) return
    setPlateInfoExportError(null)
    setPlateInfoExporting('whatsapp')
    try {
      const cardEls = getPlateInfoCardElements()
      const result = await sharePlateInfoJpegToWhatsApp(cardEls)
      if (result === 'unsupported') {
        // Tarayıcı dosya paylaşımını desteklemiyor (ör. masaüstü Firefox); JPEG'i indirip
        // WhatsApp'ı metinle açan eski yönteme geri dönülür, kullanıcı dosyayı elle ekler.
        await exportPlateInfoJpeg(cardEls)
        openPlateInfoWhatsApp([plateInfoItem])
        setPlateInfoExportError(
          "Tarayıcınız doğrudan dosya paylaşımını desteklemiyor; JPEG indirildi, WhatsApp'ta ekleyerek gönderebilirsiniz.",
        )
      }
    } catch {
      setPlateInfoExportError('WhatsApp paylaşımı başarısız oldu.')
    } finally {
      setPlateInfoExporting(null)
    }
  }

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
                {response?.stonePlateCount != null && (
                  <Row label="Bu Taştan Kalan Plaka" value={`${response.stonePlateCount} adet`} />
                )}
                {response?.stoneTotalAreaM2 != null && (
                  <Row label="Bu Taştan Kalan Toplam Alan" value={`${response.stoneTotalAreaM2.toLocaleString('tr-TR')} m²`} />
                )}
              </Stack>

              <Stack direction="row" spacing={1.5} useFlexGap sx={{ mt: 3, flexWrap: 'wrap' }}>
                <Button variant="contained" onClick={resumeScanning}>
                  Tekrar Tara
                </Button>
                <Button
                  variant="outlined"
                  color="success"
                  startIcon={<WhatsAppIcon />}
                  disabled={!!plateInfoExporting}
                  onClick={handleShareWhatsAppPlateInfo}
                >
                  {plateInfoExporting === 'whatsapp' ? 'Hazırlanıyor…' : "WhatsApp'ta Gönder"}
                </Button>
                <Button variant="outlined" disabled={!!plateInfoExporting} onClick={handleExportPlateInfoJpeg}>
                  {plateInfoExporting === 'jpeg' ? 'Hazırlanıyor…' : 'JPEG İndir'}
                </Button>
                <Button variant="outlined" disabled={!!plateInfoExporting} onClick={handleExportPlateInfoPdf}>
                  {plateInfoExporting === 'pdf' ? 'Hazırlanıyor…' : 'PDF İndir'}
                </Button>
              </Stack>

              {plateInfoExportError && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  {plateInfoExportError}
                </Alert>
              )}

              {plateInfoItem && (
                <Box sx={{ position: 'fixed', top: 0, left: '-9999px', width: 420, zIndex: -1 }} aria-hidden>
                  <PlateInfoCard
                    item={plateInfoItem}
                    cardRef={(el) => {
                      plateInfoCardRef.current = el
                    }}
                  />
                </Box>
              )}
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
