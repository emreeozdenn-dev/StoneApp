import { useEffect, useMemo, useState } from 'react'
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
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import {
  createRole,
  deleteRole,
  fetchPermissions,
  fetchRolePermissions,
  fetchRolesSummary,
  updateRoleName,
  updateRolePermissions,
} from '../../api/roles'
import { PERMISSION_GROUPS, PERMISSION_LABELS } from './permissionLabels'

type FeedbackState = { kind: 'success' | 'error'; message: string } | null

export function RolesPage() {
  const queryClient = useQueryClient()
  const rolesQuery = useQuery({ queryKey: ['roles-summary'], queryFn: fetchRolesSummary })
  const permissionsQuery = useQuery({ queryKey: ['permissions'], queryFn: fetchPermissions })

  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null)
  useEffect(() => {
    if (selectedRoleId == null && rolesQuery.data && rolesQuery.data.length > 0) {
      setSelectedRoleId(rolesQuery.data[0].id)
    }
  }, [rolesQuery.data, selectedRoleId])

  const selectedRole = rolesQuery.data?.find((r) => r.id === selectedRoleId) ?? null

  const rolePermsQuery = useQuery({
    queryKey: ['role-permissions', selectedRoleId],
    queryFn: () => fetchRolePermissions(selectedRoleId!),
    enabled: selectedRoleId != null,
  })

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [saveFeedback, setSaveFeedback] = useState<FeedbackState>(null)

  useEffect(() => {
    setSelectedKeys(new Set(rolePermsQuery.data?.permissionKeys ?? []))
    setSaveFeedback(null)
  }, [rolePermsQuery.data])

  const groups = useMemo(() => {
    if (!permissionsQuery.data) return []
    const allKeys = new Set(permissionsQuery.data.map((p) => p.key))
    const groups = PERMISSION_GROUPS.map((g) => ({ title: g.title, keys: g.keys.filter((k) => allKeys.has(k)) }))
    const groupedKeys = new Set(groups.flatMap((g) => g.keys))
    const ungrouped = permissionsQuery.data.filter((p) => !groupedKeys.has(p.key)).map((p) => p.key)
    if (ungrouped.length > 0) groups.push({ title: 'Diğer', keys: ungrouped })
    return groups.filter((g) => g.keys.length > 0)
  }, [permissionsQuery.data])

  const toggleKey = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const saveMutation = useMutation({
    mutationFn: () => updateRolePermissions(selectedRoleId!, Array.from(selectedKeys)),
    onSuccess: (data) => {
      setSaveFeedback({ kind: 'success', message: data.message })
      queryClient.invalidateQueries({ queryKey: ['role-permissions', selectedRoleId] })
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Yetkiler kaydedilemedi.'
      setSaveFeedback({ kind: 'error', message })
    },
  })

  // --- Yeni rol oluşturma ---
  const [createOpen, setCreateOpen] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const createMutation = useMutation({
    mutationFn: createRole,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['roles-summary'] })
      setCreateOpen(false)
      setNewRoleName('')
      setCreateError(null)
      setSelectedRoleId(data.id)
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Rol oluşturulamadı.'
      setCreateError(message)
    },
  })

  // --- Rol adını düzenleme ---
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)
  const renameMutation = useMutation({
    mutationFn: () => updateRoleName(selectedRoleId!, renameValue.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles-summary'] })
      setRenaming(false)
      setRenameError(null)
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Rol adı güncellenemedi.'
      setRenameError(message)
    },
  })

  // --- Rol silme ---
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const deleteMutation = useMutation({
    mutationFn: () => deleteRole(selectedRoleId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles-summary'] })
      setDeleteConfirmOpen(false)
      setDeleteError(null)
      setSelectedRoleId(null)
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Rol silinemedi.'
      setDeleteError(message)
    },
  })

  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Roller &amp; Yetkiler
        </Typography>
        <Button variant="contained" onClick={() => setCreateOpen(true)}>
          Yeni Rol
        </Button>
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
        <Paper variant="outlined" sx={{ width: { xs: '100%', md: 280 }, flexShrink: 0, p: 1 }}>
          <List>
            {rolesQuery.data?.map((r) => (
              <ListItemButton
                key={r.id}
                selected={r.id === selectedRoleId}
                onClick={() => setSelectedRoleId(r.id)}
                sx={{ borderRadius: 1.5, mb: 0.5 }}
              >
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {r.name}
                      </Typography>
                      {r.isSystemRole && <Chip label="Sistem" size="small" variant="outlined" />}
                    </Stack>
                  }
                  secondary={`${r.userCount} kullanıcı`}
                />
              </ListItemButton>
            ))}
          </List>
        </Paper>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          {selectedRole && (
            <Paper variant="outlined" sx={{ p: 3 }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 0.5 }}>
                {renaming ? (
                  <>
                    <TextField
                      size="small"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      autoFocus
                    />
                    <Button size="small" onClick={() => renameMutation.mutate()} disabled={renameMutation.isPending}>
                      Kaydet
                    </Button>
                    <Button size="small" onClick={() => setRenaming(false)}>
                      Vazgeç
                    </Button>
                  </>
                ) : (
                  <>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {selectedRole.name}
                    </Typography>
                    {!selectedRole.isSystemRole && (
                      <Button
                        size="small"
                        onClick={() => {
                          setRenaming(true)
                          setRenameValue(selectedRole.name)
                          setRenameError(null)
                        }}
                      >
                        Adını Değiştir
                      </Button>
                    )}
                    {!selectedRole.isSystemRole && (
                      <Button size="small" color="error" onClick={() => setDeleteConfirmOpen(true)}>
                        Rolü Sil
                      </Button>
                    )}
                  </>
                )}
              </Stack>
              {renameError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {renameError}
                </Alert>
              )}
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Bu role sahip kullanıcıların erişebileceği işlemleri seçin.
              </Typography>

              <Stack spacing={3}>
                {groups.map((group) => (
                  <Box key={group.title}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                      {group.title}
                    </Typography>
                    <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
                      {group.keys.map((key) => (
                        <FormControlLabel
                          key={key}
                          control={<Checkbox checked={selectedKeys.has(key)} onChange={() => toggleKey(key)} />}
                          label={PERMISSION_LABELS[key] ?? key}
                        />
                      ))}
                    </Stack>
                    <Divider sx={{ mt: 2 }} />
                  </Box>
                ))}
              </Stack>

              {saveFeedback && (
                <Alert severity={saveFeedback.kind} sx={{ mt: 2 }}>
                  {saveFeedback.message}
                </Alert>
              )}

              <Button
                variant="contained"
                sx={{ mt: 3 }}
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? 'Kaydediliyor…' : 'Yetkileri Kaydet'}
              </Button>
            </Paper>
          )}
        </Box>
      </Stack>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Yeni Rol</DialogTitle>
        <DialogContent>
          <TextField
            label="Rol Adı"
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            fullWidth
            sx={{ mt: 1 }}
            autoFocus
          />
          {createError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {createError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Vazgeç</Button>
          <Button
            variant="contained"
            disabled={!newRoleName.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate(newRoleName.trim())}
          >
            Oluştur
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Rolü Sil</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            <strong>{selectedRole?.name}</strong> rolü kalıcı olarak silinecek. Bu işlem geri alınamaz.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Bu role atanmış kullanıcı varsa silme işlemi engellenir.
          </Typography>
          {deleteError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {deleteError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Vazgeç</Button>
          <Button
            variant="contained"
            color="error"
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
          >
            Sil
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
