import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { fetchSetupRequired, setupAdmin } from '../../api/auth'

export function SetupPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null)

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchSetupRequired().then(setSetupRequired)
  }, [])

  if (setupRequired === false) {
    return <Navigate to="/giris" replace />
  }

  const handleChange = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await setupAdmin(form)
      await queryClient.invalidateQueries({ queryKey: ['currentUser'] })
      navigate('/', { replace: true })
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Kurulum başarısız oldu.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        px: 2,
      }}
    >
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 }, width: '100%', maxWidth: 420 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
          İlk Kurulum
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Sistemde henüz kullanıcı yok. İlk Admin hesabını oluşturun.
        </Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={2}>
              <TextField label="Ad" value={form.firstName} onChange={handleChange('firstName')} fullWidth />
              <TextField label="Soyad" value={form.lastName} onChange={handleChange('lastName')} fullWidth />
            </Stack>
            <TextField label="Kullanıcı Adı" value={form.username} onChange={handleChange('username')} fullWidth />
            <TextField label="E-posta" value={form.email} onChange={handleChange('email')} fullWidth />
            <TextField
              label="Şifre"
              type="password"
              value={form.password}
              onChange={handleChange('password')}
              fullWidth
            />
            {error && <Alert severity="error">{error}</Alert>}
            <Button type="submit" variant="contained" size="large" disabled={submitting}>
              {submitting ? 'Oluşturuluyor…' : 'Admin Hesabı Oluştur'}
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  )
}
