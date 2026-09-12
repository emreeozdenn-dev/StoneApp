import { useRef, useState } from 'react'
import { Box, Typography } from '@mui/material'
import CloudUploadIcon from '@mui/icons-material/CloudUploadOutlined'

interface ImageDropzoneProps {
  file: File | null
  existingUrl?: string | null
  onChange: (file: File) => void
  size?: number
}

export function ImageDropzone({ file, existingUrl, onChange, size = 160 }: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const previewUrl = file ? URL.createObjectURL(file) : (existingUrl ?? null)

  return (
    <Box>
      <Box
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const dropped = e.dataTransfer.files?.[0]
          if (dropped) onChange(dropped)
        }}
        sx={{
          width: size,
          height: size,
          borderRadius: 2.5,
          cursor: 'pointer',
          border: '1.5px dashed',
          borderColor: dragOver ? 'primary.main' : 'divider',
          bgcolor: dragOver ? 'action.selected' : 'action.hover',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.75,
          overflow: 'hidden',
          textAlign: 'center',
          p: previewUrl ? 0 : 2,
        }}
      >
        {previewUrl ? (
          <Box
            component="img"
            src={previewUrl}
            alt="Önizleme"
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <>
            <CloudUploadIcon sx={{ color: 'primary.main' }} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Görsel yükle
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Sürükleyin veya seçin
            </Typography>
          </>
        )}
      </Box>
      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
        JPEG, PNG veya WEBP
        <br />
        Maks. 5 MB
      </Typography>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const selected = e.target.files?.[0]
          if (selected) onChange(selected)
        }}
      />
    </Box>
  )
}
