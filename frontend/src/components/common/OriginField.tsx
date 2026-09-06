import { Autocomplete, TextField } from '@mui/material'
import { COUNTRIES } from '../../constants/countries'

interface OriginFieldProps {
  value: string
  onChange: (value: string) => void
}

export function OriginField({ value, onChange }: OriginFieldProps) {
  return (
    <Autocomplete
      options={COUNTRIES}
      value={value || null}
      onChange={(_, newValue) => onChange(newValue ?? '')}
      renderInput={(params) => <TextField {...params} label="Menşei" fullWidth />}
    />
  )
}
