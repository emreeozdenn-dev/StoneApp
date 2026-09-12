import { Paper, Typography } from '@mui/material'

export function StatTile({
  label,
  value,
  status,
}: {
  label: string
  value: string | number
  status?: 'warning'
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        flex: '1 1 200px',
        minWidth: 180,
        borderLeft: 3,
        borderLeftColor: status ? 'warning.main' : 'primary.main',
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5, color: status ? 'warning.main' : 'text.primary' }}>
        {value}
      </Typography>
    </Paper>
  )
}
