import { Box, Typography } from '@mui/material'

export function ComingSoonPage({ title }: { title: string }) {
  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Bu ekran ileriki bir fazda tamamlanacak.
      </Typography>
    </Box>
  )
}
