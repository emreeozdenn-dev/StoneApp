import { useQuery } from '@tanstack/react-query'
import { Box, Chip, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography } from '@mui/material'
import { fetchNotifications, type NotificationLogEntry } from '../../api/notifications'

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

export function NotificationsPage() {
  const notificationsQuery = useQuery({ queryKey: ['notifications'], queryFn: fetchNotifications })

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
        Bildirim Geçmişi
      </Typography>

      <Box sx={{ overflowX: 'auto' }}>
        <Table sx={{ minWidth: 760 }}>
          <TableHead>
            <TableRow>
              <TableCell>Tarih</TableCell>
              <TableCell>Tür</TableCell>
              <TableCell>Konu</TableCell>
              <TableCell>Alıcı</TableCell>
              <TableCell>Durum</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {notificationsQuery.data?.map((n) => (
              <TableRow key={n.id}>
                <TableCell>{new Date(n.createdAt).toLocaleString('tr-TR')}</TableCell>
                <TableCell>{typeLabel[n.type]}</TableCell>
                <TableCell>{n.subject}</TableCell>
                <TableCell>{n.recipient}</TableCell>
                <TableCell>
                  {n.status === 'Basarisiz' && n.errorMessage ? (
                    <Tooltip title={n.errorMessage}>
                      <Chip label={statusLabel[n.status]} size="small" color={statusColor[n.status]} />
                    </Tooltip>
                  ) : (
                    <Chip label={statusLabel[n.status]} size="small" color={statusColor[n.status]} />
                  )}
                </TableCell>
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
