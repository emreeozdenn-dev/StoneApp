import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
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
import {
  CURRENCIES,
  SUPPLY_TYPES,
  SUPPLY_TYPE_LABELS,
  createIncomingStock,
  deleteIncomingStock,
  fetchIncomingStocks,
  updateIncomingStock,
  type IncomingStock,
} from '../../api/catalog'
import { fetchStones } from '../../api/catalog'
import { fetchExchangeRates, fetchHistoricalExchangeRates, type ExchangeRates } from '../../api/exchangeRates'
import { hasPermission, useCurrentUser } from '../../auth/useCurrentUser'
import { ColumnSettingsButton } from '../../components/common/ColumnSettingsButton'
import { TextureField } from '../../components/common/TextureField'
import { type ColumnDef, useColumnPreferences } from '../../components/common/useColumnPreferences'
import { useDraggableColumns } from '../../components/common/useDraggableColumns'
import { WarehouseField } from '../../components/common/WarehouseField'
import { buildBundleLabels } from '../../utils/bundles'

type IncomingStockColumnKey =
  | 'batchCode'
  | 'stoneName'
  | 'arrivalDate'
  | 'supplyType'
  | 'supplier'
  | 'plateCount'
  | 'totalArea'
  | 'saleCost'
  | 'unitCost'
  | 'totalAdditionalCost'

const initialForm = {
  stoneId: '',
  arrivalDate: new Date().toISOString().slice(0, 10),
  supplyType: 'Ocak',
  supplier: '',
  bundleCount: '',
  thickness: '',
  texture: 'Cilalı',
  warehouse: '',
  unitCost: '',
  costCurrency: 'USD',
  description: '',
  customsCost: '',
  shippingCost: '',
  otherCost: '',
}

interface EditForm {
  arrivalDate: string
  supplyType: string
  supplier: string
  bundleCount: string
  thickness: string
  texture: string
  warehouse: string
  unitCost: string
  costCurrency: string
  description: string
  customsCost: string
  shippingCost: string
  otherCost: string
}

function totalAdditionalCost(customs: string, shipping: string, other: string) {
  return (Number(customs) || 0) + (Number(shipping) || 0) + (Number(other) || 0)
}

function unitSaleCostInCostCurrency(
  unitCost: string,
  customs: string,
  shipping: string,
  other: string,
  totalArea: number,
) {
  const additionalPerArea = totalArea > 0 ? totalAdditionalCost(customs, shipping, other) / totalArea : 0
  return (Number(unitCost) || 0) + additionalPerArea
}

function getRateForCurrency(currency: string, rates: ExchangeRates | null | undefined): number | null {
  if (!rates) return null
  if (currency === 'USD') return rates.usdTry ?? null
  if (currency === 'EUR') return rates.eurTry ?? null
  return null
}

function toTryAmount(
  amount: number,
  currency: string,
  rate: number | null,
): { value: number; converted: boolean } {
  if (currency === 'TRY') return { value: amount, converted: true }
  if (rate && rate > 0) return { value: amount * rate, converted: true }
  return { value: amount, converted: false }
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Grid size={12}>
      <Typography variant="overline" sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: 0.5 }}>
        {children}
      </Typography>
      <Divider sx={{ mb: 1 }} />
    </Grid>
  )
}

