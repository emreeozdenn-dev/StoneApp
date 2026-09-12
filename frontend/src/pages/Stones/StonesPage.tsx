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
import UploadFileIcon from '@mui/icons-material/UploadFileOutlined'
import {
  createStone,
  deleteStone,
  downloadStoneImportTemplate,
  fetchStones,
  importStones,
  updateStone,
  uploadStoneImage,
  type Stone,
  type StoneImportResult,
} from '../../api/catalog'
import { hasPermission, useCurrentUser } from '../../auth/useCurrentUser'
import { ColorField } from '../../components/common/ColorField'
import { ColumnSettingsButton } from '../../components/common/ColumnSettingsButton'
import { GroupLabel } from '../../components/common/GroupLabel'
import { ImageDropzone } from '../../components/common/ImageDropzone'
import { ImageThumbnail } from '../../components/common/ImageThumbnail'
import { OriginField } from '../../components/common/OriginField'
import { StatTile } from '../../components/common/StatTile'
import { type ColumnDef, useColumnPreferences } from '../../components/common/useColumnPreferences'
import { useDraggableColumns } from '../../components/common/useDraggableColumns'

type StoneColumnKey =
  | 'name'
  | 'type'
  | 'origin'
  | 'color'
  | 'currentStock'
  | 'minimumStock'
  | 'status'

const STONE_COLUMNS: ColumnDef<StoneColumnKey>[] = [
  { key: 'name', label: 'Taş' },
  { key: 'type', label: 'Tip' },
  { key: 'origin', label: 'Menşei' },
  { key: 'color', label: 'Renk' },
  { key: 'currentStock', label: 'Mevcut Stok (m²)', align: 'right' },
  { key: 'minimumStock', label: 'Min. Stok (m²)', align: 'right' },
  { key: 'status', label: 'Durum' },
]

const initialCreateForm: CreateForm = { name: '', code: '', type: '', origin: '', color: [], minimumStock: '' }

function parseColors(color: string): string[] {
  return color
    .split(',')
    .map((c) => c.trim())
    .filter((c) => c.length > 0)
}

interface CreateForm {
  name: string
  code: string
  type: string
  origin: string
  color: string[]
  minimumStock: string
}

interface EditForm {
  name: string
  type: string
  origin: string
  color: string[]
  minimumStock: string
  status: 'Aktif' | 'Pasif'
}

