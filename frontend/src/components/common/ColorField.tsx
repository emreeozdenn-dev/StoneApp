import { Autocomplete, Box, Chip, IconButton, TextField, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/CloseOutlined'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createColor, deleteColor, fetchColors } from '../../api/catalog'

interface ColorFieldProps {
  value: string[]
  onChange: (value: string[]) => void
}

export function ColorField({ value, onChange }: ColorFieldProps) {
  const queryClient = useQueryClient()
  const colorsQuery = useQuery({ queryKey: ['colors'], queryFn: fetchColors })

  const deleteMutation = useMutation({
    mutationFn: deleteColor,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['colors'] }),
  })

  const createMutation = useMutation({
    mutationFn: createColor,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['colors'] }),
  })

  const options = colorsQuery.data ?? []

  return (
    <Autocomplete
      multiple
      freeSolo
      options={options.map((o) => o.name)}
      value={value}
      onChange={(_, newValue) => {
        const cleaned = newValue.map((v) => v.trim()).filter((v) => v.length > 0)
        const deduped = cleaned.filter(
          (v, i) => cleaned.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i,
        )
        onChange(deduped)
        deduped.forEach((v) => {
          const exists = options.some((o) => o.name.toLowerCase() === v.toLowerCase())
          if (!exists) {
            createMutation.mutate(v)
          }
        })
      }}
      renderValue={(value, getItemProps) =>
        value.map((option, index) => {
          const { key, ...rest } = getItemProps({ index })
          return <Chip label={option} size="small" key={key} {...rest} />
        })
      }
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
          label="Renk"
          fullWidth
          helperText="Listeden birden fazla renk seçebilir veya yazıp Enter'a basarak yeni bir renk ekleyebilirsiniz."
        />
      )}
    />
  )
}
