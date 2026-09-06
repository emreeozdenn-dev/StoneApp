import { useQuery } from '@tanstack/react-query'
import { Box, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import { fetchQrScanHistory, type QrScanLogEntry } from '../../api/qrScan'
import { ColumnSettingsButton } from '../../components/common/ColumnSettingsButton'
import { type ColumnDef, useColumnPreferences } from '../../components/common/useColumnPreferences'
import { useDraggableColumns } from '../../components/common/useDraggableColumns'

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

type QrScanColumnKey = 'scannedAt' | 'result' | 'plateNo' | 'stoneName' | 'rawValue' | 'scannedBy'

const QR_SCAN_COLUMNS: ColumnDef<QrScanColumnKey>[] = [
  { key: 'scannedAt', label: 'Tarih / Saat' },
  { key: 'result', label: 'Sonuç' },
  { key: 'plateNo', label: 'Plaka No' },
  { key: 'stoneName', label: 'Taş' },
  { key: 'rawValue', label: 'Taranan Değer' },
  { key: 'scannedBy', label: 'Tarayan' },
]

export function QrScanHistoryPage() {
  const historyQuery = useQuery({ queryKey: ['qr-scan-history'], queryFn: fetchQrScanHistory })
  const columnPrefs = useColumnPreferences('qr-scan-history', QR_SCAN_COLUMNS)
  const draggableColumns = useDraggableColumns(columnPrefs.reorderTo)

  function renderQrScanCell(key: QrScanColumnKey, log: QrScanLogEntry) {
    switch (key) {
      case 'scannedAt':
        return new Date(log.scannedAt).toLocaleString('tr-TR')
      case 'result':
        return <Chip label={resultLabel[log.result]} size="small" color={resultColor[log.result]} />
      case 'plateNo':
        return log.plateNo ?? '—'
      case 'stoneName':
        return log.stoneName ?? '—'
      case 'rawValue':
        return log.rawScannedValue
      case 'scannedBy':
        return log.scannedByUserName
      default:
        return null
    }
  }

  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          QR Tarama Geçmişi
        </Typography>
        <ColumnSettingsButton columns={QR_SCAN_COLUMNS} prefs={columnPrefs} />
      </Stack>

      <Box sx={{ overflowX: 'auto' }}>
        <Table sx={{ minWidth: 760 }}>
          <TableHead>
            <TableRow>
              {columnPrefs.visibleOrderedKeys.map((key) => {
                const col = QR_SCAN_COLUMNS.find((c) => c.key === key)
                return (
                  <TableCell key={key} align={col?.align} {...draggableColumns.getHeaderCellProps(key)}>
                    {col?.label}
                  </TableCell>
                )
              })}
            </TableRow>
          </TableHead>
          <TableBody>
            {historyQuery.data?.map((log) => (
              <TableRow key={log.id}>
                {columnPrefs.visibleOrderedKeys.map((key) => {
                  const col = QR_SCAN_COLUMNS.find((c) => c.key === key)
                  return (
                    <TableCell
                      key={key}
                      align={col?.align}
                      sx={key === 'rawValue' ? { fontFamily: 'monospace', fontSize: 12, color: 'text.secondary' } : undefined}
                    >
                      {renderQrScanCell(key, log)}
                    </TableCell>
                  )
                })}
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
