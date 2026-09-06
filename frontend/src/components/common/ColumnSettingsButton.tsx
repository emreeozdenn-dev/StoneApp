import { useMemo, useState } from 'react'
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
} from '@mui/material'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import ViewColumnOutlinedIcon from '@mui/icons-material/ViewColumnOutlined'
import type { ColumnDef, useColumnPreferences } from './useColumnPreferences'

interface ColumnSettingsButtonProps<Key extends string> {
  columns: ColumnDef<Key>[]
  prefs: ReturnType<typeof useColumnPreferences<Key>>
}

export function ColumnSettingsButton<Key extends string>({ columns, prefs }: ColumnSettingsButtonProps<Key>) {
  const [open, setOpen] = useState(false)
  const [draggedKey, setDraggedKey] = useState<Key | null>(null)
  const [dragOverKey, setDragOverKey] = useState<Key | null>(null)
  const labelByKey = useMemo(() => new Map(columns.map((c) => [c.key, c.label])), [columns])

  return (
    <>
      <Button size="small" variant="outlined" startIcon={<ViewColumnOutlinedIcon />} onClick={() => setOpen(true)}>
        Kolonlar
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Kolonları Düzenle</DialogTitle>
        <DialogContent>
          <List dense disablePadding>
            {prefs.order.map((key, index) => (
              <ListItem
                key={key}
                disableGutters
                draggable
                onDragStart={() => setDraggedKey(key)}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (dragOverKey !== key) setDragOverKey(key)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  if (draggedKey && draggedKey !== key) {
                    prefs.reorderTo(draggedKey, key)
                  }
                  setDraggedKey(null)
                  setDragOverKey(null)
                }}
                onDragEnd={() => {
                  setDraggedKey(null)
                  setDragOverKey(null)
                }}
                sx={{
                  opacity: draggedKey === key ? 0.4 : 1,
                  bgcolor: dragOverKey === key && draggedKey !== key ? 'action.hover' : undefined,
                  borderTop: dragOverKey === key && draggedKey !== key ? '2px solid' : '2px solid transparent',
                  borderTopColor: dragOverKey === key && draggedKey !== key ? 'primary.main' : 'transparent',
                }}
                secondaryAction={
                  <Stack direction="row" spacing={0.5}>
                    <IconButton
                      size="small"
                      disabled={index === 0}
                      onClick={() => prefs.moveUp(key)}
                      aria-label="Yukarı taşı"
                    >
                      <ArrowUpwardIcon fontSize="inherit" />
                    </IconButton>
                    <IconButton
                      size="small"
                      disabled={index === prefs.order.length - 1}
                      onClick={() => prefs.moveDown(key)}
                      aria-label="Aşağı taşı"
                    >
                      <ArrowDownwardIcon fontSize="inherit" />
                    </IconButton>
                  </Stack>
                }
              >
                <DragIndicatorIcon
                  fontSize="small"
                  sx={{ color: 'text.disabled', mr: 0.5, cursor: 'grab' }}
                />
                <Checkbox
                  edge="start"
                  size="small"
                  checked={!prefs.hidden.has(key)}
                  onChange={() => prefs.toggleVisible(key)}
                />
                <ListItemText primary={labelByKey.get(key) ?? key} />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={prefs.reset}>Varsayılana Dön</Button>
          <Button variant="contained" onClick={() => setOpen(false)}>
            Kapat
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
