import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  InputAdornment,
  MenuItem,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/SearchOutlined'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import {
  CURRENCIES,
  createPlate,
  deletePlate,
  fetchIncomingStocks,
  fetchPlates,
  fetchStones,
  markPlateSold,
  reservePlate,
  SUPPLY_TYPE_LABELS,
  unreservePlate,
  updatePlate,
  uploadPlateImage,
  type Plate,
} from '../../api/catalog'
import { fetchExchangeRates } from '../../api/exchangeRates'
import { createOffer, sendOfferEmail, type OfferStatus } from '../../api/offers'
import { fetchCompanyBranding } from '../../api/systemSettings'
import { hasPermission, useCurrentUser } from '../../auth/useCurrentUser'
import { ColumnSettingsButton } from '../../components/common/ColumnSettingsButton'
import { OfferPreviewDocument } from '../../components/common/OfferPreviewDocument'
import { BarcodeThumbnail } from '../../components/common/BarcodeThumbnail'
import { GroupLabel } from '../../components/common/GroupLabel'
import { ImageDropzone } from '../../components/common/ImageDropzone'
import { ImageThumbnail } from '../../components/common/ImageThumbnail'
import { PlateInfoCard } from '../../components/common/PlateInfoCard'
import { QrCodeThumbnail } from '../../components/common/QrCodeThumbnail'
import { RichTextEditor } from '../../components/common/RichTextEditor'
import { StatTile } from '../../components/common/StatTile'
import { type ColumnDef, useColumnPreferences } from '../../components/common/useColumnPreferences'
import { useDraggableColumns } from '../../components/common/useDraggableColumns'
import { WarehouseField } from '../../components/common/WarehouseField'
import { resizeBundleLabels } from '../../utils/bundles'
import {
  exportOfferPdf,
  exportPlateInfoJpeg,
  exportPlateInfoPdf,
  generateOfferPdfBlob,
  openPlateInfoWhatsApp,
  sharePlateInfoJpegToWhatsApp,
  type PlateInfoItem,
} from '../../utils/plateExport'

type PlateColumnKey =
  | 'image'
  | 'qr'
  | 'barcode'
  | 'plateNo'
  | 'stoneName'
  | 'batchCode'
  | 'bundle'
  | 'dimensions'
  | 'area'
  | 'warehouse'
  | 'status'
  | 'supplyType'
  | 'unitCost'
  | 'saleCost'
  | 'saleCostLive'
  | 'saleCostArrival'
  | 'saleAmount'

const initialForm = {
  stoneId: '',
  incomingStockId: '',
  bundleNumber: '',
  width: '',
  height: '',
  warehouse: '',
}

const initialBulkForm = {
  stoneId: '',
  incomingStockId: '',
  bundleNumber: '',
  width: '',
  height: '',
  warehouse: '',
  plateCount: '1',
}

function metersToCm(meters: number) {
  return Math.round(meters * 10000) / 100
}

function cmToMeters(cm: number) {
  return cm / 100
}

function sanitizeTwoDecimals(value: string): string {
  const cleaned = value.replace(',', '.').replace(/[^0-9.]/g, '')
  const [whole, ...rest] = cleaned.split('.')
  if (rest.length === 0) return whole
  return `${whole}.${rest.join('').slice(0, 2)}`
}

const statusColor: Record<Plate['status'], 'success' | 'warning' | 'default' | 'error'> = {
  Aktif: 'success',
  Rezerve: 'warning',
  Satildi: 'default',
  Pasif: 'error',
}

const supplyTypeColor: Record<string, 'primary' | 'info' | 'success' | 'warning' | 'secondary'> = {
  Ocak: 'primary',
  Ithalat: 'info',
  YerelTedarikci: 'success',
  Konsinye: 'warning',
  Diger: 'secondary',
}

