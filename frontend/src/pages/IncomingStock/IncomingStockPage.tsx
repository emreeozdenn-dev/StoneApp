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
  InputAdornment,
  MenuItem,
  Stack,
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
import { fetchExchangeRates, type ExchangeRates } from '../../api/exchangeRates'
import { hasPermission, useCurrentUser } from '../../auth/useCurrentUser'
import { TextureField } from '../../components/common/TextureField'
import { WarehouseField } from '../../components/common/WarehouseField'

const initialForm = {
  stoneId: '',
  arrivalDate: new Date().toISOString().slice(0, 10),
  supplyType: 'Ocak',
  supplier: '',
  thickness: '',
  texture: 'Cilalı',
  warehouse: '',
  unitCost: '',
  costCurrency: 'USD',
  saleCurrency: 'TRY',
  description: '',
  customsCost: '',
  shippingCost: '',
  otherCost: '',
}

interface EditForm {
  arrivalDate: string
  supplyType: string
  supplier: string
  thickness: string
  texture: string
  warehouse: string
  unitCost: string
  costCurrency: string
  saleCurrency: string
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

function convertAmount(
  amount: number,
  from: string,
  to: string,
  rates: ExchangeRates | null | undefined,
): number | null {
  if (from === to) return amount
  const toTry = (value: number, currency: string): number | null => {
    if (currency === 'TRY') return value
    if (currency === 'USD') return rates?.usdTry ? value * rates.usdTry : null
    if (currency === 'EUR') return rates?.eurTry ? value * rates.eurTry : null
    return null
  }
  const fromTry = (value: number, currency: string): number | null => {
    if (currency === 'TRY') return value
    if (currency === 'USD') return rates?.usdTry ? value / rates.usdTry : null
    if (currency === 'EUR') return rates?.eurTry ? value / rates.eurTry : null
    return null
  }
  const tryAmount = toTry(amount, from)
  return tryAmount == null ? null : fromTry(tryAmount, to)
}

function resolveSaleCost(
  unitCost: string,
  customs: string,
  shipping: string,
  other: string,
  totalArea: number,
  costCurrency: string,
  saleCurrency: string,
  rates: ExchangeRates | null | undefined,
): { value: number; converted: boolean } {
  const total = unitSaleCostInCostCurrency(unitCost, customs, shipping, other, totalArea)
  const converted = convertAmount(total, costCurrency, saleCurrency, rates)
  return converted != null ? { value: converted, converted: true } : { value: total, converted: false }
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

  const createSaleCost = useMemo(
    () =>
      resolveSaleCost(
        form.unitCost,
        form.customsCost,
        form.shippingCost,
        form.otherCost,
        0,
        form.costCurrency,
        form.saleCurrency,
        ratesQuery.data,
      ),
    [form.unitCost, form.customsCost, form.shippingCost, form.otherCost, form.costCurrency, form.saleCurrency, ratesQuery.data],
  )

  const editSaleCost = useMemo(
    () =>
      editForm
        ? resolveSaleCost(
            editForm.unitCost,
            editForm.customsCost,
            editForm.shippingCost,
            editForm.otherCost,
            editingRow?.totalArea ?? 0,
            editForm.costCurrency,
            editForm.saleCurrency,
            ratesQuery.data,
          )
        : { value: 0, converted: true },
    [editForm, editingRow, ratesQuery.data],
  )

  const canCreate = hasPermission(user?.permissions, 'incomingstock.create')
  const canEdit = hasPermission(user?.permissions, 'incomingstock.edit')
  const canDelete = hasPermission(user?.permissions, 'incomingstock.delete')
  const canSeeCost =
    hasPermission(user?.permissions, 'cost.unit.view') &&
    hasPermission(user?.permissions, 'cost.currency.view')

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
        quantity: 0,
        thickness: Number(payload.thickness) || 0,
        texture: payload.texture,
        warehouse: payload.warehouse,
        unitCost: Number(payload.unitCost) || 0,
        costCurrency: payload.costCurrency,
        saleCurrency: payload.saleCurrency,
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
      thickness: String(row.thickness),
      texture: row.texture,
      warehouse: row.warehouse,
      unitCost: String(row.unitCost ?? 0),
      costCurrency: row.costCurrency ?? 'USD',
      saleCurrency: row.saleCurrency,
      description: row.description ?? '',
      customsCost: String(row.customsCost ?? 0),
      shippingCost: String(row.shippingCost ?? 0),
      otherCost: String(row.otherCost ?? 0),
    })
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
      quantity: 0,
      thickness: Number(form.thickness) || 0,
      texture: form.texture,
      warehouse: form.warehouse,
      unitCost: canSeeCost ? Number(form.unitCost) || 0 : 0,
      costCurrency: form.costCurrency,
      saleCurrency: form.saleCurrency,
      saleCost: createSaleCost.value,
      description: form.description === '' ? null : form.description,
      customsCost: canSeeCost ? Number(form.customsCost) || 0 : 0,
      shippingCost: canSeeCost ? Number(form.shippingCost) || 0 : 0,
      otherCost: canSeeCost ? Number(form.otherCost) || 0 : 0,
    })
  }

  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Gelen Stok
        </Typography>
        {canCreate && (
          <Button variant="contained" onClick={() => setDialogOpen(true)}>
            Gelen Stok Ekle
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
      </Stack>

      <Box sx={{ overflowX: 'auto' }}>
        <Table sx={{ minWidth: 1080 }}>
          <TableHead>
            <TableRow>
              <TableCell>Parti Kodu</TableCell>
              <TableCell>Taş</TableCell>
              <TableCell>Geliş Tarihi</TableCell>
              <TableCell>Tedarik Türü</TableCell>
              <TableCell>Tedarikçi</TableCell>
              <TableCell align="right">Plaka Sayısı</TableCell>
              <TableCell align="right">Toplam Alan (m²)</TableCell>
              <TableCell align="right">Satış Maliyeti</TableCell>
              {canSeeCost && <TableCell align="right">Birim Maliyet</TableCell>}
              {canSeeCost && <TableCell align="right">Toplam Ek Maliyet</TableCell>}
              {(canEdit || canDelete) && <TableCell>İşlem</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredRows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.batchCode}</TableCell>
                <TableCell>{r.stoneName}</TableCell>
                <TableCell>{r.arrivalDate}</TableCell>
                <TableCell>{SUPPLY_TYPE_LABELS[r.supplyType] ?? r.supplyType}</TableCell>
                <TableCell>{r.supplier}</TableCell>
                <TableCell align="right">{r.plateCountAdded}</TableCell>
                <TableCell align="right">{r.totalArea.toLocaleString('tr-TR')}</TableCell>
                <TableCell align="right">
                  {r.saleCost != null ? `${r.saleCost.toLocaleString('tr-TR')} ${r.saleCurrency}` : '—'}
                </TableCell>
                {canSeeCost && (
                  <TableCell align="right">
                    {r.unitCost?.toLocaleString('tr-TR')} {r.costCurrency}
                  </TableCell>
                )}
                {canSeeCost && (
                  <TableCell align="right">
                    {r.totalAdditionalCost?.toLocaleString('tr-TR') ?? '0'} {r.costCurrency}
                  </TableCell>
                )}
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

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Yeni Gelen Stok</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info" variant="outlined">
              Parti Kodu, sıradaki numaraya göre otomatik atanacak (örn. PB-{new Date().getFullYear()}-001).
            </Alert>
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
            <TextField
              label="Geliş Tarihi"
              type="date"
              value={form.arrivalDate}
              onChange={handleChange('arrivalDate')}
              fullWidth
            />
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
            <TextField label="Tedarikçi" value={form.supplier} onChange={handleChange('supplier')} fullWidth />
            <TextField label="Kalınlık (cm)" value={form.thickness} onChange={handleChange('thickness')} fullWidth />
            <TextureField
              value={form.texture}
              onChange={(value) => setForm((prev) => ({ ...prev, texture: value }))}
            />
            <WarehouseField
              value={form.warehouse}
              onChange={(value) => setForm((prev) => ({ ...prev, warehouse: value }))}
            />
            <TextField
              label="Açıklama"
              value={form.description}
              onChange={handleChange('description')}
              multiline
              minRows={2}
              fullWidth
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Satış Maliyeti (m²)"
                value={createSaleCost.value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                fullWidth
                disabled
                helperText={
                  createSaleCost.converted
                    ? 'Birim Maliyet + (Toplam Ek Maliyet ÷ Toplam Alan m²), güncel kurla hesaplanır.'
                    : 'Güncel kur alınamadı; Maliyet Para Biriminde gösteriliyor.'
                }
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        {createSaleCost.converted ? form.saleCurrency : form.costCurrency}
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <TextField
                select
                label="Satış Para Birimi"
                value={form.saleCurrency}
                onChange={(e) => setForm((prev) => ({ ...prev, saleCurrency: e.target.value }))}
                fullWidth
              >
                {CURRENCIES.map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            {canSeeCost && (
              <>
                <Stack direction="row" spacing={2}>
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
                </Stack>
                <TextField
                  label="Gümrük Maliyeti"
                  value={form.customsCost}
                  onChange={handleChange('customsCost')}
                  fullWidth
                  slotProps={{
                    input: { endAdornment: <InputAdornment position="end">{form.costCurrency}</InputAdornment> },
                  }}
                />
                <TextField
                  label="Nakliye Maliyeti"
                  value={form.shippingCost}
                  onChange={handleChange('shippingCost')}
                  fullWidth
                  slotProps={{
                    input: { endAdornment: <InputAdornment position="end">{form.costCurrency}</InputAdornment> },
                  }}
                />
                <TextField
                  label="Diğer Maliyet"
                  value={form.otherCost}
                  onChange={handleChange('otherCost')}
                  fullWidth
                  slotProps={{
                    input: { endAdornment: <InputAdornment position="end">{form.costCurrency}</InputAdornment> },
                  }}
                />
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
              </>
            )}
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Vazgeç</Button>
          <Button variant="contained" disabled={createMutation.isPending} onClick={handleSubmit}>
            Oluştur
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!editingRow} onClose={() => setEditingRow(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Gelen Stok Kaydını Düzenle</DialogTitle>
        <DialogContent>
          {editForm && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Parti Kodu" value={editingRow?.batchCode ?? ''} fullWidth disabled />
              <TextField label="Taş" value={editingRow?.stoneName ?? ''} fullWidth disabled />
              <TextField
                label="Geliş Tarihi"
                type="date"
                value={editForm.arrivalDate}
                onChange={handleEditChange('arrivalDate')}
                fullWidth
              />
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
              <TextField label="Tedarikçi" value={editForm.supplier} onChange={handleEditChange('supplier')} fullWidth />
              <TextField
                label="Kalınlık (cm)"
                value={editForm.thickness}
                onChange={handleEditChange('thickness')}
                fullWidth
              />
              <TextureField
                value={editForm.texture}
                onChange={(value) => setEditForm((prev) => (prev ? { ...prev, texture: value } : prev))}
              />
              <WarehouseField
                value={editForm.warehouse}
                onChange={(value) => setEditForm((prev) => (prev ? { ...prev, warehouse: value } : prev))}
              />
              <TextField
                label="Açıklama"
                value={editForm.description}
                onChange={handleEditChange('description')}
                multiline
                minRows={2}
                fullWidth
              />
              <TextField
                label="Toplam Alan (m²)"
                value={(editingRow?.totalArea ?? 0).toLocaleString('tr-TR')}
                fullWidth
                disabled
                helperText="Plakalar eklendikçe otomatik hesaplanır."
              />
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Satış Maliyeti (m²)"
                  value={editSaleCost.value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                  fullWidth
                  disabled
                  helperText={
                    editSaleCost.converted
                      ? 'Birim Maliyet + (Toplam Ek Maliyet ÷ Toplam Alan m²), güncel kurla hesaplanır.'
                      : 'Güncel kur alınamadı; Maliyet Para Biriminde gösteriliyor.'
                  }
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          {editSaleCost.converted ? editForm.saleCurrency : editForm.costCurrency}
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <TextField
                  select
                  label="Satış Para Birimi"
                  value={editForm.saleCurrency}
                  onChange={(e) => setEditForm((prev) => (prev ? { ...prev, saleCurrency: e.target.value } : prev))}
                  fullWidth
                >
                  {CURRENCIES.map((c) => (
                    <MenuItem key={c} value={c}>
                      {c}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
              {canSeeCost && (
                <>
                  <Stack direction="row" spacing={2}>
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
                  </Stack>
                  <TextField
                    label="Gümrük Maliyeti"
                    value={editForm.customsCost}
                    onChange={handleEditChange('customsCost')}
                    fullWidth
                    slotProps={{
                      input: { endAdornment: <InputAdornment position="end">{editForm.costCurrency}</InputAdornment> },
                    }}
                  />
                  <TextField
                    label="Nakliye Maliyeti"
                    value={editForm.shippingCost}
                    onChange={handleEditChange('shippingCost')}
                    fullWidth
                    slotProps={{
                      input: { endAdornment: <InputAdornment position="end">{editForm.costCurrency}</InputAdornment> },
                    }}
                  />
                  <TextField
                    label="Diğer Maliyet"
                    value={editForm.otherCost}
                    onChange={handleEditChange('otherCost')}
                    fullWidth
                    slotProps={{
                      input: { endAdornment: <InputAdornment position="end">{editForm.costCurrency}</InputAdornment> },
                    }}
                  />
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
                </>
              )}
              {editError && <Alert severity="error">{editError}</Alert>}
            </Stack>
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
              updateMutation.mutate({ id: editingRow.id, payload: editForm, saleCost: editSaleCost.value })
            }
          >
            Kaydet
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Gelen Stok Kaydını Sil</DialogTitle>
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
