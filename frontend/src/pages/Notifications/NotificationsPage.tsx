import { useQuery } from '@tanstack/react-query'
import { Box, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography } from '@mui/material'
import { fetchNotifications, type NotificationLogEntry } from '../../api/notifications'
import { ColumnSettingsButton } from '../../components/common/ColumnSettingsButton'
import { type ColumnDef, useColumnPreferences } from '../../components/common/useColumnPreferences'
import { useDraggableColumns } from '../../components/common/useDraggableColumns'

const typeLabel: Record<NotificationLogEntry['type'], string> = {
  YeniStok: 'Yeni Stok',
  DusukStok: 'Düşük Stok',
  PlakaSatildi: 'Plaka Satıldı',
}

const statusLabel: Record<NotificationLogEntry['status'], string> = {
  Pending: 'Bekliyor',
  Gonderildi: 'Gönderildi',
  Basarisiz: 'Başarısız',
}

const statusColor: Record<NotificationLogEntry['status'], 'success' | 'warning' | 'error'> = {
  Pending: 'warning',
  Gonderildi: 'success',
  Basarisiz: 'error',
}

type NotificationColumnKey = 'createdAt' | 'type' | 'subject' | 'recipient' | 'status'

const NOTIFICATION_COLUMNS: ColumnDef<NotificationColumnKey>[] = [
  { key: 'createdAt', label: 'Tarih' },
  { key: 'type', label: 'Tür' },
  { key: 'subject', label: 'Konu' },
  { key: 'recipient', label: 'Alıcı' },
  { key: 'status', label: 'Durum' },
]

export function NotificationsPage() {
  const notificationsQuery = useQuery({ queryKey: ['notifications'], queryFn: fetchNotifications })
  const columnPrefs = useColumnPreferences('notifications', NOTIFICATION_COLUMNS)
  const draggableColumns = useDraggableColumns(columnPrefs.reorderTo)

  function renderNotificationCell(key: NotificationColumnKey, n: NotificationLogEntry) {
    switch (key) {
      case 'createdAt':
        return new Date(n.createdAt).toLocaleString('tr-TR')
      case 'type':
        return typeLabel[n.type]
      case 'subject':
        return n.subject
      case 'recipient':
        return n.recipient
      case 'status':
        return n.status === 'Basarisiz' && n.errorMessage ? (
          <Tooltip title={n.errorMessage}>
            <Chip label={statusLabel[n.status]} size="small" color={statusColor[n.status]} />
          </Tooltip>
        ) : (
          <Chip label={statusLabel[n.status]} size="small" color={statusColor[n.status]} />
        )
      default:
        return null
    }
  }

  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Bildirim Geçmişi
        </Typography>
        <ColumnSettingsButton columns={NOTIFICATION_COLUMNS} prefs={columnPrefs} />
      </Stack>

      <Box sx={{ overflowX: 'auto' }}>
        <Table sx={{ minWidth: 760 }}>
          <TableHead>
            <TableRow>
              {columnPrefs.visibleOrderedKeys.map((key) => {
                const col = NOTIFICATION_COLUMNS.find((c) => c.key === key)
                return (
                  <TableCell key={key} align={col?.align} {...draggableColumns.getHeaderCellProps(key)}>
                    {col?.label}
                  </TableCell>
                )
              })}
            </TableRow>
          </TableHead>
          <TableBody>
            {notificationsQuery.data?.map((n) => (
              <TableRow key={n.id}>
                {columnPrefs.visibleOrderedKeys.map((key) => {
                  const col = NOTIFICATION_COLUMNS.find((c) => c.key === key)
                  return (
                    <TableCell key={key} align={col?.align}>
                      {renderNotificationCell(key, n)}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      {notificationsQuery.data?.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Henüz bildirim gönderilmedi. SMTP ayarlarını ve alıcıları Sistem Ayarları sayfasından
          yapılandırabilirsiniz.
        </Typography>
      )}
    </Box>
  )
}