export function PlatesPage() {
  const { user } = useCurrentUser()
  const queryClient = useQueryClient()
  const platesQuery = useQuery({ queryKey: ['plates'], queryFn: fetchPlates })
  const stonesQuery = useQuery({ queryKey: ['stones'], queryFn: fetchStones })
  const incomingQuery = useQuery({ queryKey: ['incoming-stock'], queryFn: fetchIncomingStocks })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [createImage, setCreateImage] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [createSubmitting, setCreateSubmitting] = useState(false)

  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [bulkForm, setBulkForm] = useState(initialBulkForm)
  const [bulkImage, setBulkImage] = useState<File | null>(null)
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null)

  const [saleDialogPlate, setSaleDialogPlate] = useState<Plate | null>(null)
  const [saleAmount, setSaleAmount] = useState('')
  const [saleCurrency, setSaleCurrency] = useState('TRY')

  const [saleInfoPlate, setSaleInfoPlate] = useState<Plate | null>(null)

  const [imageDialogPlate, setImageDialogPlate] = useState<Plate | null>(null)
  const [imageDialogFile, setImageDialogFile] = useState<File | null>(null)
  const imageDialogInputRef = useRef<HTMLInputElement>(null)

  const [editingPlate, setEditingPlate] = useState<Plate | null>(null)
  const [editForm, setEditForm] = useState<{
    plateNo: string
    bundleNumber: string
    width: string
    height: string
    warehouse: string
  } | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [editSubmitting, setEditSubmitting] = useState(false)

  const canCreate = hasPermission(user?.permissions, 'plates.create')
  const canEdit = hasPermission(user?.permissions, 'plates.edit')
  const canDelete = hasPermission(user?.permissions, 'plates.delete')
  const canSeeCost =
    hasPermission(user?.permissions, 'cost.unit.view') &&
    hasPermission(user?.permissions, 'cost.currency.view')

  const plateColumns = useMemo<ColumnDef<PlateColumnKey>[]>(() => {
    const cols: ColumnDef<PlateColumnKey>[] = [
      { key: 'image', label: 'Görsel' },
      { key: 'plateNo', label: 'Plaka No' },
      { key: 'stoneName', label: 'Taş' },
      { key: 'batchCode', label: 'Parti/Lot Kodu' },
      { key: 'bundle', label: 'Bundle' },
      { key: 'dimensions', label: 'En x Boy (cm)', align: 'right' },
      { key: 'area', label: 'Alan (m²)', align: 'right' },
      { key: 'warehouse', label: 'Depo' },
    ]
    if (canSeeCost) cols.push({ key: 'unitCost', label: 'Birim Maliyet', align: 'right' })
    cols.push({ key: 'saleCost', label: 'Satış Maliyeti', align: 'right' })
    if (canSeeCost) {
      cols.push({ key: 'saleCostLive', label: 'Satış Maliyeti (Güncel Kura Göre)', align: 'right' })
      cols.push({ key: 'saleCostArrival', label: 'Satış Maliyeti (Geliş Kuruna Göre)', align: 'right' })
    }
    cols.push({ key: 'status', label: 'Durum' })
    cols.push({ key: 'supplyType', label: 'Tedarik Türü' })
    cols.push({ key: 'barcode', label: 'Barkod' })
    cols.push({ key: 'qr', label: 'QR' })
    cols.push({ key: 'saleAmount', label: 'Satış Tutarı', align: 'right' })
    return cols
  }, [canSeeCost])

  const columnPrefs = useColumnPreferences('plates', plateColumns, { defaultHidden: ['saleAmount'] })
  const draggableColumns = useDraggableColumns(columnPrefs.reorderTo)

  function renderPlateCell(key: PlateColumnKey, p: Plate) {
    switch (key) {
      case 'image':
        return <ImageThumbnail src={p.imageUrl} alt={p.plateNo} />
      case 'qr':
        return (
          <QrCodeThumbnail
            value={p.qrToken}
            label={{
              plateNo: p.plateNo,
              stoneName: p.stoneName,
              width: metersToCm(p.width),
              height: metersToCm(p.height),
            }}
          />
        )
      case 'barcode':
        return (
          <BarcodeThumbnail
            value={p.plateNo}
            label={{
              plateNo: p.plateNo,
              stoneName: p.stoneName,
              width: metersToCm(p.width),
              height: metersToCm(p.height),
            }}
          />
        )
      case 'plateNo':
        return p.plateNo
      case 'stoneName':
        return p.stoneName
      case 'batchCode':
        return p.batchCode
      case 'bundle':
        return p.bundleNumber != null ? `Bundle ${p.bundleNumber}` : '—'
      case 'dimensions':
        return `${metersToCm(p.width).toLocaleString('tr-TR')} x ${metersToCm(p.height).toLocaleString('tr-TR')}`
      case 'area':
        return p.area.toLocaleString('tr-TR')
      case 'warehouse':
        return p.warehouse
      case 'status':
        return <Chip label={p.status} size="small" color={statusColor[p.status]} />
      case 'supplyType':
        return (
          <Chip
            label={SUPPLY_TYPE_LABELS[p.supplyType] ?? p.supplyType}
            size="small"
            color={supplyTypeColor[p.supplyType] ?? 'default'}
            variant="outlined"
          />
        )
      case 'unitCost':
        return p.unitCost != null ? `${p.unitCost.toLocaleString('tr-TR')} ${p.costCurrency}` : '—'
      case 'saleCost':
        return p.saleCost != null ? `${p.saleCost.toLocaleString('tr-TR')} ${p.saleCurrency}` : '—'
      case 'saleCostLive':
        return p.saleCostLiveRateTry != null ? `${p.saleCostLiveRateTry.toLocaleString('tr-TR')} TRY` : '—'
      case 'saleCostArrival':
        return p.saleCostArrivalRateTry != null ? `${p.saleCostArrivalRateTry.toLocaleString('tr-TR')} TRY` : '—'
      case 'saleAmount':
        return p.saleAmount != null
          ? `${p.saleAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${p.saleAmountCurrency ?? p.saleCurrency}`
          : '—'
      default:
        return null
    }
  }

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'Tumu' | Plate['status']>('Tumu')
  const filteredPlates = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (platesQuery.data ?? []).filter((p) => {
      if (statusFilter !== 'Tumu' && p.status !== statusFilter) return false
      if (!term) return true
      return [p.plateNo, p.stoneName, p.batchCode, p.warehouse].some((field) =>
        field.toLowerCase().includes(term),
      )
    })
  }, [platesQuery.data, search, statusFilter])

  const plateStats = useMemo(() => {
    const all = platesQuery.data ?? []
    const now = new Date()
    return {
      total: all.length,
      activeArea: all.filter((p) => p.status === 'Aktif').reduce((sum, p) => sum + p.area, 0),
      reserved: all.filter((p) => p.status === 'Rezerve').length,
      soldThisMonth: all.filter((p) => {
        if (p.status !== 'Satildi' || !p.soldAt) return false
        const d = new Date(p.soldAt)
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
      }).length,
    }
  }, [platesQuery.data])

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const allVisibleSelected = filteredPlates.length > 0 && filteredPlates.every((p) => selectedIds.has(p.id))
  const someVisibleSelected = !allVisibleSelected && filteredPlates.some((p) => selectedIds.has(p.id))
  const selectedPlates = useMemo(
    () => (platesQuery.data ?? []).filter((p) => selectedIds.has(p.id)),
    [platesQuery.data, selectedIds],
  )

  function toggleSelected(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        filteredPlates.forEach((p) => next.delete(p.id))
      } else {
        filteredPlates.forEach((p) => next.add(p.id))
      }
      return next
    })
  }

  const [plateInfoDialogOpen, setPlateInfoDialogOpen] = useState(false)

  const [offerDialogOpen, setOfferDialogOpen] = useState(false)
  const offerContainerRef = useRef<HTMLDivElement>(null)
  const [offerCompany, setOfferCompany] = useState('')
  const [offerCompanyAddress, setOfferCompanyAddress] = useState('')
  const [offerDate, setOfferDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [offerCurrency, setOfferCurrency] = useState('USD')
  const [offerVatIncluded, setOfferVatIncluded] = useState<'Dahil' | 'Haric'>('Haric')
  const [offerValidityDays, setOfferValidityDays] = useState('15')
  const [offerDeliveryMethod, setOfferDeliveryMethod] = useState('')
  const [offerDeliveryAddress, setOfferDeliveryAddress] = useState('')
  const [offerShippingIncluded, setOfferShippingIncluded] = useState<'Dahil' | 'Haric'>('Haric')
  const [offerUnitPrices, setOfferUnitPrices] = useState<Record<string, string>>({})
  const [offerUsdRateOverrideEnabled, setOfferUsdRateOverrideEnabled] = useState(false)
  const [offerUsdRateOverride, setOfferUsdRateOverride] = useState('')
  const [mergeDecisions, setMergeDecisions] = useState<Record<string, boolean>>({})

  const [offerRecipientEmail, setOfferRecipientEmail] = useState('')
  const [offerCcEmail, setOfferCcEmail] = useState('')
  const [offerEmailSubject, setOfferEmailSubject] = useState('Fiyat Teklifi')
  const [offerEmailMessage, setOfferEmailMessage] = useState('')

  const offerBrandingQuery = useQuery({ queryKey: ['company-branding'], queryFn: fetchCompanyBranding })
  const offerRatesQuery = useQuery({ queryKey: ['exchange-rates'], queryFn: fetchExchangeRates })
  const offerFetchedUsdRate = offerRatesQuery.data?.usdTry ?? null
  const offerEffectiveUsdRate = offerUsdRateOverrideEnabled ? Number(offerUsdRateOverride) || null : offerFetchedUsdRate

  // Aynı taş, aynı en/boy/kalınlığa sahip plakaları tek grupta toplar; adet birleştirmesi bu gruplardan üretilir.
  const offerGroups = useMemo(() => {
    const map = new Map<string, Plate[]>()
    selectedPlates.forEach((p) => {
      const key = `${p.stoneId}|${p.width}|${p.height}|${p.thickness}`
      const arr = map.get(key)
      if (arr) {
        arr.push(p)
      } else {
        map.set(key, [p])
      }
    })
    return map
  }, [selectedPlates])

  // Aynı grupta birden fazla plaka olup parti/lot kodları farklıysa, kullanıcıya birleştirilsin mi diye sorulur.
  const pendingMergeGroup = useMemo(() => {
    for (const [key, plates] of offerGroups.entries()) {
      if (plates.length > 1) {
        const batches = new Set(plates.map((p) => p.batchCode))
        if (batches.size > 1 && mergeDecisions[key] === undefined) {
          return { key, plates }
        }
      }
    }
    return null
  }, [offerGroups, mergeDecisions])

  interface OfferLine {
    key: string
    plates: Plate[]
    quantity: number
  }

  const offerLines = useMemo<OfferLine[]>(() => {
    const lines: OfferLine[] = []
    offerGroups.forEach((plates, key) => {
      if (plates.length === 1) {
        lines.push({ key, plates, quantity: 1 })
        return
      }
      const batches = new Set(plates.map((p) => p.batchCode))
      const sameBatch = batches.size <= 1
      const merge = sameBatch || mergeDecisions[key] === true
      if (merge) {
        lines.push({ key, plates, quantity: plates.length })
      } else {
        plates.forEach((p) => {
          lines.push({ key: `${key}#${p.id}`, plates: [p], quantity: 1 })
        })
      }
    })
    return lines
  }, [offerGroups, mergeDecisions])

  const getLineUnitPrice = (line: OfferLine) => {
    const raw = offerUnitPrices[line.key]
    if (raw !== undefined) return raw
    const fallback = line.plates[0].saleCost
    return fallback != null ? String(fallback) : ''
  }

  const openOfferDialog = () => {
    setOfferDate(new Date().toISOString().slice(0, 10))
    setOfferUsdRateOverrideEnabled(false)
    setOfferUsdRateOverride('')
    setOfferSaveSuccess(false)
    setOfferEmailSuccess(false)
    setOfferExportError(null)
    setOfferUnitPrices({})
    setMergeDecisions({})
    setOfferDialogOpen(true)
  }

  const closeOfferDialog = () => {
    setOfferDialogOpen(false)
  }

  const offerTotal = offerLines.reduce((sum, line) => {
    const unitPrice = Number(getLineUnitPrice(line)) || 0
    return sum + unitPrice * line.plates[0].area * line.quantity
  }, 0)

  const [offerExporting, setOfferExporting] = useState(false)
  const [offerExportError, setOfferExportError] = useState<string | null>(null)

  const handleExportOfferPdf = async () => {
    setOfferExportError(null)
    setOfferExporting(true)
    try {
      if (offerContainerRef.current) {
        await exportOfferPdf(offerContainerRef.current)
      }
    } catch {
      setOfferExportError('PDF oluşturulamadı.')
    } finally {
      setOfferExporting(false)
    }
  }

  const [offerSaveSuccess, setOfferSaveSuccess] = useState(false)

  const saveOfferMutation = useMutation({
    mutationFn: createOffer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers'] })
      setOfferSaveSuccess(true)
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Teklif kaydedilemedi.'
      setOfferExportError(message)
    },
  })

  const buildOfferPayload = (status: OfferStatus) => ({
    companyName: offerCompany,
    companyAddress: offerCompanyAddress || null,
    offerDate,
    currency: offerCurrency,
    vatIncluded: offerVatIncluded === 'Dahil',
    validityDays: Number(offerValidityDays) || 0,
    deliveryMethod: offerDeliveryMethod || null,
    deliveryAddress: offerDeliveryAddress || null,
    shippingIncluded: offerShippingIncluded === 'Dahil',
    usdRate: offerEffectiveUsdRate,
    status,
    items: offerLines.map((line) => {
      const rep = line.plates[0]
      return {
        plateId: line.quantity === 1 ? rep.id : null,
        plateNo: line.plates.map((p) => p.plateNo).join(', '),
        stoneName: rep.stoneName,
        widthCm: metersToCm(rep.width),
        heightCm: metersToCm(rep.height),
        thicknessCm: rep.thickness,
        texture: rep.texture,
        areaM2: rep.area,
        unitPrice: Number(getLineUnitPrice(line)) || 0,
        quantity: line.quantity,
        plateIds: line.plates.map((p) => p.id),
      }
    }),
  })

  const handleSaveOffer = () => {
    setOfferExportError(null)
    setOfferSaveSuccess(false)
    saveOfferMutation.mutate(buildOfferPayload('Taslak'))
  }

  const [offerEmailSuccess, setOfferEmailSuccess] = useState(false)

  const sendOfferEmailMutation = useMutation({
    mutationFn: sendOfferEmail,
    onSuccess: () => {
      setOfferEmailSuccess(true)
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Teklif e-postası gönderilemedi.'
      setOfferExportError(message)
    },
  })

  const handleSendOfferEmail = async () => {
    setOfferExportError(null)
    setOfferEmailSuccess(false)
    if (!offerRecipientEmail.trim()) {
      setOfferExportError('Alıcı e-posta adresi gerekli.')
      return
    }
    if (!offerContainerRef.current) return
    try {
      const pdfBlob = await generateOfferPdfBlob(offerContainerRef.current)
      sendOfferEmailMutation.mutate(
        {
          to: offerRecipientEmail.trim(),
          cc: offerCcEmail.trim(),
          subject: offerEmailSubject.trim() || 'Fiyat Teklifi',
          htmlBody: offerEmailMessage,
          pdf: pdfBlob,
        },
        {
          onSuccess: async () => {
            try {
              await createOffer(buildOfferPayload('Gonderildi'))
              queryClient.invalidateQueries({ queryKey: ['offers'] })
            } catch {
              setOfferExportError('Teklif e-postası gönderildi ancak teklif listeye kaydedilemedi.')
            }
          },
        },
      )
    } catch {
      setOfferExportError('Teklif PDF olarak hazırlanamadı.')
    }
  }

  const plateInfoItems = useMemo<PlateInfoItem[]>(
    () =>
      selectedPlates.map((p) => ({
        plateId: p.id,
        plateNo: p.plateNo,
        stoneName: p.stoneName,
        widthCm: metersToCm(p.width),
        heightCm: metersToCm(p.height),
        thicknessCm: p.thickness,
        color: stonesQuery.data?.find((s) => s.id === p.stoneId)?.color ?? '—',
        texture: p.texture,
        imageUrl: p.imageUrl,
      })),
    [selectedPlates, stonesQuery.data],
  )

  const plateInfoContainerRef = useRef<HTMLDivElement>(null)
  const plateInfoCardRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const [plateInfoExporting, setPlateInfoExporting] = useState<'pdf' | 'jpeg' | 'whatsapp' | null>(null)
  const [plateInfoExportError, setPlateInfoExportError] = useState<string | null>(null)

  const getPlateInfoCardElements = () =>
    plateInfoItems
      .map((item) => plateInfoCardRefs.current[item.plateId])
      .filter((el): el is HTMLDivElement => !!el)

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
    setPlateInfoExportError(null)
    setPlateInfoExporting('whatsapp')
    try {
      const cardEls = getPlateInfoCardElements()
      const result = await sharePlateInfoJpegToWhatsApp(cardEls)
      if (result === 'unsupported') {
        // Tarayıcı dosya paylaşımını desteklemiyor (ör. masaüstü Firefox); JPEG'leri indirip
        // WhatsApp'ı metinle açan eski yönteme geri dönülür, kullanıcı dosyaları elle ekler.
        await exportPlateInfoJpeg(cardEls)
        openPlateInfoWhatsApp(plateInfoItems)
        setPlateInfoExportError(
          "Tarayıcınız doğrudan dosya paylaşımını desteklemiyor; JPEG(ler) indirildi, WhatsApp'ta ekleyerek gönderebilirsiniz.",
        )
      }
    } catch {
      setPlateInfoExportError('WhatsApp paylaşımı başarısız oldu.')
    } finally {
      setPlateInfoExporting(null)
    }
  }

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['plates'] })
    queryClient.invalidateQueries({ queryKey: ['stones'] })
    queryClient.invalidateQueries({ queryKey: ['incoming-stock'] })
  }

  const createMutation = useMutation({ mutationFn: createPlate })
  const uploadImageMutation = useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) => uploadPlateImage(id, file),
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: NonNullable<typeof editForm> }) =>
      updatePlate(id, {
        plateNo: payload.plateNo,
        bundleNumber: payload.bundleNumber ? Number(payload.bundleNumber) : null,
        width: cmToMeters(Number(payload.width) || 0),
        height: cmToMeters(Number(payload.height) || 0),
        warehouse: payload.warehouse,
      }),
  })

  const reserveMutation = useMutation({
    mutationFn: reservePlate,
    onSuccess: invalidateAll,
  })

  const unreserveMutation = useMutation({
    mutationFn: unreservePlate,
    onSuccess: invalidateAll,
  })

  const sellMutation = useMutation({
    mutationFn: ({ id, amount, currency }: { id: number; amount: number | null; currency: string }) =>
      markPlateSold(id, amount, currency),
    onSuccess: () => {
      invalidateAll()
      setSaleDialogPlate(null)
      setSaleAmount('')
      setSaleCurrency('TRY')
    },
  })

  const [deleteTarget, setDeleteTarget] = useState<Plate | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const deleteMutation = useMutation({
    mutationFn: deletePlate,
    onSuccess: () => {
      invalidateAll()
      setDeleteTarget(null)
      setDeleteError(null)
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Plaka silinemedi.'
      setDeleteError(message)
    },
  })

  const handleChange = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const handleBulkChange = (field: keyof typeof bulkForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setBulkForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const handleCreateSubmit = async () => {
    setError(null)
    setCreateSubmitting(true)
    try {
      const { id } = await createMutation.mutateAsync({
        stoneId: Number(form.stoneId),
        incomingStockId: Number(form.incomingStockId),
        bundleNumber: form.bundleNumber ? Number(form.bundleNumber) : null,
        width: cmToMeters(Number(form.width) || 0),
        height: cmToMeters(Number(form.height) || 0),
        warehouse: form.warehouse,
      })
      if (createImage) {
        await uploadImageMutation.mutateAsync({ id, file: createImage })
      }
      invalidateAll()
      setDialogOpen(false)
      setForm(initialForm)
      setCreateImage(null)
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Plaka oluşturulamadı.'
      setError(message)
    } finally {
      setCreateSubmitting(false)
    }
  }

  const handleBulkSubmit = async () => {
    setBulkError(null)
    const count = Math.floor(Number(bulkForm.plateCount)) || 0
    if (count < 1) {
      setBulkError('Plaka Sayısı en az 1 olmalı.')
      return
    }
    setBulkSubmitting(true)
    setBulkProgress({ done: 0, total: count })
    try {
      for (let i = 0; i < count; i++) {
        const { id } = await createMutation.mutateAsync({
          stoneId: Number(bulkForm.stoneId),
          incomingStockId: Number(bulkForm.incomingStockId),
          bundleNumber: bulkForm.bundleNumber ? Number(bulkForm.bundleNumber) : null,
          width: cmToMeters(Number(bulkForm.width) || 0),
          height: cmToMeters(Number(bulkForm.height) || 0),
          warehouse: bulkForm.warehouse,
        })
        if (bulkImage) {
          await uploadImageMutation.mutateAsync({ id, file: bulkImage })
        }
        setBulkProgress({ done: i + 1, total: count })
      }
      invalidateAll()
      setBulkDialogOpen(false)
      setBulkForm(initialBulkForm)
      setBulkImage(null)
      setBulkProgress(null)
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Plakalar oluşturulurken bir hata oluştu.'
      setBulkError(message)
    } finally {
      setBulkSubmitting(false)
    }
  }

  const openEdit = (plate: Plate) => {
    setEditingPlate(plate)
    setEditForm({
      plateNo: plate.plateNo,
      bundleNumber: plate.bundleNumber != null ? String(plate.bundleNumber) : '',
      width: String(metersToCm(plate.width)),
      height: String(metersToCm(plate.height)),
      warehouse: plate.warehouse,
    })
    setEditError(null)
  }

  const handleEditChange =
    (field: keyof NonNullable<typeof editForm>) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setEditForm((prev) => (prev ? { ...prev, [field]: e.target.value } : prev))
    }

  const handleEditSubmit = async () => {
    if (!editingPlate || !editForm) return
    setEditError(null)
    setEditSubmitting(true)
    try {
      await updateMutation.mutateAsync({ id: editingPlate.id, payload: editForm })
      invalidateAll()
      setEditingPlate(null)
      setEditForm(null)
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Plaka güncellenemedi.'
      setEditError(message)
    } finally {
      setEditSubmitting(false)
    }
  }

  const handleImageDialogSave = async () => {
    if (!imageDialogPlate || !imageDialogFile) return
    await uploadImageMutation.mutateAsync({ id: imageDialogPlate.id, file: imageDialogFile })
    invalidateAll()
    setImageDialogPlate(null)
    setImageDialogFile(null)
  }

  const batchesForStone =
    incomingQuery.data?.filter((i) => String(i.stoneId) === String(form.stoneId)) ?? []
  const selectedBatch = incomingQuery.data?.find((i) => String(i.id) === String(form.incomingStockId))
  const createBundleLabels = selectedBatch
    ? resizeBundleLabels(selectedBatch.bundleLabels ?? [], selectedBatch.bundleCount, (i) => `${selectedBatch.batchCode} Bundle ${i + 1}`)
    : []

  const bulkBatchesForStone =
    incomingQuery.data?.filter((i) => String(i.stoneId) === String(bulkForm.stoneId)) ?? []
  const bulkSelectedBatch = incomingQuery.data?.find((i) => String(i.id) === String(bulkForm.incomingStockId))
  const bulkBundleLabels = bulkSelectedBatch
    ? resizeBundleLabels(bulkSelectedBatch.bundleLabels ?? [], bulkSelectedBatch.bundleCount, (i) => `${bulkSelectedBatch.batchCode} Bundle ${i + 1}`)
    : []

  const editBatch = incomingQuery.data?.find((i) => i.id === editingPlate?.incomingStockId)
  const editBundleLabels = editBatch
    ? resizeBundleLabels(editBatch.bundleLabels ?? [], editBatch.bundleCount, (i) => `${editBatch.batchCode} Bundle ${i + 1}`)
    : []

  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Plakalar
        </Typography>
        {canCreate && (
          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={() => setDialogOpen(true)}>
              Plaka Ekle
            </Button>
            <Button variant="outlined" onClick={() => setBulkDialogOpen(true)}>
              Çoklu Plaka Ekle
            </Button>
          </Stack>
        )}
      </Stack>

      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1.75, mb: 3 }}>
        <StatTile label="Toplam Plaka" value={plateStats.total} />
        <StatTile label="Aktif Alan" value={`${plateStats.activeArea.toLocaleString('tr-TR')} m²`} />
        <StatTile label="Rezerve" value={plateStats.reserved} />
        <StatTile label="Bu Ay Satılan" value={plateStats.soldThisMonth} />
      </Stack>

      <Stack direction="row" spacing={2} sx={{ mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Plaka no, taş, parti kodu veya depo ara…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 280 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        <TextField
          select
          size="small"
          label="Durum"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'Tumu' | Plate['status'])}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="Tumu">Tümü</MenuItem>
          <MenuItem value="Aktif">Aktif</MenuItem>
          <MenuItem value="Rezerve">Rezerve</MenuItem>
          <MenuItem value="Satildi">Satıldı</MenuItem>
          <MenuItem value="Pasif">Pasif</MenuItem>
        </TextField>
        <ColumnSettingsButton columns={plateColumns} prefs={columnPrefs} />
        {selectedIds.size > 0 && (
          <>
            <Button size="small" variant="outlined" onClick={() => setPlateInfoDialogOpen(true)}>
              Plaka Bilgisi Gönder
            </Button>
            <Button size="small" variant="outlined" onClick={openOfferDialog}>
              Teklif Gönder
            </Button>
          </>
        )}
      </Stack>

      <Box sx={{ overflowX: 'auto' }}>
        <Table sx={{ minWidth: 1080 }}>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={someVisibleSelected}
                  checked={allVisibleSelected}
                  onChange={toggleSelectAllVisible}
                />
              </TableCell>
              {columnPrefs.visibleOrderedKeys.map((key) => {
                const col = plateColumns.find((c) => c.key === key)
                return (
                  <TableCell key={key} align={col?.align} {...draggableColumns.getHeaderCellProps(key)}>
                    {col?.label}
                  </TableCell>
                )
              })}
              {(canEdit || canDelete) && <TableCell>İşlem</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredPlates.map((p) => (
              <TableRow key={p.id} selected={selectedIds.has(p.id)}>
                <TableCell padding="checkbox">
                  <Checkbox checked={selectedIds.has(p.id)} onChange={() => toggleSelected(p.id)} />
                </TableCell>
                {columnPrefs.visibleOrderedKeys.map((key) => {
                  const col = plateColumns.find((c) => c.key === key)
                  return (
                    <TableCell key={key} align={col?.align}>
                      {renderPlateCell(key, p)}
                    </TableCell>
                  )
                })}
                {(canEdit || canDelete) && (
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      {canEdit && (
                        <>
                          <Button size="small" onClick={() => openEdit(p)}>
                            Düzenle
                          </Button>
                          <Button
                            size="small"
                            onClick={() => {
                              setImageDialogPlate(p)
                              setImageDialogFile(null)
                            }}
                          >
                            Görsel
                          </Button>
                          {p.status === 'Satildi' && (
                            <Button size="small" onClick={() => setSaleInfoPlate(p)}>
                              Satış Bilgilerini Göster
                            </Button>
                          )}
                          {p.status === 'Aktif' && (
                            <>
                              <Button size="small" onClick={() => reserveMutation.mutate(p.id)}>
                                Rezerve Et
                              </Button>
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => {
                                  setSaleDialogPlate(p)
                                  setSaleAmount('')
                                  setSaleCurrency(p.saleCurrency)
                                }}
                              >
                                Satıldı
                              </Button>
                            </>
                          )}
                          {p.status === 'Rezerve' && (
                            <>
                              <Button size="small" onClick={() => unreserveMutation.mutate(p.id)}>
                                Rezerveden Çıkar
                              </Button>
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => {
                                  setSaleDialogPlate(p)
                                  setSaleAmount('')
                                  setSaleCurrency(p.saleCurrency)
                                }}
                              >
                                Satıldı
                              </Button>
                            </>
                          )}
                        </>
                      )}
                      {canDelete && p.status !== 'Satildi' && (
                        <Button
                          size="small"
                          color="error"
                          onClick={() => {
                            setDeleteTarget(p)
                            setDeleteError(null)
                          }}
                        >
                          Sil
                        </Button>
                      )}
                    </Stack>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filteredPlates.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
            Aramanızla eşleşen plaka bulunamadı.
          </Typography>
        )}
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Yeni Plaka</DialogTitle>
        <DialogContent>
          <Alert severity="info" variant="outlined" sx={{ mt: 0.5, mb: 2.5 }}>
            Plaka No, taş seçildikten sonra sıradaki numaraya göre otomatik atanacak.
          </Alert>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 'auto' }} sx={{ display: 'flex', justifyContent: { xs: 'center', sm: 'flex-start' } }}>
              <ImageDropzone file={createImage} onChange={setCreateImage} />
            </Grid>
            <Grid size={{ xs: 12, sm: 'grow' }}>
              <GroupLabel>Kaynak</GroupLabel>
              <Stack spacing={2} sx={{ mb: 2.5 }}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      select
                      label="Taş"
                      value={form.stoneId}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, stoneId: String(e.target.value), incomingStockId: '' }))
                      }
                      fullWidth
                    >
                      {stonesQuery.data?.map((s) => (
                        <MenuItem key={s.id} value={s.id}>
                          {s.name} ({s.code})
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      select
                      label="Gelen Parti/Lot"
                      value={form.incomingStockId}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, incomingStockId: String(e.target.value), bundleNumber: '' }))
                      }
                      fullWidth
                      disabled={!form.stoneId}
                    >
                      {batchesForStone.map((b) => (
                        <MenuItem key={b.id} value={b.id}>
                          {b.batchCode} — {b.arrivalDate}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                </Grid>
                <Grid container spacing={2}>
                  {selectedBatch && selectedBatch.bundleCount > 0 && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        select
                        label="Bundle Seçimi"
                        value={form.bundleNumber}
                        onChange={(e) => setForm((prev) => ({ ...prev, bundleNumber: e.target.value }))}
                        fullWidth
                        required
                      >
                        {createBundleLabels.map((label, index) => (
                          <MenuItem key={index + 1} value={index + 1}>
                            {label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                  )}
                  <Grid size={{ xs: 12, sm: selectedBatch && selectedBatch.bundleCount > 0 ? 6 : 12 }}>
                    <WarehouseField
                      value={form.warehouse}
                      onChange={(value) => setForm((prev) => ({ ...prev, warehouse: value }))}
                    />
                  </Grid>
                </Grid>
              </Stack>

              <GroupLabel>Ölçüler</GroupLabel>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Doku"
                    value={selectedBatch?.texture ?? ''}
                    helperText="Partiden otomatik gelir."
                    fullWidth
                    disabled
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Kalınlık (cm)"
                    value={selectedBatch?.thickness ?? ''}
                    helperText="Partiden otomatik gelir."
                    fullWidth
                    disabled
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField label="En (cm)" value={form.width} onChange={handleChange('width')} fullWidth />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField label="Boy (cm)" value={form.height} onChange={handleChange('height')} fullWidth />
                </Grid>
              </Grid>

              {error && (
                <Alert severity="error" sx={{ mt: 2.5 }}>
                  {error}
                </Alert>
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Vazgeç</Button>
          <Button
            variant="contained"
            disabled={
              createSubmitting || (!!selectedBatch && selectedBatch.bundleCount > 0 && !form.bundleNumber)
            }
            onClick={handleCreateSubmit}
          >
            Oluştur
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={bulkDialogOpen}
        onClose={() => (bulkSubmitting ? undefined : setBulkDialogOpen(false))}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Çoklu Plaka Ekle</DialogTitle>
        <DialogContent>
          <Alert severity="info" variant="outlined" sx={{ mt: 0.5, mb: 2.5 }}>
            Plaka No'ları, taş seçildikten sonra sıradaki numaradan başlayarak sırasıyla atanacak. Görsel
            seçilirse oluşturulan tüm plakalara eklenir; sonradan bir plakanın görselini değiştirmek
            diğerlerini etkilemez.
          </Alert>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 'auto' }} sx={{ display: 'flex', justifyContent: { xs: 'center', sm: 'flex-start' } }}>
              <ImageDropzone file={bulkImage} onChange={setBulkImage} />
            </Grid>
            <Grid size={{ xs: 12, sm: 'grow' }}>
              <GroupLabel>Kaynak</GroupLabel>
              <Stack spacing={2} sx={{ mb: 2.5 }}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      select
                      label="Taş"
                      value={bulkForm.stoneId}
                      onChange={(e) =>
                        setBulkForm((prev) => ({ ...prev, stoneId: String(e.target.value), incomingStockId: '' }))
                      }
                      fullWidth
                      disabled={bulkSubmitting}
                    >
                      {stonesQuery.data?.map((s) => (
                        <MenuItem key={s.id} value={s.id}>
                          {s.name} ({s.code})
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      select
                      label="Gelen Parti/Lot"
                      value={bulkForm.incomingStockId}
                      onChange={(e) =>
                        setBulkForm((prev) => ({ ...prev, incomingStockId: String(e.target.value), bundleNumber: '' }))
                      }
                      fullWidth
                      disabled={!bulkForm.stoneId || bulkSubmitting}
                    >
                      {bulkBatchesForStone.map((b) => (
                        <MenuItem key={b.id} value={b.id}>
                          {b.batchCode} — {b.arrivalDate}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                </Grid>
                <Grid container spacing={2}>
                  {bulkSelectedBatch && bulkSelectedBatch.bundleCount > 0 && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        select
                        label="Bundle Seçimi"
                        value={bulkForm.bundleNumber}
                        onChange={(e) => setBulkForm((prev) => ({ ...prev, bundleNumber: e.target.value }))}
                        fullWidth
                        required
                        disabled={bulkSubmitting}
                      >
                        {bulkBundleLabels.map((label, index) => (
                          <MenuItem key={index + 1} value={index + 1}>
                            {label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                  )}
                  <Grid size={{ xs: 12, sm: bulkSelectedBatch && bulkSelectedBatch.bundleCount > 0 ? 6 : 12 }}>
                    <TextField
                      label="Plaka Sayısı"
                      value={bulkForm.plateCount}
                      onChange={handleBulkChange('plateCount')}
                      helperText="Bu bilgilerle kaç plaka oluşturulacağını belirtir."
                      fullWidth
                      disabled={bulkSubmitting}
                    />
                  </Grid>
                </Grid>
                <Grid container spacing={2}>
                  <Grid size={12}>
                    <WarehouseField
                      value={bulkForm.warehouse}
                      onChange={(value) => setBulkForm((prev) => ({ ...prev, warehouse: value }))}
                    />
                  </Grid>
                </Grid>
              </Stack>

              <GroupLabel>Ölçüler</GroupLabel>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Doku"
                    value={bulkSelectedBatch?.texture ?? ''}
                    helperText="Partiden otomatik gelir."
                    fullWidth
                    disabled
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Kalınlık (cm)"
                    value={bulkSelectedBatch?.thickness ?? ''}
                    helperText="Partiden otomatik gelir."
                    fullWidth
                    disabled
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="En (cm)"
                    value={bulkForm.width}
                    onChange={handleBulkChange('width')}
                    fullWidth
                    disabled={bulkSubmitting}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Boy (cm)"
                    value={bulkForm.height}
                    onChange={handleBulkChange('height')}
                    fullWidth
                    disabled={bulkSubmitting}
                  />
                </Grid>
              </Grid>

              {bulkProgress && (
                <Alert severity="info" sx={{ mt: 2.5 }}>
                  {bulkProgress.done} / {bulkProgress.total} plaka oluşturuldu…
                </Alert>
              )}
              {bulkError && (
                <Alert severity="error" sx={{ mt: 2.5 }}>
                  {bulkError}
                </Alert>
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDialogOpen(false)} disabled={bulkSubmitting}>
            Vazgeç
          </Button>
          <Button
            variant="contained"
            disabled={
              bulkSubmitting ||
              !bulkForm.stoneId ||
              !bulkForm.incomingStockId ||
              (Number(bulkForm.plateCount) || 0) < 1 ||
              (!!bulkSelectedBatch && bulkSelectedBatch.bundleCount > 0 && !bulkForm.bundleNumber)
            }
            onClick={handleBulkSubmit}
          >
            Oluştur
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!editingPlate} onClose={() => setEditingPlate(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Plakayı Düzenle</DialogTitle>
        <DialogContent>
          {editForm && (
            <Stack sx={{ mt: 0.5 }}>
              <GroupLabel>Kaynak</GroupLabel>
              <Grid container spacing={2} sx={{ mb: 2.5 }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField label="Taş" value={editingPlate?.stoneName ?? ''} fullWidth disabled />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField label="Parti/Lot Kodu" value={editingPlate?.batchCode ?? ''} fullWidth disabled />
                </Grid>
                <Grid size={{ xs: 12, sm: editBatch && editBatch.bundleCount > 0 ? 6 : 12 }}>
                  <TextField label="Plaka No" value={editForm.plateNo} onChange={handleEditChange('plateNo')} fullWidth />
                </Grid>
                {editBatch && editBatch.bundleCount > 0 && (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      select
                      label="Bundle Seçimi"
                      value={editForm.bundleNumber}
                      onChange={handleEditChange('bundleNumber')}
                      fullWidth
                      required
                    >
                      {editBundleLabels.map((label, index) => (
                        <MenuItem key={index + 1} value={index + 1}>
                          {label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                )}
                <Grid size={12}>
                  <WarehouseField
                    value={editForm.warehouse}
                    onChange={(value) => setEditForm((prev) => (prev ? { ...prev, warehouse: value } : prev))}
                  />
                </Grid>
              </Grid>

              <GroupLabel>Ölçüler</GroupLabel>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Doku"
                    value={editingPlate?.texture ?? ''}
                    helperText="Partiden otomatik gelir."
                    fullWidth
                    disabled
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Kalınlık (cm)"
                    value={editingPlate?.thickness ?? ''}
                    helperText="Partiden otomatik gelir."
                    fullWidth
                    disabled
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField label="En (cm)" value={editForm.width} onChange={handleEditChange('width')} fullWidth />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField label="Boy (cm)" value={editForm.height} onChange={handleEditChange('height')} fullWidth />
                </Grid>
              </Grid>

              {editError && (
                <Alert severity="error" sx={{ mt: 2.5 }}>
                  {editError}
                </Alert>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingPlate(null)}>Vazgeç</Button>
          <Button
            variant="contained"
            disabled={
              editSubmitting ||
              !editForm ||
              (!!editBatch && editBatch.bundleCount > 0 && !editForm.bundleNumber)
            }
            onClick={handleEditSubmit}
          >
            Kaydet
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!saleDialogPlate} onClose={() => setSaleDialogPlate(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Plakayı Satıldı Olarak İşaretle</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {saleDialogPlate?.plateNo}
          </Typography>
          <Stack spacing={2}>
            <TextField
              label="Satış Tutarı (opsiyonel)"
              value={saleAmount}
              onChange={(e) => setSaleAmount(sanitizeTwoDecimals(e.target.value))}
              onBlur={() => setSaleAmount((prev) => (prev === '' ? prev : (Number(prev) || 0).toFixed(2)))}
              helperText="Bu plakanın gerçekte satıldığı tutar. Boş bırakılabilir."
              fullWidth
              autoFocus
            />
            <TextField
              select
              label="Satış Para Birimi"
              value={saleCurrency}
              onChange={(e) => setSaleCurrency(e.target.value)}
              fullWidth
            >
              {CURRENCIES.map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaleDialogPlate(null)}>Vazgeç</Button>
          <Button
            variant="contained"
            disabled={sellMutation.isPending}
            onClick={() =>
              saleDialogPlate &&
              sellMutation.mutate({
                id: saleDialogPlate.id,
                amount: saleAmount === '' ? null : Number(saleAmount),
                currency: saleCurrency,
              })
            }
          >
            Onayla
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!saleInfoPlate} onClose={() => setSaleInfoPlate(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Satış Bilgileri</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {saleInfoPlate?.plateNo}
            </Typography>
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                Satış Tutarı
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {saleInfoPlate?.saleAmount != null
                  ? `${saleInfoPlate.saleAmount.toLocaleString('tr-TR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })} ${saleInfoPlate.saleAmountCurrency ?? saleInfoPlate.saleCurrency}`
                  : '—'}
              </Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                Satış Tarihi
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {saleInfoPlate?.soldAt ? new Date(saleInfoPlate.soldAt).toLocaleString('tr-TR') : '—'}
              </Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                Satan Kullanıcı
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {saleInfoPlate?.soldByUserName ?? '—'}
              </Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaleInfoPlate(null)}>Kapat</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!imageDialogPlate} onClose={() => setImageDialogPlate(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Plaka Görseli</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {imageDialogPlate?.plateNo}
          </Typography>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <ImageThumbnail
              src={imageDialogFile ? URL.createObjectURL(imageDialogFile) : imageDialogPlate?.imageUrl}
              alt="Önizleme"
              size={72}
            />
            <Button variant="outlined" size="small" onClick={() => imageDialogInputRef.current?.click()}>
              Görsel Seç
            </Button>
            <input
              ref={imageDialogInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => setImageDialogFile(e.target.files?.[0] ?? null)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImageDialogPlate(null)}>Vazgeç</Button>
          <Button
            variant="contained"
            disabled={!imageDialogFile || uploadImageMutation.isPending}
            onClick={handleImageDialogSave}
          >
            Kaydet
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Plakayı Sil</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            <strong>{deleteTarget?.plateNo}</strong> kalıcı olarak silinecek. Bu işlem geri alınamaz.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Satılmış plakalar silinemez; satış geçmişi korunur.
          </Typography>
          {deleteError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {deleteError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Vazgeç</Button>
          <Button
            variant="contained"
            color="error"
            disabled={deleteMutation.isPending}
            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
          >
            Sil
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={plateInfoDialogOpen} onClose={() => setPlateInfoDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Plaka Bilgisi Gönder</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Seçili {plateInfoItems.length} plakanın önizlemesi aşağıdadır. Dışa aktarma formatını seçin.
          </Typography>
          <Box
            ref={plateInfoContainerRef}
            sx={{ bgcolor: 'background.paper' }}
          >
            {plateInfoItems.map((item) => (
              <PlateInfoCard
                key={item.plateId}
                item={item}
                cardRef={(el) => {
                  plateInfoCardRefs.current[item.plateId] = el
                }}
              />
            ))}
          </Box>
          {plateInfoExportError && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {plateInfoExportError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPlateInfoDialogOpen(false)}>Kapat</Button>
          <Button
            startIcon={<WhatsAppIcon />}
            color="success"
            disabled={!!plateInfoExporting}
            onClick={handleShareWhatsAppPlateInfo}
          >
            {plateInfoExporting === 'whatsapp' ? 'Hazırlanıyor…' : "WhatsApp'ta Gönder"}
          </Button>
          <Button disabled={!!plateInfoExporting} onClick={handleExportPlateInfoJpeg}>
            {plateInfoExporting === 'jpeg' ? 'Hazırlanıyor…' : 'JPEG İndir'}
          </Button>
          <Button variant="contained" disabled={!!plateInfoExporting} onClick={handleExportPlateInfoPdf}>
            {plateInfoExporting === 'pdf' ? 'Hazırlanıyor…' : 'PDF İndir'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={offerDialogOpen} onClose={closeOfferDialog} maxWidth="md" fullWidth>
        <DialogTitle>Teklif Gönder</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5, mb: 3 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Firma"
                value={offerCompany}
                onChange={(e) => setOfferCompany(e.target.value)}
                fullWidth
                autoFocus
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Firma Adresi"
                value={offerCompanyAddress}
                onChange={(e) => setOfferCompanyAddress(e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Teklif Tarihi"
                type="date"
                value={offerDate}
                onChange={(e) => setOfferDate(e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                select
                label="Para Birimi"
                value={offerCurrency}
                onChange={(e) => setOfferCurrency(e.target.value)}
                fullWidth
              >
                {CURRENCIES.map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Teklif Geçerlilik Süresi (gün)"
                value={offerValidityDays}
                onChange={(e) => setOfferValidityDays(e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Satış Dolar Kuru"
                value={
                  offerUsdRateOverrideEnabled
                    ? offerUsdRateOverride
                    : (offerFetchedUsdRate?.toLocaleString('tr-TR', { maximumFractionDigits: 4 }) ?? '')
                }
                onChange={(e) => setOfferUsdRateOverride(e.target.value)}
                disabled={!offerUsdRateOverrideEnabled}
                fullWidth
                placeholder={offerRatesQuery.isFetching ? 'Kur alınıyor…' : undefined}
                helperText={
                  offerRatesQuery.data?.date
                    ? `TCMB, ${offerRatesQuery.data.date} tarihli kur (1 USD → TRY)`
                    : !offerRatesQuery.isFetching
                      ? 'Kur alınamadı; elle girebilirsiniz.'
                      : undefined
                }
                slotProps={{ input: { endAdornment: <InputAdornment position="end">TRY</InputAdornment> } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }} sx={{ display: 'flex', alignItems: 'center' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={offerUsdRateOverrideEnabled}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setOfferUsdRateOverrideEnabled(checked)
                      if (checked) {
                        setOfferUsdRateOverride(offerFetchedUsdRate != null ? String(offerFetchedUsdRate) : '')
                      }
                    }}
                  />
                }
                label="Kuru Değiştir"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                select
                label="KDV Dahil mi?"
                value={offerVatIncluded}
                onChange={(e) => setOfferVatIncluded(e.target.value as 'Dahil' | 'Haric')}
                fullWidth
              >
                <MenuItem value="Dahil">KDV Dahil</MenuItem>
                <MenuItem value="Haric">KDV Hariç</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                select
                label="Nakliye"
                value={offerShippingIncluded}
                onChange={(e) => setOfferShippingIncluded(e.target.value as 'Dahil' | 'Haric')}
                fullWidth
              >
                <MenuItem value="Dahil">Nakliye Dahil</MenuItem>
                <MenuItem value="Haric">Nakliye Hariç</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Teslim Şekli"
                value={offerDeliveryMethod}
                onChange={(e) => setOfferDeliveryMethod(e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={12}>
              <TextField
                label="Teslimat Adresi"
                value={offerDeliveryAddress}
                onChange={(e) => setOfferDeliveryAddress(e.target.value)}
                fullWidth
                multiline
                minRows={2}
              />
            </Grid>
          </Grid>

          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            Plaka Fiyatlandırma
          </Typography>
          <Box sx={{ overflowX: 'auto', mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Taş Adı</TableCell>
                  <TableCell align="right">En x Boy (cm)</TableCell>
                  <TableCell align="right">Kalınlık (cm)</TableCell>
                  <TableCell>Doku</TableCell>
                  <TableCell align="right">Adet</TableCell>
                  <TableCell align="right">Alan (m²)</TableCell>
                  <TableCell align="right">Satış m² Birim Fiyatı</TableCell>
                  <TableCell align="right">Tutar</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {offerLines.map((line) => {
                  const rep = line.plates[0]
                  const priceValue = getLineUnitPrice(line)
                  return (
                    <TableRow key={line.key}>
                      <TableCell>{rep.stoneName}</TableCell>
                      <TableCell align="right">
                        {metersToCm(rep.width).toLocaleString('tr-TR')} x {metersToCm(rep.height).toLocaleString('tr-TR')}
                      </TableCell>
                      <TableCell align="right">{rep.thickness.toLocaleString('tr-TR')}</TableCell>
                      <TableCell>{rep.texture}</TableCell>
                      <TableCell align="right">{line.quantity}</TableCell>
                      <TableCell align="right">{rep.area.toLocaleString('tr-TR')}</TableCell>
                      <TableCell align="right">
                        <TextField
                          size="small"
                          value={priceValue}
                          onChange={(e) =>
                            setOfferUnitPrices((prev) => ({
                              ...prev,
                              [line.key]: sanitizeTwoDecimals(e.target.value),
                            }))
                          }
                          sx={{ width: 110 }}
                          slotProps={{ input: { endAdornment: <InputAdornment position="end">{offerCurrency}</InputAdornment> } }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        {((Number(priceValue) || 0) * rep.area * line.quantity).toLocaleString('tr-TR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        {offerCurrency}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Box>

          <Divider sx={{ mb: 3 }} />

          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            Teklif Önizlemesi
          </Typography>
          <OfferPreviewDocument
            containerRef={(el) => {
              offerContainerRef.current = el
            }}
            companyName={offerCompany}
            companyAddress={offerCompanyAddress}
            offerDate={offerDate}
            currency={offerCurrency}
            vatIncluded={offerVatIncluded === 'Dahil'}
            validityDays={offerValidityDays}
            deliveryMethod={offerDeliveryMethod}
            deliveryAddress={offerDeliveryAddress}
            shippingIncluded={offerShippingIncluded === 'Dahil'}
            usdRate={offerEffectiveUsdRate}
            total={offerTotal}
            brandingCompanyName={offerBrandingQuery.data?.companyName}
            brandingLogoUrl={offerBrandingQuery.data?.logoUrl}
            items={offerLines.map((line) => {
              const rep = line.plates[0]
              return {
                stoneName: rep.stoneName,
                widthCm: metersToCm(rep.width),
                heightCm: metersToCm(rep.height),
                thicknessCm: rep.thickness,
                texture: rep.texture,
                areaM2: rep.area,
                unitPrice: Number(getLineUnitPrice(line)) || 0,
                quantity: line.quantity,
              }
            })}
          />

          <Divider sx={{ my: 3 }} />

          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            E-posta Gönderimi
          </Typography>
          <Grid container spacing={2} sx={{ mb: 1 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Alıcı E-posta Adresi"
                type="email"
                value={offerRecipientEmail}
                onChange={(e) => setOfferRecipientEmail(e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Bilgi E-posta"
                type="email"
                value={offerCcEmail}
                onChange={(e) => setOfferCcEmail(e.target.value)}
                fullWidth
                helperText="Birden fazla adres virgülle ayrılabilir."
              />
            </Grid>
            <Grid size={12}>
              <TextField
                label="Konu"
                value={offerEmailSubject}
                onChange={(e) => setOfferEmailSubject(e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={12}>
              <RichTextEditor label="Mesaj" value={offerEmailMessage} onChange={setOfferEmailMessage} />
            </Grid>
          </Grid>

          {offerSaveSuccess && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Teklif taslak olarak kaydedildi. "Satış Yönetimi &gt; Teklifler" sayfasından görüntüleyebilirsiniz.
            </Alert>
          )}
          {offerEmailSuccess && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Teklif e-postası gönderildi ve tekliflere kaydedildi.
            </Alert>
          )}
          {offerExportError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {offerExportError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeOfferDialog}>Kapat</Button>
          <Button disabled={offerExporting} onClick={handleExportOfferPdf}>
            {offerExporting ? 'Hazırlanıyor…' : 'PDF İndir'}
          </Button>
          <Button
            disabled={sendOfferEmailMutation.isPending || !offerRecipientEmail.trim() || selectedPlates.length === 0}
            onClick={handleSendOfferEmail}
          >
            {sendOfferEmailMutation.isPending ? 'Gönderiliyor…' : 'Teklifi E-posta Olarak Gönder'}
          </Button>
          <Button
            variant="contained"
            disabled={saveOfferMutation.isPending || !offerCompany || selectedPlates.length === 0}
            onClick={handleSaveOffer}
          >
            {saveOfferMutation.isPending ? 'Kaydediliyor…' : 'Teklifi Taslak Olarak Kaydet'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={offerDialogOpen && !!pendingMergeGroup} maxWidth="xs" fullWidth>
        <DialogTitle>Aynı Ürün, Farklı Parti/Lot</DialogTitle>
        <DialogContent>
          {pendingMergeGroup && (
            <>
              <Typography variant="body2" sx={{ mb: 2 }}>
                <strong>{pendingMergeGroup.plates[0].stoneName}</strong> —{' '}
                {metersToCm(pendingMergeGroup.plates[0].width).toLocaleString('tr-TR')} x{' '}
                {metersToCm(pendingMergeGroup.plates[0].height).toLocaleString('tr-TR')} cm,{' '}
                {pendingMergeGroup.plates[0].thickness.toLocaleString('tr-TR')} cm kalınlık için{' '}
                {pendingMergeGroup.plates.length} adet aynı ölçüde plaka seçildi. Parti/Lot Kodları:{' '}
                {Array.from(new Set(pendingMergeGroup.plates.map((p) => p.batchCode || '—'))).join(', ')}
              </Typography>
              <Alert severity="warning" sx={{ mb: 2 }}>
                Farklı parti/lot ürünleri satış rakamları farklı olabilir.
              </Alert>
              <Typography variant="body2">Tek kalemde gösterilsin mi?</Typography>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() =>
              pendingMergeGroup &&
              setMergeDecisions((prev) => ({ ...prev, [pendingMergeGroup.key]: false }))
            }
          >
            Hayır
          </Button>
          <Button
            variant="contained"
            onClick={() =>
              pendingMergeGroup &&
              setMergeDecisions((prev) => ({ ...prev, [pendingMergeGroup.key]: true }))
            }
          >
            Evet
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
