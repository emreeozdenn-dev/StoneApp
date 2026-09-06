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
import { fetchAuditLog, type AuditLogEntry } from '../../api/auditLog'
import { ColumnSettingsButton } from '../../components/common/ColumnSettingsButton'
import { type ColumnDef, useColumnPreferences } from '../../components/common/useColumnPreferences'
import { useDraggableColumns } from '../../components/common/useDraggableColumns'

type AuditLogColumnKey = 'createdAt' | 'userName' | 'action' | 'recordType' | 'details'

const AUDIT_LOG_COLUMNS: ColumnDef<AuditLogColumnKey>[] = [
  { key: 'createdAt', label: 'Tarih' },
  { key: 'userName', label: 'Kullanıcı' },
  { key: 'action', label: 'Eylem' },
  { key: 'recordType', label: 'Kayıt Türü' },
  { key: 'details', label: 'Detay' },
]

const actionLabel: Record<string, string> = {
  Created: 'Oluşturuldu',
  Updated: 'Güncellendi',
  Deleted: 'Silindi',
  StatusChanged: 'Durum Değişti',
  PasswordReset: 'Şifre Sıfırlandı',
  Sold: 'Satıldı',
  PermissionsUpdated: 'Yetkiler Güncellendi',
  TwoFactorEnabled: '2FA Etkinleştirildi',
  TwoFactorDisabled: '2FA Kapatıldı',
  TwoFactorReset: '2FA Sıfırlandı',
}

const actionColor: Record<string, 'success' | 'default' | 'error' | 'warning'> = {
  Created: 'success',
  Updated: 'default',
  Deleted: 'error',
  StatusChanged: 'warning',
  PasswordReset: 'warning',
  Sold: 'success',
  PermissionsUpdated: 'warning',
  TwoFactorEnabled: 'success',
  TwoFactorDisabled: 'warning',
  TwoFactorReset: 'warning',
}

const recordTypeLabel: Record<string, string> = {
  Stone: 'Taş',
  IncomingStock: 'Gelen Parti/Lot',
  Plate: 'Plaka',
  User: 'Kullanıcı',
  Role: 'Rol',
  SystemSettings: 'Sistem Ayarları',
  Offer: 'Teklif',
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

  const columnPrefs = useColumnPreferences('audit-log', AUDIT_LOG_COLUMNS)
  const draggableColumns = useDraggableColumns(columnPrefs.reorderTo)

  function renderAuditLogCell(key: AuditLogColumnKey, a: AuditLogEntry) {
    switch (key) {
      case 'createdAt':
        return new Date(a.createdAt).toLocaleString('tr-TR')
      case 'userName':
        return a.userName
      case 'action':
        return <Chip label={actionLabel[a.action] ?? a.action} size="small" color={actionColor[a.action] ?? 'default'} />
      case 'recordType':
        return recordTypeLabel[a.recordType] ?? a.recordType
      case 'details':
        return a.details ?? a.recordId
      default:
        return null
    }
  }

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
        <ColumnSettingsButton columns={AUDIT_LOG_COLUMNS} prefs={columnPrefs} />
      </Stack>

      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {columnPrefs.visibleOrderedKeys.map((key) => {
                const col = AUDIT_LOG_COLUMNS.find((c) => c.key === key)
                return (
                  <TableCell key={key} align={col?.align} {...draggableColumns.getHeaderCellProps(key)}>
                    {col?.label}
                  </TableCell>
                )
              })}
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((a) => (
              <TableRow key={a.id}>
                {columnPrefs.visibleOrderedKeys.map((key) => {
                  const col = AUDIT_LOG_COLUMNS.find((c) => c.key === key)
                  return (
                    <TableCell key={key} align={col?.align}>
                      {renderAuditLogCell(key, a)}
                    </TableCell>
                  )
                })}
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
