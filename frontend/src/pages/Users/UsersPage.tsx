import { useState } from 'react'
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
import {
  createUser,
  deleteUser,
  fetchRoles,
  fetchUsers,
  resetUserPassword,
  setUserStatus,
  type UserListItem,
} from '../../api/users'
import { adminResetTwoFactor } from '../../api/twoFactor'
import { useCurrentUser } from '../../auth/useCurrentUser'

function generatePassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%'
  const values = new Uint32Array(length)
  crypto.getRandomValues(values)
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars[values[i] % chars.length]
  }
  return result
}

export function UsersPage() {
  const { user: currentUser } = useCurrentUser()
  const queryClient = useQueryClient()
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: fetchUsers })
  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: fetchRoles })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    roleId: 2,
  })
  const [formError, setFormError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setDialogOpen(false)
      setForm({ firstName: '', lastName: '', username: '', email: '', password: '', roleId: 2 })
      setFormError(null)
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Kullanıcı oluşturulamadı.'
      setFormError(message)
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => setUserStatus(id, active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })

  const twoFactorResetMutation = useMutation({
    mutationFn: adminResetTwoFactor,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })

  const [deleteTarget, setDeleteTarget] = useState<UserListItem | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setDeleteTarget(null)
      setDeleteError(null)
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Kullanıcı silinemedi.'
      setDeleteError(message)
    },
  })

  const [resetTarget, setResetTarget] = useState<UserListItem | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetSuccess, setResetSuccess] = useState(false)

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, newPassword }: { id: number; newPassword: string }) => resetUserPassword(id, newPassword),
    onSuccess: () => {
      setResetError(null)
      setResetSuccess(true)
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Şifre sıfırlanamadı.'
      setResetError(message)
    },
  })

  const closeResetDialog = () => {
    setResetTarget(null)
    setResetPassword('')
    setResetError(null)
    setResetSuccess(false)
  }

  const handleChange = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Kullanıcı Yönetimi
        </Typography>
        <Button variant="contained" onClick={() => setDialogOpen(true)}>
          Kullanıcı Ekle
        </Button>
      </Stack>

      <Box sx={{ overflowX: 'auto' }}>
      <Table sx={{ minWidth: 760 }}>
        <TableHead>
          <TableRow>
            <TableCell>Ad Soyad</TableCell>
            <TableCell>Kullanıcı Adı</TableCell>
            <TableCell>E-posta</TableCell>
            <TableCell>Rol</TableCell>
            <TableCell>Durum</TableCell>
            <TableCell>2FA</TableCell>
            <TableCell>Son Giriş</TableCell>
            <TableCell align="right">Aktif</TableCell>
            <TableCell align="right">İşlem</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {usersQuery.data?.map((u) => (
            <TableRow key={u.id}>
              <TableCell>
                {u.firstName} {u.lastName}
              </TableCell>
              <TableCell>{u.username}</TableCell>
              <TableCell>{u.email}</TableCell>
              <TableCell>
                <Chip label={u.role} size="small" />
              </TableCell>
              <TableCell>
                <Chip
                  label={u.status}
                  size="small"
                  color={u.status === 'Aktif' ? 'success' : 'default'}
                  variant={u.status === 'Aktif' ? 'filled' : 'outlined'}
                />
              </TableCell>
              <TableCell>
                <Chip
                  label={u.twoFactorEnabled ? 'Etkin' : 'Kapalı'}
                  size="small"
                  color={u.twoFactorEnabled ? 'success' : 'default'}
                  variant={u.twoFactorEnabled ? 'filled' : 'outlined'}
                />
              </TableCell>
              <TableCell>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('tr-TR') : '—'}</TableCell>
              <TableCell align="right">
                <Switch
                  checked={u.status === 'Aktif'}
                  onChange={(e) => statusMutation.mutate({ id: u.id, active: e.target.checked })}
                />
              </TableCell>
              <TableCell align="right">
                <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                  <Button
                    size="small"
                    onClick={() => {
                      setResetTarget(u)
                      setResetPassword(generatePassword())
                      setResetError(null)
                      setResetSuccess(false)
                    }}
                  >
                    Şifre Sıfırla
                  </Button>
                  {u.twoFactorEnabled && (
                    <Button
                      size="small"
                      onClick={() => twoFactorResetMutation.mutate(u.id)}
                      disabled={twoFactorResetMutation.isPending}
                    >
                      2FA Sıfırla
                    </Button>
                  )}
                  <Button
                    size="small"
                    color="error"
                    disabled={u.id === currentUser?.id}
                    onClick={() => {
                      setDeleteTarget(u)
                      setDeleteError(null)
                    }}
                  >
                    Sil
                  </Button>
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Yeni Kullanıcı</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={2}>
              <TextField label="Ad" value={form.firstName} onChange={handleChange('firstName')} fullWidth />
              <TextField label="Soyad" value={form.lastName} onChange={handleChange('lastName')} fullWidth />
            </Stack>
            <TextField label="Kullanıcı Adı" value={form.username} onChange={handleChange('username')} fullWidth />
            <TextField label="E-posta" value={form.email} onChange={handleChange('email')} fullWidth />
            <TextField
              label="Şifre"
              type="password"
              value={form.password}
              onChange={handleChange('password')}
              fullWidth
            />
            <TextField
              select
              label="Kullanıcı Tipi / Rol"
              value={form.roleId}
              onChange={(e) => setForm((prev) => ({ ...prev, roleId: Number(e.target.value) }))}
              fullWidth
            >
              {rolesQuery.data?.map((r) => (
                <MenuItem key={r.id} value={r.id}>
                  {r.name}
                </MenuItem>
              ))}
            </TextField>
            {formError && <Alert severity="error">{formError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Vazgeç</Button>
          <Button
            variant="contained"
            disabled={createMutation.isPending}
            onClick={() => createMutation.mutate(form)}
          >
            Oluştur
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Kullanıcıyı Sil</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            <strong>
              {deleteTarget?.firstName} {deleteTarget?.lastName}
            </strong>{' '}
            ({deleteTarget?.username}) kalıcı olarak silinecek. Bu işlem geri alınamaz.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Kullanıcının oluşturduğu gelen stok, satış veya QR tarama kaydı varsa silme işlemi
            engellenir — bu durumda kullanıcıyı pasif hale getirmeniz gerekir.
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

      <Dialog open={!!resetTarget} onClose={closeResetDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Şifre Sıfırla</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            <strong>
              {resetTarget?.firstName} {resetTarget?.lastName}
            </strong>{' '}
            ({resetTarget?.username}) için yeni bir şifre belirleyin ve kullanıcıyla paylaşın.
          </Typography>
          <Stack direction="row" spacing={1}>
            <TextField
              label="Yeni Şifre"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              fullWidth
              autoFocus
            />
            <Button variant="outlined" onClick={() => setResetPassword(generatePassword())} sx={{ flexShrink: 0 }}>
              Rastgele Oluştur
            </Button>
          </Stack>
          {resetSuccess && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Şifre sıfırlandı. Yukarıdaki şifreyi kullanıcıyla güvenli bir şekilde paylaşın.
            </Alert>
          )}
          {resetError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {resetError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeResetDialog}>{resetSuccess ? 'Kapat' : 'Vazgeç'}</Button>
          {!resetSuccess && (
            <Button
              variant="contained"
              disabled={resetPassword.length < 6 || resetPasswordMutation.isPending}
              onClick={() => resetTarget && resetPasswordMutation.mutate({ id: resetTarget.id, newPassword: resetPassword })}
            >
              Sıfırla
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  )
}
