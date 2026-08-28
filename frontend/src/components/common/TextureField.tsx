import { Autocomplete, Box, IconButton, TextField, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/CloseOutlined'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createTexture, deleteTexture, fetchTextures } from '../../api/catalog'

interface TextureFieldProps {
  value: string
  onChange: (value: string) => void
}

export function TextureField({ value, onChange }: TextureFieldProps) {
  const queryClient = useQueryClient()
  const texturesQuery = useQuery({ queryKey: ['textures'], queryFn: fetchTextures })

  const deleteMutation = useMutation({
    mutationFn: deleteTexture,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['textures'] }),
  })

  const createMutation = useMutation({
    mutationFn: createTexture,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['textures'] }),
  })

  const options = texturesQuery.data ?? []

  return (
    <Autocomplete
      freeSolo
      options={options.map((o) => o.name)}
      inputValue={value}
      onInputChange={(_, newValue, reason) => {
        // 'reset', bir seçenek işaretlenip odak kaybedildiğinde MUI'nin metni o seçeneğin
        // etiketiyle değiştirmesidir; bunu yoksaymazsak, mevcut bir dokunun ön ekini yazıp
        // Enter'a basmak, kullanıcının yeni girdisini o mevcut değerle değiştirirdi.
        if (reason !== 'reset') {
          onChange(newValue)
        }
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return
        const trimmed = value.trim()
        if (!trimmed) return
        const exists = options.some((o) => o.name.toLowerCase() === trimmed.toLowerCase())
        if (!exists) {
          createMutation.mutate(trimmed)
        }
      }}
      renderOption={(liProps, option) => {
        const match = options.find((o) => o.name === option)
        return (
          <li {...liProps} key={option}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <Typography variant="body2">{option}</Typography>
              {match && (
                <IconButton
                  size="small"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteMutation.mutate(match.id)
                  }}
                >
                  <CloseIcon fontSize="inherit" />
                </IconButton>
              )}
            </Box>
          </li>
        )
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Doku"
          fullWidth
          helperText="Listede yoksa yazıp Enter'a basarak yeni bir değer ekleyebilirsiniz."
        />
      )}
    />
  )
}
