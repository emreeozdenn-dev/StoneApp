import { useMemo, useState } from 'react'
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
import { ColumnSettingsButton } from '../../components/common/ColumnSettingsButton'
import { StatTile } from '../../components/common/StatTile'
import { type ColumnDef, useColumnPreferences } from '../../components/common/useColumnPreferences'
import { useDraggableColumns } from '../../components/common/useDraggableColumns'

type UserColumnKey = 'fullName' | 'email' | 'role' | 'status' | 'twoFactor' | 'lastLogin' | 'active'

const USER_COLUMNS: ColumnDef<UserColumnKey>[] = [
  { key: 'fullName', label: 'Kullanıcı' },
  { key: 'email', label: 'E-posta' },
  { key: 'role', label: 'Rol' },
  { key: 'status', label: 'Durum' },
  { key: 'twoFactor', label: '2FA' },
  { key: 'lastLogin', label: 'Son Giriş' },
  { key: 'active', label: 'Aktif', align: 'right' },
]

function initialsOf(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

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

  const columnPrefs = useColumnPreferences('users', USER_COLUMNS)
  const draggableColumns = useDraggableColumns(columnPrefs.reorderTo)

  const userStats = useMemo(() => {
    const all = usersQuery.data ?? []
    return {
      total: all.length,
      active: all.filter((u) => u.status === 'Aktif').length,
      twoFactorEnabled: all.filter((u) => u.twoFactorEnabled).length,
      inactive: all.filter((u) => u.status !== 'Aktif').length,
    }
  }, [usersQuery.data])

  function renderUserCell(key: UserColumnKey, u: UserListItem) {
    switch (key) {
      case 'fullName':
        return (
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                bgcolor: 'primary.light',
                color: 'primary.contrastText',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {initialsOf(u.firstName, u.lastName)}
            </Box>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.3 }}>
                {u.firstName} {u.lastName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                @{u.username}
              </Typography>
            </Box>
          </Stack>
        )
      case 'email':
        return u.email
      case 'role':
        return <Chip label={u.role} size="small" />
      case 'status':
        return (
          <Chip
            label={u.status}
            size="small"
            color={u.status === 'Aktif' ? 'success' : 'default'}
            variant={u.status === 'Aktif' ? 'filled' : 'outlined'}
          />
        )
      case 'twoFactor':
        return (
          <Chip
            label={u.twoFactorEnabled ? 'Etkin' : 'Kapalı'}
            size="small"
            color={u.twoFactorEnabled ? 'success' : 'default'}
            variant={u.twoFactorEnabled ? 'filled' : 'outlined'}
          />
        )
      case 'lastLogin':
        return u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('tr-TR') : '—'
      case 'active':
        return (
          <Switch
            checked={u.status === 'Aktif'}
            onChange={(e) => statusMutation.mutate({ id: u.id, active: e.target.checked })}
          />
        )
      default:
        return null
    }
  }

  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Kullanıcı Yönetimi
        </Typography>
        <Stack direction="row" spacing={1}>
          <ColumnSettingsButton columns={USER_COLUMNS} prefs={columnPrefs} />
          <Button variant="contained" onClick={() => setDialogOpen(true)}>
            Kullanıcı Ekle
          </Button>
        </Stack>
      </Stack>

      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1.75, mb: 3 }}>
        <StatTile label="Toplam Kullanıcı" value={userStats.total} />
        <StatTile label="Aktif" value={userStats.active} />
        <StatTile label="2FA Etkin" value={userStats.twoFactorEnabled} />
        <StatTile label="Pasif" value={userStats.inactive} status={userStats.inactive > 0 ? 'warning' : undefined} />
      </Stack>

      <Box sx={{ overflowX: 'auto' }}>
      <Table sx={{ minWidth: 760 }}>
        <TableHead>
          <TableRow>
            {columnPrefs.visibleOrderedKeys.map((key) => {
              const col = USER_COLUMNS.find((c) => c.key === key)
              return (
                <TableCell key={key} align={col?.align} {...draggableColumns.getHeaderCellProps(key)}>
                  {col?.label}
                </TableCell>
              )
            })}
            <TableCell align="right">İşlem</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {usersQuery.data?.map((u) => (
            <TableRow key={u.id}>
              {columnPrefs.visibleOrderedKeys.map((key) => {
                const col = USER_COLUMNS.find((c) => c.key === key)
                return (
                  <TableCell key={key} align={col?.align}>
                    {renderUserCell(key, u)}
                  </TableCell>
                )
              })}
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