export function IncomingStockPage() {
  const { user } = useCurrentUser()
  const queryClient = useQueryClient()
  const rowsQuery = useQuery({ queryKey: ['incoming-stock'], queryFn: fetchIncomingStocks })
  const stonesQuery = useQuery({ queryKey: ['stones'], queryFn: fetchStones })
  const ratesQuery = useQuery({ queryKey: ['exchange-rates'], queryFn: fetchExchangeRates })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState<string | null>(null)

  const [editingRow, setEditingRow] = useState<IncomingStock | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [editError, setEditError] = useState<string | null>(null)

  const [createRateOverrideEnabled, setCreateRateOverrideEnabled] = useState(false)
  const [createRateOverride, setCreateRateOverride] = useState('')
  const [editRateOverrideEnabled, setEditRateOverrideEnabled] = useState(false)
  const [editRateOverride, setEditRateOverride] = useState('')

  const canCreate = hasPermission(user?.permissions, 'incomingstock.create')
  const canEdit = hasPermission(user?.permissions, 'incomingstock.edit')
  const canDelete = hasPermission(user?.permissions, 'incomingstock.delete')
  const canSeeCost =
    hasPermission(user?.permissions, 'cost.unit.view') &&
    hasPermission(user?.permissions, 'cost.currency.view')

  const incomingStockColumns = useMemo<ColumnDef<IncomingStockColumnKey>[]>(() => {
    const cols: ColumnDef<IncomingStockColumnKey>[] = [
      { key: 'batchCode', label: 'Parti/Lot Kodu' },
      { key: 'stoneName', label: 'Taş' },
      { key: 'arrivalDate', label: 'Geliş Tarihi' },
      { key: 'supplyType', label: 'Tedarik Türü' },
      { key: 'supplier', label: 'Tedarikçi' },
      { key: 'plateCount', label: 'Plaka Sayısı', align: 'right' },
      { key: 'totalArea', label: 'Toplam Alan (m²)', align: 'right' },
      { key: 'saleCost', label: 'Satış Maliyeti', align: 'right' },
    ]
    if (canSeeCost) {
      cols.push({ key: 'unitCost', label: 'Birim Maliyet', align: 'right' })
      cols.push({ key: 'totalAdditionalCost', label: 'Toplam Ek Maliyet', align: 'right' })
    }
    return cols
  }, [canSeeCost])

  const incomingStockColumnPrefs = useColumnPreferences('incoming-stock', incomingStockColumns)
  const incomingStockDraggableColumns = useDraggableColumns(incomingStockColumnPrefs.reorderTo)

  function renderIncomingStockCell(key: IncomingStockColumnKey, r: IncomingStock) {
    switch (key) {
      case 'batchCode':
        return r.batchCode
      case 'stoneName':
        return r.stoneName
      case 'arrivalDate':
        return r.arrivalDate
      case 'supplyType':
        return SUPPLY_TYPE_LABELS[r.supplyType] ?? r.supplyType
      case 'supplier':
        return r.supplier
      case 'plateCount':
        return r.plateCountAdded
      case 'totalArea':
        return r.totalArea.toLocaleString('tr-TR')
      case 'saleCost':
        return r.saleCost != null ? `${r.saleCost.toLocaleString('tr-TR')} ${r.saleCurrency}` : '—'
      case 'unitCost':
        return `${r.unitCost?.toLocaleString('tr-TR')} ${r.costCurrency}`
      case 'totalAdditionalCost':
        return `${r.totalAdditionalCost?.toLocaleString('tr-TR') ?? '0'} ${r.costCurrency}`
      default:
        return null
    }
  }

  const createHistoricalRateQuery = useQuery({
    queryKey: ['exchange-rates-historical', form.arrivalDate],
    queryFn: () => fetchHistoricalExchangeRates(form.arrivalDate),
    enabled: canSeeCost && form.costCurrency !== 'TRY' && !!form.arrivalDate,
  })

  const editHistoricalRateQuery = useQuery({
    queryKey: ['exchange-rates-historical', editForm?.arrivalDate],
    queryFn: () => fetchHistoricalExchangeRates(editForm!.arrivalDate),
    enabled: canSeeCost && !!editForm && editForm.costCurrency !== 'TRY' && !!editForm.arrivalDate,
  })

  const createRawTotal = useMemo(
    () => unitSaleCostInCostCurrency(form.unitCost, form.customsCost, form.shippingCost, form.otherCost, 0),
    [form.unitCost, form.customsCost, form.shippingCost, form.otherCost],
  )

  const createFetchedArrivalRate = getRateForCurrency(form.costCurrency, createHistoricalRateQuery.data)
  const createEffectiveArrivalRate = createRateOverrideEnabled
    ? Number(createRateOverride) || null
    : createFetchedArrivalRate

  const createSaleCostLive = useMemo(
    () => toTryAmount(createRawTotal, form.costCurrency, getRateForCurrency(form.costCurrency, ratesQuery.data)),
    [createRawTotal, form.costCurrency, ratesQuery.data],
  )
  const createSaleCostArrival = useMemo(
    () => toTryAmount(createRawTotal, form.costCurrency, createEffectiveArrivalRate),
    [createRawTotal, form.costCurrency, createEffectiveArrivalRate],
  )

  const editRawTotal = useMemo(
    () =>
      editForm
        ? unitSaleCostInCostCurrency(
            editForm.unitCost,
            editForm.customsCost,
            editForm.shippingCost,
            editForm.otherCost,
            editingRow?.totalArea ?? 0,
          )
        : 0,
    [editForm, editingRow],
  )

  const editFetchedArrivalRate = getRateForCurrency(editForm?.costCurrency ?? 'TRY', editHistoricalRateQuery.data)
  const editEffectiveArrivalRate = editRateOverrideEnabled
    ? Number(editRateOverride) || null
    : editFetchedArrivalRate

  const editSaleCostLive = useMemo(
    () =>
      editForm
        ? toTryAmount(editRawTotal, editForm.costCurrency, getRateForCurrency(editForm.costCurrency, ratesQuery.data))
        : { value: 0, converted: true },
    [editRawTotal, editForm, ratesQuery.data],
  )
  const editSaleCostArrival = useMemo(
    () =>
      editForm ? toTryAmount(editRawTotal, editForm.costCurrency, editEffectiveArrivalRate) : { value: 0, converted: true },
    [editRawTotal, editForm, editEffectiveArrivalRate],
  )

  const createBundleLabels = useMemo(
    () => buildBundleLabels('Otomatik Kod', Number(form.bundleCount) || 0),
    [form.bundleCount],
  )

  const editBundleLabels = useMemo(
    () => (editForm && editingRow ? buildBundleLabels(editingRow.batchCode, Number(editForm.bundleCount) || 0) : []),
    [editForm, editingRow],
  )

  const [search, setSearch] = useState('')
  const [supplyTypeFilter, setSupplyTypeFilter] = useState('Tumu')
  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (rowsQuery.data ?? []).filter((r) => {
      if (supplyTypeFilter !== 'Tumu' && r.supplyType !== supplyTypeFilter) return false
      if (!term) return true
      return [r.batchCode, r.stoneName, r.supplier].some((field) => field.toLowerCase().includes(term))
    })
  }, [rowsQuery.data, search, supplyTypeFilter])

  const createMutation = useMutation({
    mutationFn: createIncomingStock,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incoming-stock'] })
      queryClient.invalidateQueries({ queryKey: ['stones'] })
      setDialogOpen(false)
      setForm(initialForm)
      setCreateRateOverrideEnabled(false)
      setCreateRateOverride('')
      setError(null)
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Kayıt oluşturulamadı.'
      setError(message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload, saleCost }: { id: number; payload: EditForm; saleCost: number }) =>
      updateIncomingStock(id, {
        arrivalDate: payload.arrivalDate,
        supplyType: payload.supplyType,
        supplier: payload.supplier,
        bundleCount: Number(payload.bundleCount) || 0,
        quantity: 0,
        thickness: Number(payload.thickness) || 0,
        texture: payload.texture,
        warehouse: payload.warehouse,
        unitCost: Number(payload.unitCost) || 0,
        costCurrency: payload.costCurrency,
        saleCurrency: payload.costCurrency,
        saleCost,
        description: payload.description === '' ? null : payload.description,
        customsCost: Number(payload.customsCost) || 0,
        shippingCost: Number(payload.shippingCost) || 0,
        otherCost: Number(payload.otherCost) || 0,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incoming-stock'] })
      setEditingRow(null)
      setEditForm(null)
      setEditError(null)
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Kayıt güncellenemedi.'
      setEditError(message)
    },
  })

  const [deleteTarget, setDeleteTarget] = useState<IncomingStock | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const deleteMutation = useMutation({
    mutationFn: deleteIncomingStock,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incoming-stock'] })
      setDeleteTarget(null)
      setDeleteError(null)
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Kayıt silinemedi.'
      setDeleteError(message)
    },
  })

  const handleChange = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const openEdit = (row: IncomingStock) => {
    setEditingRow(row)
    setEditForm({
      arrivalDate: row.arrivalDate,
      supplyType: row.supplyType,
      supplier: row.supplier,
      bundleCount: String(row.bundleCount ?? 0),
      thickness: String(row.thickness),
      texture: row.texture,
      warehouse: row.warehouse,
      unitCost: String(row.unitCost ?? 0),
      costCurrency: row.costCurrency ?? 'USD',
      description: row.description ?? '',
      customsCost: String(row.customsCost ?? 0),
      shippingCost: String(row.shippingCost ?? 0),
      otherCost: String(row.otherCost ?? 0),
    })
    setEditRateOverrideEnabled(false)
    setEditRateOverride('')
    setEditError(null)
  }

  const handleEditChange = (field: keyof EditForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditForm((prev) => (prev ? { ...prev, [field]: e.target.value } : prev))
  }

  const handleSubmit = () => {
    createMutation.mutate({
      stoneId: Number(form.stoneId),
      arrivalDate: form.arrivalDate,
      supplyType: form.supplyType,
      supplier: form.supplier,
      bundleCount: Number(form.bundleCount) || 0,
      quantity: 0,
      thickness: Number(form.thickness) || 0,
      texture: form.texture,
      warehouse: form.warehouse,
      unitCost: canSeeCost ? Number(form.unitCost) || 0 : 0,
      costCurrency: form.costCurrency,
      saleCurrency: form.costCurrency,
      saleCost: createRawTotal,
      description: form.description === '' ? null : form.description,
      customsCost: canSeeCost ? Number(form.customsCost) || 0 : 0,
      shippingCost: canSeeCost ? Number(form.shippingCost) || 0 : 0,
      otherCost: canSeeCost ? Number(form.otherCost) || 0 : 0,
    })
  }

  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Gelen Parti/Lot
        </Typography>
        {canCreate && (
          <Button variant="contained" onClick={() => setDialogOpen(true)}>
            Gelen Parti/Lot Ekle
          </Button>
        )}
      </Stack>

      <Stack direction="row" spacing={2} sx={{ mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Parti kodu, taş veya tedarikçi ara…"
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
          label="Tedarik Türü"
          value={supplyTypeFilter}
          onChange={(e) => setSupplyTypeFilter(e.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="Tumu">Tümü</MenuItem>
          {SUPPLY_TYPES.map((t) => (
            <MenuItem key={t} value={t}>
              {SUPPLY_TYPE_LABELS[t]}
            </MenuItem>
          ))}
        </TextField>
        <ColumnSettingsButton columns={incomingStockColumns} prefs={incomingStockColumnPrefs} />
      </Stack>

      <Box sx={{ overflowX: 'auto' }}>
        <Table sx={{ minWidth: 1080 }}>
          <TableHead>
            <TableRow>
              {incomingStockColumnPrefs.visibleOrderedKeys.map((key) => {
                const col = incomingStockColumns.find((c) => c.key === key)
                return (
                  <TableCell key={key} align={col?.align} {...incomingStockDraggableColumns.getHeaderCellProps(key)}>
                    {col?.label}
                  </TableCell>
                )
              })}
              {(canEdit || canDelete) && <TableCell>İşlem</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredRows.map((r) => (
              <TableRow key={r.id}>
                {incomingStockColumnPrefs.visibleOrderedKeys.map((key) => {
                  const col = incomingStockColumns.find((c) => c.key === key)
                  return (
                    <TableCell key={key} align={col?.align}>
                      {renderIncomingStockCell(key, r)}
                    </TableCell>
                  )
                })}
                {(canEdit || canDelete) && (
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      {canEdit && (
                        <Button size="small" onClick={() => openEdit(r)}>
                          Düzenle
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          size="small"
                          color="error"
                          onClick={() => {
                            setDeleteTarget(r)
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
        {filteredRows.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
            Aramanızla eşleşen kayıt bulunamadı.
          </Typography>
        )}
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Yeni Gelen Parti/Lot</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <SectionTitle>1. Parti/Lot Bilgileri</SectionTitle>
            <Grid size={12}>
              <Alert severity="info" variant="outlined">
                Parti/Lot Kodu, sıradaki numaraya göre otomatik atanacak (örn. PB-{new Date().getFullYear()}-001).
              </Alert>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                select
                label="Taş"
                value={form.stoneId}
                onChange={(e) => setForm((prev) => ({ ...prev, stoneId: e.target.value }))}
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
                label="Geliş Tarihi"
                type="date"
                value={form.arrivalDate}
                onChange={handleChange('arrivalDate')}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                select
                label="Tedarik Türü"
                value={form.supplyType}
                onChange={(e) => setForm((prev) => ({ ...prev, supplyType: e.target.value }))}
                fullWidth
              >
                {SUPPLY_TYPES.map((t) => (
                  <MenuItem key={t} value={t}>
                    {SUPPLY_TYPE_LABELS[t]}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Tedarikçi" value={form.supplier} onChange={handleChange('supplier')} fullWidth />
            </Grid>

            <SectionTitle>2. Ürün/Stok Bilgileri</SectionTitle>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Gelen Bundle Sayısı"
                value={form.bundleCount}
                onChange={handleChange('bundleCount')}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Kalınlık (cm)" value={form.thickness} onChange={handleChange('thickness')} fullWidth />
            </Grid>
            {createBundleLabels.length > 0 && (
              <Grid size={12}>
                <TextField
                  label="Bundle Kodları"
                  value={createBundleLabels.join('\n')}
                  fullWidth
                  disabled
                  multiline
                  minRows={Math.min(createBundleLabels.length, 6)}
                  helperText="Parti/Lot Kodu kayıt oluşturulduktan sonra kesinleşir; buradaki kod geçicidir."
                />
              </Grid>
            )}
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextureField
                value={form.texture}
                onChange={(value) => setForm((prev) => ({ ...prev, texture: value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <WarehouseField
                value={form.warehouse}
                onChange={(value) => setForm((prev) => ({ ...prev, warehouse: value }))}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                label="Açıklama"
                value={form.description}
                onChange={handleChange('description')}
                multiline
                minRows={2}
                fullWidth
              />
            </Grid>

            {canSeeCost && (
              <>
                <SectionTitle>3. Maliyet Bilgileri</SectionTitle>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Birim Maliyet (m²)"
                    value={form.unitCost}
                    onChange={handleChange('unitCost')}
                    fullWidth
                    slotProps={{
                      input: {
                        endAdornment: <InputAdornment position="end">{form.costCurrency}</InputAdornment>,
                      },
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    select
                    label="Maliyet Para Birimi"
                    value={form.costCurrency}
                    onChange={(e) => setForm((prev) => ({ ...prev, costCurrency: e.target.value }))}
                    fullWidth
                  >
                    {CURRENCIES.map((c) => (
                      <MenuItem key={c} value={c}>
                        {c}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Gümrük Maliyeti"
                    value={form.customsCost}
                    onChange={handleChange('customsCost')}
                    fullWidth
                    slotProps={{
                      input: { endAdornment: <InputAdornment position="end">{form.costCurrency}</InputAdornment> },
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Nakliye Maliyeti"
                    value={form.shippingCost}
                    onChange={handleChange('shippingCost')}
                    fullWidth
                    slotProps={{
                      input: { endAdornment: <InputAdornment position="end">{form.costCurrency}</InputAdornment> },
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Diğer Maliyet"
                    value={form.otherCost}
                    onChange={handleChange('otherCost')}
                    fullWidth
                    slotProps={{
                      input: { endAdornment: <InputAdornment position="end">{form.costCurrency}</InputAdornment> },
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Toplam Ek Maliyet"
                    value={totalAdditionalCost(form.customsCost, form.shippingCost, form.otherCost).toLocaleString(
                      'tr-TR',
                    )}
                    fullWidth
                    disabled
                    slotProps={{
                      input: { endAdornment: <InputAdornment position="end">{form.costCurrency}</InputAdornment> },
                    }}
                  />
                </Grid>

                {form.costCurrency !== 'TRY' && (
                  <>
                    <SectionTitle>4. Kur Bilgileri</SectionTitle>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label="Geliş Tarihi Kur Bilgisi"
                        value={
                          createRateOverrideEnabled
                            ? createRateOverride
                            : (createFetchedArrivalRate?.toLocaleString('tr-TR', { maximumFractionDigits: 4 }) ?? '')
                        }
                        onChange={(e) => setCreateRateOverride(e.target.value)}
                        disabled={!createRateOverrideEnabled}
                        fullWidth
                        placeholder={createHistoricalRateQuery.isFetching ? 'Kur alınıyor…' : undefined}
                        helperText={
                          createHistoricalRateQuery.data?.date
                            ? `TCMB, ${createHistoricalRateQuery.data.date} tarihli kur (1 ${form.costCurrency} → TRY)`
                            : !createHistoricalRateQuery.isFetching
                              ? 'Kur alınamadı; elle girebilirsiniz.'
                              : undefined
                        }
                        slotProps={{
                          input: { endAdornment: <InputAdornment position="end">TRY</InputAdornment> },
                        }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }} sx={{ display: 'flex', alignItems: 'center' }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={createRateOverrideEnabled}
                            onChange={(e) => {
                              const checked = e.target.checked
                              setCreateRateOverrideEnabled(checked)
                              if (checked) {
                                setCreateRateOverride(
                                  createFetchedArrivalRate != null ? String(createFetchedArrivalRate) : '',
                                )
                              }
                            }}
                          />
                        }
                        label="Kuru Değiştir"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label="Güncel Kur (TCMB)"
                        value={
                          getRateForCurrency(form.costCurrency, ratesQuery.data)?.toLocaleString('tr-TR', {
                            maximumFractionDigits: 4,
                          }) ?? ''
                        }
                        fullWidth
                        disabled
                        helperText={
                          ratesQuery.data?.date
                            ? `TCMB, ${ratesQuery.data.date} tarihli güncel kur (1 ${form.costCurrency} → TRY)`
                            : 'Güncel kur alınamadı.'
                        }
                        slotProps={{
                          input: { endAdornment: <InputAdornment position="end">TRY</InputAdornment> },
                        }}
                      />
                    </Grid>
                  </>
                )}

                <SectionTitle>5. Satış Fiyatlandırması</SectionTitle>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Satış Maliyeti"
                    value={createRawTotal.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                    fullWidth
                    disabled
                    helperText="Birim Maliyet + (Toplam Ek Maliyet ÷ Toplam Alan m²)."
                    slotProps={{
                      input: { endAdornment: <InputAdornment position="end">{form.costCurrency}</InputAdornment> },
                    }}
                  />
                </Grid>
                {form.costCurrency !== 'TRY' && (
                  <>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label="Satış Maliyeti (Güncel Kura Göre)"
                        value={createSaleCostLive.value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                        fullWidth
                        disabled
                        helperText={
                          createSaleCostLive.converted
                            ? "Bugünün TCMB kuruyla TRY'ye çevrilir."
                            : 'Güncel kur alınamadı; Maliyet Para Biriminde gösteriliyor.'
                        }
                        slotProps={{
                          input: {
                            endAdornment: (
                              <InputAdornment position="end">
                                {createSaleCostLive.converted ? 'TRY' : form.costCurrency}
                              </InputAdornment>
                            ),
                          },
                        }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label="Satış Maliyeti (Geliş Kuruna Göre)"
                        value={createSaleCostArrival.value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                        fullWidth
                        disabled
                        helperText={
                          createSaleCostArrival.converted
                            ? 'Geliş Tarihi Kur Bilgisi kullanılarak TRY karşılığı hesaplanır.'
                            : 'Geliş tarihi kuru alınamadı; Maliyet Para Biriminde gösteriliyor.'
                        }
                        slotProps={{
                          input: {
                            endAdornment: (
                              <InputAdornment position="end">
                                {createSaleCostArrival.converted ? 'TRY' : form.costCurrency}
                              </InputAdornment>
                            ),
                          },
                        }}
                      />
                    </Grid>
                  </>
                )}
              </>
            )}
            {error && (
              <Grid size={12}>
                <Alert severity="error">{error}</Alert>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Vazgeç</Button>
          <Button variant="contained" disabled={createMutation.isPending} onClick={handleSubmit}>
            Oluştur
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!editingRow} onClose={() => setEditingRow(null)} maxWidth="md" fullWidth>
        <DialogTitle>Gelen Parti/Lot Kaydını Düzenle</DialogTitle>
        <DialogContent>
          {editForm && (
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <SectionTitle>1. Parti/Lot Bilgileri</SectionTitle>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="Parti/Lot Kodu" value={editingRow?.batchCode ?? ''} fullWidth disabled />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="Taş" value={editingRow?.stoneName ?? ''} fullWidth disabled />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Geliş Tarihi"
                  type="date"
                  value={editForm.arrivalDate}
                  onChange={handleEditChange('arrivalDate')}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  label="Tedarik Türü"
                  value={editForm.supplyType}
                  onChange={(e) => setEditForm((prev) => (prev ? { ...prev, supplyType: e.target.value } : prev))}
                  fullWidth
                >
                  {SUPPLY_TYPES.map((t) => (
                    <MenuItem key={t} value={t}>
                      {SUPPLY_TYPE_LABELS[t]}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="Tedarikçi" value={editForm.supplier} onChange={handleEditChange('supplier')} fullWidth />
              </Grid>

              <SectionTitle>2. Ürün/Stok Bilgileri</SectionTitle>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Gelen Bundle Sayısı"
                  value={editForm.bundleCount}
                  onChange={handleEditChange('bundleCount')}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Kalınlık (cm)"
                  value={editForm.thickness}
                  onChange={handleEditChange('thickness')}
                  fullWidth
                />
              </Grid>
              {editBundleLabels.length > 0 && (
                <Grid size={12}>
                  <TextField
                    label="Bundle Kodları"
                    value={editBundleLabels.join('\n')}
                    fullWidth
                    disabled
                    multiline
                    minRows={Math.min(editBundleLabels.length, 6)}
                  />
                </Grid>
              )}
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextureField
                  value={editForm.texture}
                  onChange={(value) => setEditForm((prev) => (prev ? { ...prev, texture: value } : prev))}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <WarehouseField
                  value={editForm.warehouse}
                  onChange={(value) => setEditForm((prev) => (prev ? { ...prev, warehouse: value } : prev))}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Toplam Alan (m²)"
                  value={(editingRow?.totalArea ?? 0).toLocaleString('tr-TR')}
                  fullWidth
                  disabled
                  helperText="Plakalar eklendikçe otomatik hesaplanır."
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  label="Açıklama"
                  value={editForm.description}
                  onChange={handleEditChange('description')}
                  multiline
                  minRows={2}
                  fullWidth
                />
              </Grid>
              {canSeeCost && (
                <>
                  <SectionTitle>3. Maliyet Bilgileri</SectionTitle>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Birim Maliyet (m²)"
                      value={editForm.unitCost}
                      onChange={handleEditChange('unitCost')}
                      fullWidth
                      slotProps={{
                        input: {
                          endAdornment: <InputAdornment position="end">{editForm.costCurrency}</InputAdornment>,
                        },
                      }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      select
                      label="Maliyet Para Birimi"
                      value={editForm.costCurrency}
                      onChange={(e) =>
                        setEditForm((prev) => (prev ? { ...prev, costCurrency: e.target.value } : prev))
                      }
                      fullWidth
                    >
                      {CURRENCIES.map((c) => (
                        <MenuItem key={c} value={c}>
                          {c}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Gümrük Maliyeti"
                      value={editForm.customsCost}
                      onChange={handleEditChange('customsCost')}
                      fullWidth
                      slotProps={{
                        input: { endAdornment: <InputAdornment position="end">{editForm.costCurrency}</InputAdornment> },
                      }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Nakliye Maliyeti"
                      value={editForm.shippingCost}
                      onChange={handleEditChange('shippingCost')}
                      fullWidth
                      slotProps={{
                        input: { endAdornment: <InputAdornment position="end">{editForm.costCurrency}</InputAdornment> },
                      }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Diğer Maliyet"
                      value={editForm.otherCost}
                      onChange={handleEditChange('otherCost')}
                      fullWidth
                      slotProps={{
                        input: { endAdornment: <InputAdornment position="end">{editForm.costCurrency}</InputAdornment> },
                      }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Toplam Ek Maliyet"
                      value={totalAdditionalCost(
                        editForm.customsCost,
                        editForm.shippingCost,
                        editForm.otherCost,
                      ).toLocaleString('tr-TR')}
                      fullWidth
                      disabled
                      slotProps={{
                        input: { endAdornment: <InputAdornment position="end">{editForm.costCurrency}</InputAdornment> },
                      }}
                    />
                  </Grid>
                  {editForm.costCurrency !== 'TRY' && (
                    <>
                      <SectionTitle>4. Kur Bilgileri</SectionTitle>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          label="Geliş Tarihi Kur Bilgisi"
                          value={
                            editRateOverrideEnabled
                              ? editRateOverride
                              : (editFetchedArrivalRate?.toLocaleString('tr-TR', { maximumFractionDigits: 4 }) ?? '')
                          }
                          onChange={(e) => setEditRateOverride(e.target.value)}
                          disabled={!editRateOverrideEnabled}
                          fullWidth
                          placeholder={editHistoricalRateQuery.isFetching ? 'Kur alınıyor…' : undefined}
                          helperText={
                            editHistoricalRateQuery.data?.date
                              ? `TCMB, ${editHistoricalRateQuery.data.date} tarihli kur (1 ${editForm.costCurrency} → TRY)`
                              : !editHistoricalRateQuery.isFetching
                                ? 'Kur alınamadı; elle girebilirsiniz.'
                                : undefined
                          }
                          slotProps={{
                            input: { endAdornment: <InputAdornment position="end">TRY</InputAdornment> },
                          }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }} sx={{ display: 'flex', alignItems: 'center' }}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={editRateOverrideEnabled}
                              onChange={(e) => {
                                const checked = e.target.checked
                                setEditRateOverrideEnabled(checked)
                                if (checked) {
                                  setEditRateOverride(
                                    editFetchedArrivalRate != null ? String(editFetchedArrivalRate) : '',
                                  )
                                }
                              }}
                            />
                          }
                          label="Kuru Değiştir"
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          label="Güncel Kur (TCMB)"
                          value={
                            getRateForCurrency(editForm.costCurrency, ratesQuery.data)?.toLocaleString('tr-TR', {
                              maximumFractionDigits: 4,
                            }) ?? ''
                          }
                          fullWidth
                          disabled
                          helperText={
                            ratesQuery.data?.date
                              ? `TCMB, ${ratesQuery.data.date} tarihli güncel kur (1 ${editForm.costCurrency} → TRY)`
                              : 'Güncel kur alınamadı.'
                          }
                          slotProps={{
                            input: { endAdornment: <InputAdornment position="end">TRY</InputAdornment> },
                          }}
                        />
                      </Grid>
                    </>
                  )}

                  <SectionTitle>5. Satış Fiyatlandırması</SectionTitle>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Satış Maliyeti"
                      value={editRawTotal.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                      fullWidth
                      disabled
                      helperText="Birim Maliyet + (Toplam Ek Maliyet ÷ Toplam Alan m²)."
                      slotProps={{
                        input: { endAdornment: <InputAdornment position="end">{editForm.costCurrency}</InputAdornment> },
                      }}
                    />
                  </Grid>
                  {editForm.costCurrency !== 'TRY' && (
                    <>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          label="Satış Maliyeti (Güncel Kura Göre)"
                      value={editSaleCostLive.value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                      fullWidth
                      disabled
                      helperText={
                        editSaleCostLive.converted
                          ? "Bugünün TCMB kuruyla TRY'ye çevrilir."
                          : 'Güncel kur alınamadı; Maliyet Para Biriminde gösteriliyor.'
                      }
                      slotProps={{
                        input: {
                          endAdornment: (
                            <InputAdornment position="end">
                              {editSaleCostLive.converted ? 'TRY' : editForm.costCurrency}
                            </InputAdornment>
                          ),
                        },
                      }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Satış Maliyeti (Geliş Kuruna Göre)"
                      value={editSaleCostArrival.value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                      fullWidth
                      disabled
                      helperText={
                        editSaleCostArrival.converted
                          ? 'Geliş Tarihi Kur Bilgisi kullanılarak TRY karşılığı hesaplanır.'
                          : 'Geliş tarihi kuru alınamadı; Maliyet Para Biriminde gösteriliyor.'
                      }
                      slotProps={{
                        input: {
                          endAdornment: (
                            <InputAdornment position="end">
                              {editSaleCostArrival.converted ? 'TRY' : editForm.costCurrency}
                            </InputAdornment>
                          ),
                        },
                      }}
                    />
                  </Grid>
                </>
              )}
              </>
            )}
              {editError && (
                <Grid size={12}>
                  <Alert severity="error">{editError}</Alert>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingRow(null)}>Vazgeç</Button>
          <Button
            variant="contained"
            disabled={updateMutation.isPending}
            onClick={() =>
              editingRow &&
              editForm &&
              updateMutation.mutate({ id: editingRow.id, payload: editForm, saleCost: editRawTotal })
            }
          >
            Kaydet
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Gelen Parti/Lot Kaydını Sil</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            <strong>{deleteTarget?.batchCode}</strong> ({deleteTarget?.stoneName}) kalıcı olarak
            silinecek. Bu işlem geri alınamaz.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Bu partiden plaka kesilmişse silme işlemi engellenir.
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
    </Box>
  )
}
