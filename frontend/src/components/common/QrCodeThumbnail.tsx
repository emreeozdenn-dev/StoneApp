import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  IconButton,
  Stack,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/CloseOutlined'
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined'
import QrCode2OutlinedIcon from '@mui/icons-material/QrCode2Outlined'

const dataUrlCache = new Map<string, string>()

async function getQrDataUrl(value: string): Promise<string> {
  const cached = dataUrlCache.get(value)
  if (cached) return cached
  const dataUrl = await QRCode.toDataURL(value, {
    width: 800,
    margin: 2,
    errorCorrectionLevel: 'H',
  })
  dataUrlCache.set(value, dataUrl)
  return dataUrl
}

// Fiziksel etiket: 15x15 cm kağıt/sticker, ortasında 10x10 cm QR + altında okunabilir metin.
// Büyük mermer plakalara göre orantılı ve depoda biraz mesafeden de okunabilir; QR'ın kendisi
// 10 cm'de tutuluyor ki tarama güvenilirliği yüksek kalsın ve etikette metne de yer açılsın.
const LABEL_PAGE_MM = 150
const LABEL_QR_MM = 100

interface QrLabelInfo {
  plateNo: string
  stoneName: string
  width: number
  height: number
}

interface QrCodeThumbnailProps {
  value: string
  label: QrLabelInfo
  size?: number
}

export function QrCodeThumbnail({ value, label, size = 44 }: QrCodeThumbnailProps) {
  const [open, setOpen] = useState(false)
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setDataUrl(null)
    getQrDataUrl(value).then((url) => {
      if (active) setDataUrl(url)
    })
    return () => {
      active = false
    }
  }, [value])

  const handlePrint = () => {
    if (!dataUrl) return
    const printWindow = window.open('', '_blank', 'width=480,height=560')
    if (!printWindow) return

    printWindow.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${label.plateNo}</title>
<style>
  @page { size: ${LABEL_PAGE_MM}mm ${LABEL_PAGE_MM}mm; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    width: ${LABEL_PAGE_MM}mm;
    height: ${LABEL_PAGE_MM}mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-family: Arial, Helvetica, sans-serif;
    text-align: center;
  }
  img { width: ${LABEL_QR_MM}mm; height: ${LABEL_QR_MM}mm; }
  .plateNo { font-size: 22pt; font-weight: 700; margin-top: 5mm; }
  .meta { font-size: 12pt; color: #333; margin-top: 1.5mm; }
</style>
</head>
<body>
  <img src="${dataUrl}" alt="${label.plateNo}" />
  <div class="plateNo">${label.plateNo}</div>
  <div class="meta">${label.stoneName}</div>
  <div class="meta">${label.width} x ${label.height} cm</div>
  <script>
    window.onload = function () {
      window.focus();
      window.print();
    };
  </script>
</body>
</html>`)
    printWindow.document.close()
  }

  return (
    <>
      <Box
        onClick={() => setOpen(true)}
        sx={{
          width: size,
          height: size,
          borderRadius: 1.5,
          border: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'zoom-in',
          bgcolor: 'background.paper',
          overflow: 'hidden',
        }}
      >
        {dataUrl ? (
          <Box
            component="img"
            src={dataUrl}
            alt={`${label.plateNo} QR`}
            sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (
          <QrCode2OutlinedIcon fontSize="small" sx={{ color: 'text.disabled' }} />
        )}
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <IconButton
          onClick={() => setOpen(false)}
          sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'background.paper' }}
        >
          <CloseIcon />
        </IconButton>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 5 }}>
          {dataUrl && (
            <Box component="img" src={dataUrl} alt={`${label.plateNo} QR`} sx={{ width: 240, height: 240 }} />
          )}
          <Stack spacing={0.5} sx={{ mt: 2, alignItems: 'center' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {label.plateNo}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {label.stoneName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {label.width} x {label.height} cm
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button startIcon={<PrintOutlinedIcon />} variant="contained" onClick={handlePrint} disabled={!dataUrl}>
            Yazdır (15x15 cm)
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
