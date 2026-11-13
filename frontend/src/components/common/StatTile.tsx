import { Paper, Typography } from '@mui/material'

export function StatTile({
  label,
  value,
  status,
  dense,
}: {
  label: string
  value: string | number
  status?: 'warning'
  /** Etiket ve değeri tek satırda gösterir; kutu yüksekliği yarıya iner. */
  dense?: boolean
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: dense ? 0 : 2,
        px: dense ? 1.5 : undefined,
        py: dense ? 0.75 : undefined,
        flex: '1 1 200px',
        minWidth: 180,
        borderLeft: 3,
        borderLeftColor: status ? 'warning.main' : 'primary.main',
        ...(dense && { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1.5 }),
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={dense ? { whiteSpace: 'nowrap' } : undefined}>
        {label}
      </Typography>
      <Typography
        variant={dense ? 'subtitle1' : 'h6'}
        sx={{
          fontWeight: 700,
          mt: dense ? 0 : 0.5,
          color: status ? 'warning.main' : 'text.primary',
          whiteSpace: dense ? 'nowrap' : undefined,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </Typography>
    </Paper>
  )
}
