import { Box, Grid, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'

export interface OfferPreviewItem {
  stoneName: string
  widthCm: number
  heightCm: number
  thicknessCm: number
  texture: string
  areaM2: number
  unitPrice: number
  quantity: number
}

export interface OfferPreviewDocumentProps {
  companyName: string
  companyAddress: string
  offerDate: string
  currency: string
  vatIncluded: boolean
  validityDays: number | string
  deliveryMethod: string
  deliveryAddress: string
  shippingIncluded: boolean
  usdRate: number | null
  items: OfferPreviewItem[]
  total: number
  brandingCompanyName?: string | null
  brandingLogoUrl?: string | null
  containerRef?: (el: HTMLDivElement | null) => void
}

export function OfferPreviewDocument({
  companyName,
  companyAddress,
  offerDate,
  currency,
  vatIncluded,
  validityDays,
  deliveryMethod,
  deliveryAddress,
  shippingIncluded,
  usdRate,
  items,
  total,
  brandingCompanyName,
  brandingLogoUrl,
  containerRef,
}: OfferPreviewDocumentProps) {
  return (
    <Box
      ref={containerRef}
      sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 3, bgcolor: 'background.paper' }}
    >
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          {brandingLogoUrl && (
            <Box component="img" src={brandingLogoUrl} crossOrigin="anonymous" alt="Logo" sx={{ height: 56, width: 'auto' }} />
          )}
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {brandingCompanyName || 'Firmamız'}
          </Typography>
        </Stack>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            TEKLİF
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Tarih: {offerDate ? new Date(offerDate).toLocaleDateString('tr-TR') : '—'}
          </Typography>
        </Box>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 5 }}>
          <Typography variant="caption" color="text.secondary" component="p">
            Sayın
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {companyName || '—'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {companyAddress || '—'}
          </Typography>
        </Grid>
        <Grid size={{ xs: 0, sm: 2 }} sx={{ display: { xs: 'none', sm: 'block' } }} />
        <Grid size={{ xs: 12, sm: 5 }}>
          <Typography variant="body2">
            <strong>Teklif Geçerlilik Süresi:</strong> {validityDays || '—'} gün
          </Typography>
          <Typography variant="body2">
            <strong>Teslim Şekli:</strong> {deliveryMethod || '—'}
          </Typography>
          <Typography variant="body2">
            <strong>Nakliye:</strong> {shippingIncluded ? 'Dahil' : 'Hariç'}
          </Typography>
          {deliveryAddress && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2">
                <strong>Teslimat Adresi</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {deliveryAddress}
              </Typography>
            </Box>
          )}
        </Grid>
      </Grid>

      <Box sx={{ overflowX: 'auto', mt: 7 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Taş Adı</TableCell>
              <TableCell align="right">En x Boy (cm)</TableCell>
              <TableCell align="right">Kalınlık (cm)</TableCell>
              <TableCell>Doku</TableCell>
              <TableCell align="right">Adet</TableCell>
              <TableCell align="right">Alan (m²)</TableCell>
              <TableCell align="right">Birim Fiyat</TableCell>
              <TableCell align="right">Tutar</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item, index) => (
              <TableRow key={index}>
                <TableCell>{item.stoneName}</TableCell>
                <TableCell align="right">
                  {item.widthCm.toLocaleString('tr-TR')} x {item.heightCm.toLocaleString('tr-TR')}
                </TableCell>
                <TableCell align="right">{item.thicknessCm.toLocaleString('tr-TR')}</TableCell>
                <TableCell>{item.texture}</TableCell>
                <TableCell align="right">{item.quantity}</TableCell>
                <TableCell align="right">{item.areaM2.toLocaleString('tr-TR')}</TableCell>
                <TableCell align="right">
                  {item.unitPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                  {currency}
                </TableCell>
                <TableCell align="right">
                  {(item.unitPrice * item.areaM2 * item.quantity).toLocaleString('tr-TR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  {currency}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      <Stack sx={{ alignItems: 'flex-end', mt: 8 }}>
        <Typography variant="body2" color="text.secondary">
          {vatIncluded ? 'KDV Dahildir' : 'KDV Hariçtir'}
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Genel Toplam: {total.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
        </Typography>
        {currency === 'USD' && usdRate != null && (
          <Typography variant="body2" color="text.secondary">
            TRY Karşılığı:{' '}
            {(total * usdRate).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TRY
          </Typography>
        )}
      </Stack>
    </Box>
  )
}
