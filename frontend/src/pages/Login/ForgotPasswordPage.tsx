import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { forgotPassword } from '../../api/auth'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const { message } = await forgotPassword(email)
      setResult(message)
    } catch {
      setError('Bir hata oluştu, lütfen tekrar deneyin.')
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
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 }, width: '100%', maxWidth: 380 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, textAlign: 'center', mb: 0.5 }}>
          Şifremi Unuttum
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mb: 3 }}>
          Kayıtlı e-posta adresinizi girin, yeni şifreniz gönderilsin.
        </Typography>

        {result ? (
          <Stack spacing={2}>
            <Alert severity="success">{result}</Alert>
            <Button component={RouterLink} to="/giris" variant="contained" size="large">
              Giriş sayfasına dön
            </Button>
          </Stack>
        ) : (
          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={2}>
              <TextField
                label="E-posta adresi"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                fullWidth
                required
              />
              {error && <Alert severity="error">{error}</Alert>}
              <Button type="submit" variant="contained" size="large" disabled={submitting}>
                {submitting ? 'Gönderiliyor…' : 'Yeni Şifre Gönder'}
              </Button>
              <Link component={RouterLink} to="/giris" variant="body2" sx={{ textAlign: 'center' }}>
                Giriş sayfasına dön
              </Link>
            </Stack>
          </Box>
        )}
      </Paper>
    </Box>
  )
}
