import { useMemo, useState } from 'react'
import JsBarcode from 'jsbarcode'
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
import BarcodeIcon from '@mui/icons-material/BarcodeReader'

const dataUrlCache = new Map<string, string>()

function getBarcodeDataUrl(value: string): string {
  const cached = dataUrlCache.get(value)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  JsBarcode(canvas, value, {
    format: 'CODE128',
    displayValue: false,
    margin: 0,
    marginLeft: 8,
    marginRight: 8,
    width: 2,
    height: 120,
  })
  const dataUrl = canvas.toDataURL('image/png')
  dataUrlCache.set(value, dataUrl)
  return dataUrl
}

// Fiziksel etiket: barkod (çizgiler) fiziksel yükseklikte en fazla 1,5 cm — okuyucularla
// taranabilirliği korurken depo etiketlerinde yer kaplamıyor. Genişlik, plaka no'nun
// uzunluğuna göre orantılı büyür; etiket kağıdı barkodu ve altındaki metni saracak
// şekilde otomatik boyutlanır (sabit kare değil, barkodun kendisi gibi yatay dikdörtgen).
const BARCODE_HEIGHT_MM = 15

interface BarcodeLabelInfo {
  plateNo: string
  stoneName: string
  width: number
  height: number
}

interface BarcodeThumbnailProps {
  value: string
  label: BarcodeLabelInfo
  size?: number
}

export function BarcodeThumbnail({ value, label, size = 44 }: BarcodeThumbnailProps) {
  const [open, setOpen] = useState(false)
  const dataUrl = useMemo(() => getBarcodeDataUrl(value), [value])

  const handlePrint = () => {
    if (!dataUrl) return
    const printWindow = window.open('', '_blank', 'width=480,height=320')
    if (!printWindow) return

    printWindow.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${label.plateNo}</title>
<style>
  @page { margin: 3mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-family: Arial, Helvetica, sans-serif;
    text-align: center;
  }
  img { height: ${BARCODE_HEIGHT_MM}mm; width: auto; display: block; margin: 0; }
  .plateNo { font-size: 12pt; font-weight: 700; line-height: 1.1; margin-top: 0.5mm; }
  .meta { font-size: 8pt; color: #333; line-height: 1.1; margin-top: 0.2mm; }
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
          p: 0.5,
        }}
      >
        {dataUrl ? (
          <Box
            component="img"
            src={dataUrl}
            alt={`${label.plateNo} Barkod`}
            sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (
          <BarcodeIcon fontSize="small" sx={{ color: 'text.disabled' }} />
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
            <Box component="img" src={dataUrl} alt={`${label.plateNo} Barkod`} sx={{ width: '90%', height: 100 }} />
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
            Yazdır (Barkod, 1,5 cm)
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
