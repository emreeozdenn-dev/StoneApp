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
  createStone,
  deleteStone,
  fetchStones,
  updateStone,
  uploadStoneImage,
  type Stone,
} from '../../api/catalog'
import { hasPermission, useCurrentUser } from '../../auth/useCurrentUser'
import { ImageThumbnail } from '../../components/common/ImageThumbnail'

const initialCreateForm = { name: '', code: '', type: '', origin: '', color: '', minimumStock: '' }

interface EditForm {
  name: string
  type: string
  origin: string
  color: string
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
  const createFileInputRef = useRef<HTMLInputElement>(null)

  const [editingStone, setEditingStone] = useState<Stone | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [editImage, setEditImage] = useState<File | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const editFileInputRef = useRef<HTMLInputElement>(null)

  const canCreate = hasPermission(user?.permissions, 'stones.create')
  const canEdit = hasPermission(user?.permissions, 'stones.edit')
  const canDelete = hasPermission(user?.permissions, 'stones.delete')

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

  const createMutation = useMutation({ mutationFn: createStone })
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: EditForm }) =>
      updateStone(id, { ...payload, minimumStock: Number(payload.minimumStock) || 0 }),
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

  const handleCreateChange = (field: keyof typeof createForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setCreateForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const handleCreateSubmit = async () => {
    setCreateError(null)
    setCreateSubmitting(true)
    try {
      const { id } = await createMutation.mutateAsync({
        ...createForm,
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

  const openEdit = (stone: Stone) => {
    setEditingStone(stone)
    setEditForm({
      name: stone.name,
      type: stone.type,
      origin: stone.origin,
      color: stone.color,
      minimumStock: String(stone.minimumStock),
      status: stone.status,
    })
    setEditImage(null)
    setEditError(null)
  }

  const handleEditChange = (field: keyof EditForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
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
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Taşlar
        </Typography>
        {canCreate && (
          <Button variant="contained" onClick={() => setCreateOpen(true)}>
            Taş Ekle
          </Button>
        )}
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
      </Stack>

      <Box sx={{ overflowX: 'auto' }}>
        <Table sx={{ minWidth: 920 }}>
          <TableHead>
            <TableRow>
              <TableCell>Görsel</TableCell>
              <TableCell>Taş Adı</TableCell>
              <TableCell>Kod</TableCell>
              <TableCell>Tip</TableCell>
              <TableCell>Menşei</TableCell>
              <TableCell>Renk</TableCell>
              <TableCell align="right">Mevcut Stok (m²)</TableCell>
              <TableCell align="right">Min. Stok (m²)</TableCell>
              <TableCell>Durum</TableCell>
              {(canEdit || canDelete) && <TableCell>İşlem</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredStones.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <ImageThumbnail src={s.imageUrl} alt={s.name} />
                </TableCell>
                <TableCell>{s.name}</TableCell>
                <TableCell>{s.code}</TableCell>
                <TableCell>{s.type}</TableCell>
                <TableCell>{s.origin}</TableCell>
                <TableCell>{s.color}</TableCell>
                <TableCell align="right">{s.currentStock.toLocaleString('tr-TR')}</TableCell>
                <TableCell align="right">{s.minimumStock.toLocaleString('tr-TR')}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5}>
                    <Chip
                      label={s.status}
                      size="small"
                      color={s.status === 'Aktif' ? 'success' : 'default'}
                    />
                    {s.isBelowMinimumStock && <Chip label="Düşük Stok" size="small" color="warning" />}
                  </Stack>
                </TableCell>
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

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Yeni Taş</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Taş Adı" value={createForm.name} onChange={handleCreateChange('name')} fullWidth />
            <TextField label="Taş Kodu" value={createForm.code} onChange={handleCreateChange('code')} fullWidth />
            <TextField label="Tip" value={createForm.type} onChange={handleCreateChange('type')} fullWidth />
            <TextField label="Menşei" value={createForm.origin} onChange={handleCreateChange('origin')} fullWidth />
            <TextField label="Renk" value={createForm.color} onChange={handleCreateChange('color')} fullWidth />
            <TextField
              label="Minimum Stok (m²)"
              value={createForm.minimumStock}
              onChange={handleCreateChange('minimumStock')}
              fullWidth
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
            {createError && <Alert severity="error">{createError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Vazgeç</Button>
          <Button variant="contained" disabled={createSubmitting} onClick={handleCreateSubmit}>
            Oluştur
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!editingStone} onClose={() => setEditingStone(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Taşı Düzenle</DialogTitle>
        <DialogContent>
          {editForm && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Taş Kodu" value={editingStone?.code ?? ''} fullWidth disabled />
              <TextField label="Taş Adı" value={editForm.name} onChange={handleEditChange('name')} fullWidth />
              <TextField label="Tip" value={editForm.type} onChange={handleEditChange('type')} fullWidth />
              <TextField label="Menşei" value={editForm.origin} onChange={handleEditChange('origin')} fullWidth />
              <TextField label="Renk" value={editForm.color} onChange={handleEditChange('color')} fullWidth />
              <TextField
                label="Minimum Stok (m²)"
                value={editForm.minimumStock}
                onChange={handleEditChange('minimumStock')}
                fullWidth
              />
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
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <ImageThumbnail
                  src={editImage ? URL.createObjectURL(editImage) : editingStone?.imageUrl}
                  alt="Önizleme"
                  size={56}
                />
                <Button variant="outlined" size="small" onClick={() => editFileInputRef.current?.click()}>
                  Görseli Değiştir
                </Button>
                <input
                  ref={editFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={(e) => setEditImage(e.target.files?.[0] ?? null)}
                />
              </Stack>
              {editError && <Alert severity="error">{editError}</Alert>}
            </Stack>
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
