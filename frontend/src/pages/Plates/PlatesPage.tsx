import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Chip,
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
  createPlate,
  deletePlate,
  fetchIncomingStocks,
  fetchPlates,
  fetchStones,
  markPlateSold,
  reservePlate,
  unreservePlate,
  updatePlate,
  uploadPlateImage,
  type Plate,
} from '../../api/catalog'
import { hasPermission, useCurrentUser } from '../../auth/useCurrentUser'
import { ImageThumbnail } from '../../components/common/ImageThumbnail'
import { QrCodeThumbnail } from '../../components/common/QrCodeThumbnail'
import { WarehouseField } from '../../components/common/WarehouseField'

const initialForm = {
  stoneId: '',
  incomingStockId: '',
  width: '',
  height: '',
  warehouse: '',
}

function metersToCm(meters: number) {
  return Math.round(meters * 10000) / 100
}

function cmToMeters(cm: number) {
  return cm / 100
}

const statusColor: Record<Plate['status'], 'success' | 'warning' | 'default' | 'error'> = {
  Aktif: 'success',
  Rezerve: 'warning',
  Satildi: 'default',
  Pasif: 'error',
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
  const createFileInputRef = useRef<HTMLInputElement>(null)

  const [saleDialogPlate, setSaleDialogPlate] = useState<Plate | null>(null)
  const [saleAmount, setSaleAmount] = useState('')

  const [imageDialogPlate, setImageDialogPlate] = useState<Plate | null>(null)
  const [imageDialogFile, setImageDialogFile] = useState<File | null>(null)
  const imageDialogInputRef = useRef<HTMLInputElement>(null)

  const [editingPlate, setEditingPlate] = useState<Plate | null>(null)
  const [editForm, setEditForm] = useState<{
    plateNo: string
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
    mutationFn: ({ id, amount }: { id: number; amount: number | null }) => markPlateSold(id, amount),
    onSuccess: () => {
      invalidateAll()
      setSaleDialogPlate(null)
      setSaleAmount('')
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

  const handleCreateSubmit = async () => {
    setError(null)
    setCreateSubmitting(true)
    try {
      const { id } = await createMutation.mutateAsync({
        stoneId: Number(form.stoneId),
        incomingStockId: Number(form.incomingStockId),
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

  const openEdit = (plate: Plate) => {
    setEditingPlate(plate)
    setEditForm({
      plateNo: plate.plateNo,
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

  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Plakalar
        </Typography>
        {canCreate && (
          <Button variant="contained" onClick={() => setDialogOpen(true)}>
            Plaka Ekle
          </Button>
        )}
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
      </Stack>

      <Box sx={{ overflowX: 'auto' }}>
        <Table sx={{ minWidth: 1080 }}>
          <TableHead>
            <TableRow>
              <TableCell>Görsel</TableCell>
              <TableCell>QR</TableCell>
              <TableCell>Plaka No</TableCell>
              <TableCell>Taş</TableCell>
              <TableCell>Parti Kodu</TableCell>
              <TableCell align="right">En x Boy (cm)</TableCell>
              <TableCell align="right">Alan (m²)</TableCell>
              <TableCell>Depo</TableCell>
              <TableCell>Durum</TableCell>
              {canSeeCost && <TableCell align="right">Birim Maliyet</TableCell>}
              <TableCell align="right">Satış Maliyeti</TableCell>
              <TableCell align="right">Satış Tutarı</TableCell>
              {(canEdit || canDelete) && <TableCell>İşlem</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredPlates.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <ImageThumbnail src={p.imageUrl} alt={p.plateNo} />
                </TableCell>
                <TableCell>
                  <QrCodeThumbnail
                    value={p.qrToken}
                    label={{
                      plateNo: p.plateNo,
                      stoneName: p.stoneName,
                      width: metersToCm(p.width),
                      height: metersToCm(p.height),
                    }}
                  />
                </TableCell>
                <TableCell>{p.plateNo}</TableCell>
                <TableCell>{p.stoneName}</TableCell>
                <TableCell>{p.batchCode}</TableCell>
                <TableCell align="right">
                  {metersToCm(p.width).toLocaleString('tr-TR')} x {metersToCm(p.height).toLocaleString('tr-TR')}
                </TableCell>
                <TableCell align="right">{p.area.toLocaleString('tr-TR')}</TableCell>
                <TableCell>{p.warehouse}</TableCell>
                <TableCell>
                  <Chip label={p.status} size="small" color={statusColor[p.status]} />
                </TableCell>
                {canSeeCost && (
                  <TableCell align="right">
                    {p.unitCost != null ? `${p.unitCost.toLocaleString('tr-TR')} ${p.costCurrency}` : '—'}
                  </TableCell>
                )}
                <TableCell align="right">
                  {p.saleCost != null ? `${p.saleCost.toLocaleString('tr-TR')} ${p.saleCurrency}` : '—'}
                </TableCell>
                <TableCell align="right">
                  {p.saleAmount != null ? `${p.saleAmount.toLocaleString('tr-TR')} ${p.saleCurrency}` : '—'}
                </TableCell>
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
                          {p.status === 'Aktif' && (
                            <>
                              <Button size="small" onClick={() => reserveMutation.mutate(p.id)}>
                                Rezerve Et
                              </Button>
                              <Button size="small" variant="contained" onClick={() => { setSaleDialogPlate(p); setSaleAmount(""); }}>
                                Satıldı
                              </Button>
                            </>
                          )}
                          {p.status === 'Rezerve' && (
                            <>
                              <Button size="small" onClick={() => unreserveMutation.mutate(p.id)}>
                                Rezerveden Çıkar
                              </Button>
                              <Button size="small" variant="contained" onClick={() => { setSaleDialogPlate(p); setSaleAmount(""); }}>
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

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Yeni Plaka</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info" variant="outlined">
              Plaka No, taş seçildikten sonra sıradaki numaraya göre otomatik atanacak.
            </Alert>
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
            <TextField
              select
              label="Gelen Stok / Parti"
              value={form.incomingStockId}
              onChange={(e) => setForm((prev) => ({ ...prev, incomingStockId: String(e.target.value) }))}
              fullWidth
              disabled={!form.stoneId}
            >
              {batchesForStone.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.batchCode} — {b.arrivalDate}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Doku"
                value={selectedBatch?.texture ?? ''}
                helperText="Partiden otomatik gelir."
                fullWidth
                disabled
              />
              <TextField
                label="Kalınlık (cm)"
                value={selectedBatch?.thickness ?? ''}
                helperText="Partiden otomatik gelir."
                fullWidth
                disabled
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField label="En (cm)" value={form.width} onChange={handleChange('width')} fullWidth />
              <TextField label="Boy (cm)" value={form.height} onChange={handleChange('height')} fullWidth />
            </Stack>
            <WarehouseField
              value={form.warehouse}
              onChange={(value) => setForm((prev) => ({ ...prev, warehouse: value }))}
            />
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <ImageThumbnail
                src={createImage ? URL.createObjectURL(createImage) : null}
                alt="Önizleme"
                size={56}
              />
              <Button variant="outlined" size="small" onClick={() => createFileInputRef.current?.click()}>
                Görsel Seç
              </Button>
              <input
                ref={createFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => setCreateImage(e.target.files?.[0] ?? null)}
              />
            </Stack>
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Vazgeç</Button>
          <Button variant="contained" disabled={createSubmitting} onClick={handleCreateSubmit}>
            Oluştur
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!editingPlate} onClose={() => setEditingPlate(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Plakayı Düzenle</DialogTitle>
        <DialogContent>
          {editForm && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Taş" value={editingPlate?.stoneName ?? ''} fullWidth disabled />
              <TextField label="Parti Kodu" value={editingPlate?.batchCode ?? ''} fullWidth disabled />
              <TextField label="Plaka No" value={editForm.plateNo} onChange={handleEditChange('plateNo')} fullWidth />
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Doku"
                  value={editingPlate?.texture ?? ''}
                  helperText="Partiden otomatik gelir."
                  fullWidth
                  disabled
                />
                <TextField
                  label="Kalınlık (cm)"
                  value={editingPlate?.thickness ?? ''}
                  helperText="Partiden otomatik gelir."
                  fullWidth
                  disabled
                />
              </Stack>
              <Stack direction="row" spacing={2}>
                <TextField label="En (cm)" value={editForm.width} onChange={handleEditChange('width')} fullWidth />
                <TextField label="Boy (cm)" value={editForm.height} onChange={handleEditChange('height')} fullWidth />
              </Stack>
              <WarehouseField
                value={editForm.warehouse}
                onChange={(value) => setEditForm((prev) => (prev ? { ...prev, warehouse: value } : prev))}
              />
              {editError && <Alert severity="error">{editError}</Alert>}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingPlate(null)}>Vazgeç</Button>
          <Button variant="contained" disabled={editSubmitting} onClick={handleEditSubmit}>
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
          <TextField
            label="Satış Tutarı (opsiyonel)"
            value={saleAmount}
            onChange={(e) => setSaleAmount(e.target.value)}
            helperText="Bu plakanın gerçekte satıldığı tutar. Boş bırakılabilir."
            fullWidth
            autoFocus
          />
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
              })
            }
          >
            Onayla
          </Button>
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
    </Box>
  )
}
