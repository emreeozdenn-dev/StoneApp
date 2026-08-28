import { useQuery } from '@tanstack/react-query'
import { Box, Chip, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import { fetchQrScanHistory, type QrScanLogEntry } from '../../api/qrScan'

const resultLabel: Record<QrScanLogEntry['result'], string> = {
  Success: 'Bulundu',
  NotFound: 'Bulunamadı',
  Invalid: 'Geçersiz',
}

const resultColor: Record<QrScanLogEntry['result'], 'success' | 'warning' | 'error'> = {
  Success: 'success',
  NotFound: 'warning',
  Invalid: 'error',
}

export function QrScanHistoryPage() {
  const historyQuery = useQuery({ queryKey: ['qr-scan-history'], queryFn: fetchQrScanHistory })

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
        QR Tarama Geçmişi
      </Typography>

      <Box sx={{ overflowX: 'auto' }}>
        <Table sx={{ minWidth: 760 }}>
          <TableHead>
            <TableRow>
              <TableCell>Tarih / Saat</TableCell>
              <TableCell>Sonuç</TableCell>
              <TableCell>Plaka No</TableCell>
              <TableCell>Taş</TableCell>
              <TableCell>Taranan Değer</TableCell>
              <TableCell>Tarayan</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {historyQuery.data?.map((log) => (
              <TableRow key={log.id}>
                <TableCell>{new Date(log.scannedAt).toLocaleString('tr-TR')}</TableCell>
                <TableCell>
                  <Chip label={resultLabel[log.result]} size="small" color={resultColor[log.result]} />
                </TableCell>
                <TableCell>{log.plateNo ?? '—'}</TableCell>
                <TableCell>{log.stoneName ?? '—'}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: 12, color: 'text.secondary' }}>
                  {log.rawScannedValue}
                </TableCell>
                <TableCell>{log.scannedByUserName}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      {historyQuery.data?.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Henüz QR tarama kaydı yok.
        </Typography>
      )}
    </Box>
  )
}