export function StonesPage() {
  const { user } = useCurrentUser()
  const queryClient = useQueryClient()
  const stonesQuery = useQuery({ queryKey: ['stones'], queryFn: fetchStones })

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(initialCreateForm)
  const [createImage, setCreateImage] = useState<File | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSubmitting, setCreateSubmitting] = useState(false)

  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<StoneImportResult | null>(null)
  const [importSubmitting, setImportSubmitting] = useState(false)
  const [templateDownloading, setTemplateDownloading] = useState(false)
  const importFileInputRef = useRef<HTMLInputElement>(null)

  const [editingStone, setEditingStone] = useState<Stone | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [editImage, setEditImage] = useState<File | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [editSubmitting, setEditSubmitting] = useState(false)

  const canCreate = hasPermission(user?.permissions, 'stones.create')
  const canEdit = hasPermission(user?.permissions, 'stones.edit')
  const canDelete = hasPermission(user?.permissions, 'stones.delete')

  const columnPrefs = useColumnPreferences('stones', STONE_COLUMNS)
  const draggableColumns = useDraggableColumns(columnPrefs.reorderTo)

  function renderStoneCell(key: StoneColumnKey, s: Stone) {
    switch (key) {
      case 'name':
        return (
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
            <ImageThumbnail src={s.imageUrl} alt={s.name} size={38} />
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.3 }}>
                {s.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {s.code}
              </Typography>
            </Box>
          </Stack>
        )
      case 'type':
        return s.type
      case 'origin':
        return s.origin
      case 'color':
        return (
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            {parseColors(s.color).map((c) => (
              <Chip key={c} label={c} size="small" variant="outlined" />
            ))}
          </Stack>
        )
      case 'currentStock':
        return s.currentStock.toLocaleString('tr-TR')
      case 'minimumStock':
        return s.minimumStock.toLocaleString('tr-TR')
      case 'status':
        return (
          <Stack direction="row" spacing={0.5}>
            <Chip label={s.status} size="small" color={s.status === 'Aktif' ? 'success' : 'default'} />
            {s.isBelowMinimumStock && <Chip label="Düşük Stok" size="small" color="warning" />}
          </Stack>
        )
      default:
        return null
    }
  }

  const [search, setSearch] = useState('')
  const [onlyLowStock, setOnlyLowStock] = useState(false)
  const filteredStones = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (stonesQuery.data ?? []).filter((s) => {
      if (onlyLowStock && !s.isBelowMinimumStock) return false
      if (!term) return true
      return [s.name, s.code, s.type, s.origin, s.color].some((field) => field.toLowerCase().includes(term))
    })
  }, [stonesQuery.data, search, onlyLowStock])

  const stoneStats = useMemo(() => {
    const all = stonesQuery.data ?? []
    return {
      total: all.length,
      active: all.filter((s) => s.status === 'Aktif').length,
      lowStock: all.filter((s) => s.isBelowMinimumStock).length,
      totalCurrentStock: all.reduce((sum, s) => sum + s.currentStock, 0),
    }
  }, [stonesQuery.data])

  const createMutation = useMutation({ mutationFn: createStone })
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: EditForm }) =>
      updateStone(id, {
        ...payload,
        color: payload.color.join(', '),
        minimumStock: Number(payload.minimumStock) || 0,
      }),
  })
  const uploadMutation = useMutation({ mutationFn: ({ id, file }: { id: number; file: File }) => uploadStoneImage(id, file) })

  const [deleteTarget, setDeleteTarget] = useState<Stone | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const deleteMutation = useMutation({
    mutationFn: deleteStone,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stones'] })
      setDeleteTarget(null)
      setDeleteError(null)
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Taş silinemedi.'
      setDeleteError(message)
    },
  })

  const handleCreateChange =
    (field: Exclude<keyof CreateForm, 'color' | 'origin'>) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setCreateForm((prev) => ({ ...prev, [field]: e.target.value }))
    }

  const handleCreateSubmit = async () => {
    setCreateError(null)
    setCreateSubmitting(true)
    try {
      const { id } = await createMutation.mutateAsync({
        ...createForm,
        color: createForm.color.join(', '),
        minimumStock: Number(createForm.minimumStock) || 0,
      })
      if (createImage) {
        await uploadMutation.mutateAsync({ id, file: createImage })
      }
      queryClient.invalidateQueries({ queryKey: ['stones'] })
      setCreateOpen(false)
      setCreateForm(initialCreateForm)
      setCreateImage(null)
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Taş oluşturulamadı.'
      setCreateError(message)
    } finally {
      setCreateSubmitting(false)
    }
  }

  const handleDownloadTemplate = async () => {
    setTemplateDownloading(true)
    try {
      const blob = await downloadStoneImportTemplate()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'taslar-sablon.xlsx'
      link.click()
      URL.revokeObjectURL(url)
    } finally {
      setTemplateDownloading(false)
    }
  }

  const closeImportDialog = () => {
    setImportOpen(false)
    setImportFile(null)
    setImportError(null)
    setImportResult(null)
  }

  const handleImportSubmit = async () => {
    if (!importFile) return
    setImportError(null)
    setImportSubmitting(true)
    try {
      const result = await importStones(importFile)
      setImportResult(result)
      setImportFile(null)
      if (importFileInputRef.current) importFileInputRef.current.value = ''
      queryClient.invalidateQueries({ queryKey: ['stones'] })
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Excel dosyası içe aktarılamadı.'
      setImportError(message)
    } finally {
      setImportSubmitting(false)
    }
  }

  const openEdit = (stone: Stone) => {
    setEditingStone(stone)
    setEditForm({
      name: stone.name,
      type: stone.type,
      origin: stone.origin,
      color: parseColors(stone.color),
      minimumStock: String(stone.minimumStock),
      status: stone.status,
    })
    setEditImage(null)
    setEditError(null)
  }

  const handleEditChange =
    (field: Exclude<keyof EditForm, 'color' | 'status'>) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setEditForm((prev) => (prev ? { ...prev, [field]: e.target.value } : prev))
    }

  const handleEditSubmit = async () => {
    if (!editingStone || !editForm) return
    setEditError(null)
    setEditSubmitting(true)
    try {
      await updateMutation.mutateAsync({ id: editingStone.id, payload: editForm })
      if (editImage) {
        await uploadMutation.mutateAsync({ id: editingStone.id, file: editImage })
      }
      queryClient.invalidateQueries({ queryKey: ['stones'] })
      setEditingStone(null)
      setEditForm(null)
      setEditImage(null)
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Taş güncellenemedi.'
      setEditError(message)
    } finally {
      setEditSubmitting(false)
    }
  }

  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Taşlar
        </Typography>
        {canCreate && (
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<UploadFileIcon />}
              onClick={() => {
                setImportResult(null)
                setImportError(null)
                setImportOpen(true)
              }}
            >
              Excel'den Aktar
            </Button>
            <Button variant="contained" onClick={() => setCreateOpen(true)}>
              Taş Ekle
            </Button>
          </Stack>
        )}
      </Stack>

      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1.75, mb: 3 }}>
        <StatTile label="Toplam Taş Çeşidi" value={stoneStats.total} />
        <StatTile label="Aktif" value={stoneStats.active} />
        <StatTile label="Düşük Stok" value={stoneStats.lowStock} status={stoneStats.lowStock > 0 ? 'warning' : undefined} />
        <StatTile label="Toplam Mevcut Stok" value={`${stoneStats.totalCurrentStock.toLocaleString('tr-TR')} m²`} />
      </Stack>

      <Stack direction="row" spacing={2} sx={{ mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Ad, kod, tip, menşei veya renk ara…"
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
        <FormControlLabel
          control={<Switch checked={onlyLowStock} onChange={(e) => setOnlyLowStock(e.target.checked)} />}
          label="Sadece Düşük Stok"
        />
        <ColumnSettingsButton columns={STONE_COLUMNS} prefs={columnPrefs} />
      </Stack>

      <Box sx={{ overflowX: 'auto' }}>
        <Table sx={{ minWidth: 920 }}>
          <TableHead sx={{ bgcolor: 'grey.50' }}>
            <TableRow>
              {columnPrefs.visibleOrderedKeys.map((key) => {
                const col = STONE_COLUMNS.find((c) => c.key === key)
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
            {filteredStones.map((s) => (
              <TableRow key={s.id}>
                {columnPrefs.visibleOrderedKeys.map((key) => {
                  const col = STONE_COLUMNS.find((c) => c.key === key)
                  return (
                    <TableCell key={key} align={col?.align}>
                      {renderStoneCell(key, s)}
                    </TableCell>
                  )
                })}
                {(canEdit || canDelete) && (
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      {canEdit && (
                        <Button size="small" onClick={() => openEdit(s)}>
                          Düzenle
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          size="small"
                          color="error"
                          onClick={() => {
                            setDeleteTarget(s)
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
        {filteredStones.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
            Aramanızla eşleşen taş bulunamadı.
          </Typography>
        )}
      </Box>

      <Dialog open={importOpen} onClose={closeImportDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Excel'den Taş Aktar</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Önce şablonu indirip Taş Adı, Kod, Tip, Menşei, Renk ve Min Stok bilgilerini doldurun,
              ardından dosyayı buradan yükleyin. Kod alanı zorunludur ve mevcut kodlarla
              çakışmamalıdır.
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={handleDownloadTemplate}
              disabled={templateDownloading}
              sx={{ alignSelf: 'flex-start' }}
            >
              Şablonu İndir
            </Button>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <Button variant="outlined" size="small" onClick={() => importFileInputRef.current?.click()}>
                Dosya Seç
              </Button>
              <Typography variant="body2" color="text.secondary">
                {importFile ? importFile.name : 'Dosya seçilmedi'}
              </Typography>
              <input
                ref={importFileInputRef}
                type="file"
                accept=".xlsx"
                hidden
                onChange={(e) => {
                  setImportResult(null)
                  setImportError(null)
                  setImportFile(e.target.files?.[0] ?? null)
                }}
              />
            </Stack>
            {importError && <Alert severity="error">{importError}</Alert>}
            {importResult && (
              <Alert severity={importResult.failed > 0 ? 'warning' : 'success'}>
                {importResult.created} taş oluşturuldu, {importResult.failed} satır hatalı.
              </Alert>
            )}
            {importResult && importResult.errors.length > 0 && (
              <Box sx={{ maxHeight: 220, overflowY: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Satır</TableCell>
                      <TableCell>Kod</TableCell>
                      <TableCell>Hata</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {importResult.errors.map((e, i) => (
                      <TableRow key={i}>
                        <TableCell>{e.row}</TableCell>
                        <TableCell>{e.code ?? '-'}</TableCell>
                        <TableCell>{e.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeImportDialog}>Kapat</Button>
          <Button
            variant="contained"
            disabled={!importFile || importSubmitting}
            onClick={handleImportSubmit}
          >
            Aktar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Yeni Taş</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12, sm: 'auto' }} sx={{ display: 'flex', justifyContent: { xs: 'center', sm: 'flex-start' } }}>
              <ImageDropzone file={createImage} onChange={setCreateImage} />
            </Grid>
            <Grid size={{ xs: 12, sm: 'grow' }}>
              <GroupLabel>Temel Bilgiler</GroupLabel>
              <Stack spacing={2} sx={{ mb: 2.5 }}>
                <TextField label="Taş Adı" value={createForm.name} onChange={handleCreateChange('name')} fullWidth />
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField label="Taş Kodu" value={createForm.code} onChange={handleCreateChange('code')} fullWidth />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField label="Tip" value={createForm.type} onChange={handleCreateChange('type')} fullWidth />
                  </Grid>
                </Grid>
              </Stack>

              <GroupLabel>Menşei &amp; Stok</GroupLabel>
              <Grid container spacing={2} sx={{ mb: 2.5 }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <OriginField
                    value={createForm.origin}
                    onChange={(origin) => setCreateForm((prev) => ({ ...prev, origin }))}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Minimum Stok (m²)"
                    value={createForm.minimumStock}
                    onChange={handleCreateChange('minimumStock')}
                    fullWidth
                  />
                </Grid>
              </Grid>

              <GroupLabel>Renk</GroupLabel>
              <ColorField
                value={createForm.color}
                onChange={(color) => setCreateForm((prev) => ({ ...prev, color }))}
              />

              {createError && (
                <Alert severity="error" sx={{ mt: 2.5 }}>
                  {createError}
                </Alert>
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Vazgeç</Button>
          <Button variant="contained" disabled={createSubmitting} onClick={handleCreateSubmit}>
            Oluştur
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!editingStone} onClose={() => setEditingStone(null)} maxWidth="md" fullWidth>
        <DialogTitle>Taşı Düzenle</DialogTitle>
        <DialogContent>
          {editForm && (
            <Grid container spacing={3} sx={{ mt: 0.5 }}>
              <Grid size={{ xs: 12, sm: 'auto' }} sx={{ display: 'flex', justifyContent: { xs: 'center', sm: 'flex-start' } }}>
                <ImageDropzone file={editImage} existingUrl={editingStone?.imageUrl} onChange={setEditImage} />
              </Grid>
              <Grid size={{ xs: 12, sm: 'grow' }}>
                <GroupLabel>Temel Bilgiler</GroupLabel>
                <Stack spacing={2} sx={{ mb: 2.5 }}>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField label="Taş Kodu" value={editingStone?.code ?? ''} fullWidth disabled />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        select
                        label="Durum"
                        value={editForm.status}
                        onChange={(e) =>
                          setEditForm((prev) => (prev ? { ...prev, status: e.target.value as 'Aktif' | 'Pasif' } : prev))
                        }
                        fullWidth
                      >
                        <MenuItem value="Aktif">Aktif</MenuItem>
                        <MenuItem value="Pasif">Pasif</MenuItem>
                      </TextField>
                    </Grid>
                  </Grid>
                  <TextField label="Taş Adı" value={editForm.name} onChange={handleEditChange('name')} fullWidth />
                  <TextField label="Tip" value={editForm.type} onChange={handleEditChange('type')} fullWidth />
                </Stack>

                <GroupLabel>Menşei &amp; Stok</GroupLabel>
                <Grid container spacing={2} sx={{ mb: 2.5 }}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <OriginField
                      value={editForm.origin}
                      onChange={(origin) => setEditForm((prev) => (prev ? { ...prev, origin } : prev))}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Minimum Stok (m²)"
                      value={editForm.minimumStock}
                      onChange={handleEditChange('minimumStock')}
                      fullWidth
                    />
                  </Grid>
                </Grid>

                <GroupLabel>Renk</GroupLabel>
                <ColorField
                  value={editForm.color}
                  onChange={(color) => setEditForm((prev) => (prev ? { ...prev, color } : prev))}
                />

                {editError && (
                  <Alert severity="error" sx={{ mt: 2.5 }}>
                    {editError}
                  </Alert>
                )}
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingStone(null)}>Vazgeç</Button>
          <Button variant="contained" disabled={editSubmitting} onClick={handleEditSubmit}>
            Kaydet
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Taşı Sil</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            <strong>{deleteTarget?.name}</strong> ({deleteTarget?.code}) kalıcı olarak silinecek. Bu işlem
            geri alınamaz.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Bu taşa bağlı gelen stok veya plaka kaydı varsa silme işlemi engellenir — bu durumda taşı
            pasif hale getirmeniz gerekir.
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
