import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import {
  downloadIncomingStockImportTemplate,
  importIncomingStock,
  type IncomingStockImportResult,
} from '../../api/catalog'

interface Props {
  open: boolean
  onClose: () => void
}

export function IncomingStockImportDialog({ open, onClose }: Props) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<IncomingStockImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [templateDownloading, setTemplateDownloading] = useState(false)

  const reset = () => {
    setFile(null)
    setResult(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleDownloadTemplate = async () => {
    setTemplateDownloading(true)
    try {
      const blob = await downloadIncomingStockImportTemplate()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'gelen-stok-sablon.xlsx'
      link.click()
      URL.revokeObjectURL(url)
    } finally {
      setTemplateDownloading(false)
    }
  }

  const run = async (dryRun: boolean) => {
    if (!file) return
    setError(null)
    setSubmitting(true)
    try {
      const data = await importIncomingStock(file, dryRun)
      setResult(data)
      if (data.saved) {
        setFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
        queryClient.invalidateQueries({ queryKey: ['incoming-stock'] })
        queryClient.invalidateQueries({ queryKey: ['plates'] })
        queryClient.invalidateQueries({ queryKey: ['stones'] })
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Excel dosyası içe aktarılamadı.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const previewReady = !!file && !!result && !result.saved && result.errors.length === 0 && result.plateCount > 0
  const area = (value: number) => value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Excel'den Gelen Stok ve Plaka Aktar</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Her satır, aynı ölçüde "Adet" kadar plaka oluşturur. Aynı taş, tedarikçi, geliş tarihi, tedarik türü,
            kalınlık, doku, depo ve birim maliyete sahip satırlar tek partide toplanır. Önce önizleme yapın; bir satır
            bile hatalıysa hiçbir kayıt yazılmaz.
          </Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={handleDownloadTemplate}
            disabled={templateDownloading}
            sx={{ alignSelf: 'flex-start' }}
          >
            Şablonu İndir
          </Button>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Button variant="outlined" size="small" onClick={() => fileInputRef.current?.click()}>
              Dosya Seç
            </Button>
            <Typography variant="body2" color="text.secondary">
              {file ? file.name : 'Dosya seçilmedi'}
            </Typography>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              hidden
              onChange={(e) => {
                setResult(null)
                setError(null)
                setFile(e.target.files?.[0] ?? null)
              }}
            />
          </Stack>
          {error && <Alert severity="error">{error}</Alert>}
          {result && result.errors.length > 0 && (
            <Alert severity="error">{result.errors.length} satır hatalı. Düzeltip tekrar önizleyin; hiçbir kayıt yazılmadı.</Alert>
          )}
          {result && result.errors.length === 0 && (
            <Alert severity={result.saved ? 'success' : 'info'}>
              {result.saved ? 'Aktarıldı: ' : 'Önizleme: '}
              {result.lotCount} parti, {result.plateCount} plaka, {area(result.totalArea)} m²
              {result.skippedRows > 0 && ` (${result.skippedRows} satır Adet 0 olduğu için atlandı)`}.
            </Alert>
          )}
          {result && result.errors.length > 0 && (
            <Box sx={{ maxHeight: 220, overflowY: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Satır</TableCell>
                    <TableCell>Taş Kodu</TableCell>
                    <TableCell>Hata</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {result.errors.map((e, i) => (
                    <TableRow key={i}>
                      <TableCell>{e.row}</TableCell>
                      <TableCell>{e.stoneCode ?? '-'}</TableCell>
                      <TableCell>{e.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Kapat</Button>
        <Button disabled={!file || submitting} onClick={() => run(true)}>
          Önizle
        </Button>
        <Button variant="contained" disabled={!previewReady || submitting} onClick={() => run(false)}>
          Aktar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
