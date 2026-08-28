import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Chip,
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
import { fetchAuditLog } from '../../api/auditLog'

const actionLabel: Record<string, string> = {
  Created: 'Oluşturuldu',
  Updated: 'Güncellendi',
  Deleted: 'Silindi',
  StatusChanged: 'Durum Değişti',
  PasswordReset: 'Şifre Sıfırlandı',
  Sold: 'Satıldı',
  PermissionsUpdated: 'Yetkiler Güncellendi',
}

const actionColor: Record<string, 'success' | 'default' | 'error' | 'warning'> = {
  Created: 'success',
  Updated: 'default',
  Deleted: 'error',
  StatusChanged: 'warning',
  PasswordReset: 'warning',
  Sold: 'success',
  PermissionsUpdated: 'warning',
}

const recordTypeLabel: Record<string, string> = {
  Stone: 'Taş',
  IncomingStock: 'Gelen Stok',
  Plate: 'Plaka',
  User: 'Kullanıcı',
  Role: 'Rol',
  SystemSettings: 'Sistem Ayarları',
}

export function AuditLogPage() {
  const auditQuery = useQuery({ queryKey: ['audit-log'], queryFn: fetchAuditLog })

  const [search, setSearch] = useState('')
  const [recordTypeFilter, setRecordTypeFilter] = useState('Tumu')

  const recordTypes = useMemo(
    () => Array.from(new Set((auditQuery.data ?? []).map((a) => a.recordType))),
    [auditQuery.data],
  )

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (auditQuery.data ?? []).filter((a) => {
      if (recordTypeFilter !== 'Tumu' && a.recordType !== recordTypeFilter) return false
      if (!term) return true
      return [a.userName, a.recordId, a.details ?? ''].some((field) => field.toLowerCase().includes(term))
    })
  }, [auditQuery.data, search, recordTypeFilter])

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
        Denetim Kaydı
      </Typography>

      <Stack direction="row" spacing={2} sx={{ mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Kullanıcı veya kayıt ara…"
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
          label="Kayıt Türü"
          value={recordTypeFilter}
          onChange={(e) => setRecordTypeFilter(e.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="Tumu">Tümü</MenuItem>
          {recordTypes.map((t) => (
            <MenuItem key={t} value={t}>
              {recordTypeLabel[t] ?? t}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Tarih</TableCell>
              <TableCell>Kullanıcı</TableCell>
              <TableCell>Eylem</TableCell>
              <TableCell>Kayıt Türü</TableCell>
              <TableCell>Detay</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((a) => (
              <TableRow key={a.id}>
                <TableCell>{new Date(a.createdAt).toLocaleString('tr-TR')}</TableCell>
                <TableCell>{a.userName}</TableCell>
                <TableCell>
                  <Chip label={actionLabel[a.action] ?? a.action} size="small" color={actionColor[a.action] ?? 'default'} />
                </TableCell>
                <TableCell>{recordTypeLabel[a.recordType] ?? a.recordType}</TableCell>
                <TableCell>{a.details ?? a.recordId}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filtered.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
            {auditQuery.data?.length === 0 ? 'Henüz denetim kaydı yok.' : 'Aramanızla eşleşen kayıt bulunamadı.'}
          </Typography>
        )}
      </Box>
    </Box>
  )
}
