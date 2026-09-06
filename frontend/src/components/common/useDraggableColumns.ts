import type { DragEvent } from 'react'
import { useState } from 'react'
import type { SxProps, Theme } from '@mui/material'

export function useDraggableColumns<Key extends string>(reorderTo: (draggedKey: Key, targetKey: Key) => void) {
  const [draggedKey, setDraggedKey] = useState<Key | null>(null)
  const [dragOverKey, setDragOverKey] = useState<Key | null>(null)

  function getHeaderCellProps(key: Key) {
    const isDragged = draggedKey === key
    const isDragOver = dragOverKey === key && draggedKey !== key

    const sx: SxProps<Theme> = {
      cursor: 'grab',
      userSelect: 'none',
      opacity: isDragged ? 0.4 : 1,
      bgcolor: isDragOver ? 'action.hover' : undefined,
      borderLeft: '2px solid',
      borderLeftColor: isDragOver ? 'primary.main' : 'transparent',
    }

    return {
      draggable: true,
      onDragStart: () => setDraggedKey(key),
      onDragOver: (e: DragEvent) => {
        e.preventDefault()
        if (dragOverKey !== key) setDragOverKey(key)
      },
      onDrop: (e: DragEvent) => {
        e.preventDefault()
        if (draggedKey && draggedKey !== key) {
          reorderTo(draggedKey, key)
        }
        setDraggedKey(null)
        setDragOverKey(null)
      },
      onDragEnd: () => {
        setDraggedKey(null)
        setDragOverKey(null)
      },
      sx,
    }
  }

  return { draggedKey, dragOverKey, getHeaderCellProps }
}
