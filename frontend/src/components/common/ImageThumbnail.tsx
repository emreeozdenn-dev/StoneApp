import { useState } from 'react'
import { Box, Dialog, DialogContent, IconButton } from '@mui/material'
import CloseIcon from '@mui/icons-material/CloseOutlined'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'

interface ImageThumbnailProps {
  src?: string | null
  alt: string
  size?: number
}

export function ImageThumbnail({ src, alt, size = 44 }: ImageThumbnailProps) {
  const [open, setOpen] = useState(false)

  if (!src) {
    return (
      <Box
        sx={{
          width: size,
          height: size,
          borderRadius: 1.5,
          bgcolor: 'action.hover',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'text.disabled',
        }}
      >
        <ImageOutlinedIcon fontSize="small" />
      </Box>
    )
  }

  return (
    <>
      <Box
        component="img"
        src={src}
        alt={alt}
        onClick={() => setOpen(true)}
        sx={{
          width: size,
          height: size,
          borderRadius: 1.5,
          objectFit: 'cover',
          cursor: 'zoom-in',
          border: '1px solid',
          borderColor: 'divider',
        }}
      />
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="lg">
        <IconButton
          onClick={() => setOpen(false)}
          sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'background.paper' }}
        >
          <CloseIcon />
        </IconButton>
        <DialogContent sx={{ p: 0, display: 'flex' }}>
          <Box component="img" src={src} alt={alt} sx={{ maxWidth: '90vw', maxHeight: '85vh', display: 'block' }} />
        </DialogContent>
      </Dialog>
    </>
  )
}
