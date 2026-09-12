import type { ReactNode } from 'react'
import { Divider, Stack, Typography } from '@mui/material'

export function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1.75 }}>
      <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main', whiteSpace: 'nowrap' }}>
        {children}
      </Typography>
      <Divider sx={{ flex: 1 }} />
    </Stack>
  )
}
