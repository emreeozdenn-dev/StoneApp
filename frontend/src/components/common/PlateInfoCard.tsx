import { Box, Typography } from '@mui/material'
import type { PlateInfoItem } from '../../utils/plateExport'

// Görsel üstte, bilgi tablosu altta olacak şekilde tek bir plaka kartı render eder.
// "Plaka Bilgisi Gönder" (Plakalar) ve QR Kod Tara sonuç ekranı bu kartı; hem ekranda
// göstermek hem de WhatsApp/JPEG/PDF dışa aktarımlarında yakalama (html2canvas) kaynağı
// olarak ortak kullanır.
export function PlateInfoCard({
  item,
  cardRef,
}: {
  item: PlateInfoItem
  cardRef?: (el: HTMLDivElement | null) => void
}) {
  const rows: [string, string][] = [
    ['En x Boy', `${item.widthCm.toLocaleString('tr-TR')} x ${item.heightCm.toLocaleString('tr-TR')} cm`],
    ['Kalınlık', `${item.thicknessCm.toLocaleString('tr-TR')} cm`],
    ['Renk', item.color],
    ['Doku', item.texture],
  ]

  return (
    <Box
      ref={cardRef}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        p: 3,
        mb: 2,
        bgcolor: 'background.paper',
        textAlign: 'center',
      }}
    >
      {item.imageUrl ? (
        <Box
          component="img"
          src={item.imageUrl}
          crossOrigin="anonymous"
          alt={item.plateNo}
          sx={{
            maxWidth: '100%',
            maxHeight: 880,
            width: 'auto',
            height: 'auto',
            mb: 2,
            display: 'block',
            mx: 'auto',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 0.5,
            p: 0.5,
            boxSizing: 'border-box',
          }}
        />
      ) : (
        <Box
          sx={{
            maxWidth: '75%',
            height: 260,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'action.hover',
            borderRadius: 1,
            mb: 2,
            mx: 'auto',
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Görsel yok
          </Typography>
        </Box>
      )}
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
        {item.stoneName}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'auto auto auto auto',
          width: 'fit-content',
          maxWidth: '58%',
          mx: 'auto',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        {rows.map(([label], index) => (
          <Box
            key={`h-${label}`}
            sx={{
              fontSize: '0.5rem',
              fontWeight: 700,
              textAlign: 'center',
              px: 0.6,
              py: 0.2,
              borderRight: index < rows.length - 1 ? '1px solid' : 'none',
              borderColor: 'divider',
              bgcolor: 'action.hover',
            }}
          >
            {label}
          </Box>
        ))}
        {rows.map(([, value], index) => (
          <Box
            key={`v-${index}`}
            sx={{
              fontSize: '0.5rem',
              textAlign: 'center',
              px: 0.6,
              py: 0.2,
              borderTop: '1px solid',
              borderRight: index < rows.length - 1 ? '1px solid' : 'none',
              borderColor: 'divider',
            }}
          >
            {value}
          </Box>
        ))}
      </Box>
    </Box>
  )
}
