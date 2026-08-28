import { useEffect, useState } from 'react'
import { Link as RouterLink, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
import { fetchSetupRequired, login } from '../../api/auth'
import { fetchCompanyBranding } from '../../api/systemSettings'
import { useCurrentUser } from '../../auth/useCurrentUser'

export function LoginPage() {
  const { user, isLoading } = useCurrentUser()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const brandingQuery = useQuery({ queryKey: ['company-branding'], queryFn: fetchCompanyBranding })
  const branding = brandingQuery.data

  const [usernameOrEmail, setUsernameOrEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null)

  useEffect(() => {
    fetchSetupRequired().then(setSetupRequired)
  }, [])

  if (!isLoading && user) {
    return <Navigate to="/" replace />
  }

  if (setupRequired) {
    return <Navigate to="/kurulum" replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(usernameOrEmail, password)
      await queryClient.invalidateQueries({ queryKey: ['currentUser'] })
      const returnUrl = searchParams.get('returnUrl')
      navigate(returnUrl ? decodeURIComponent(returnUrl) : '/', { replace: true })
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Giriş başarısız oldu.'
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
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 }, width: '100%', maxWidth: 380 }}>
        {branding?.logoUrl && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <Box
              component="img"
              src={branding.logoUrl}
              alt="Firma logosu"
              sx={{ height: 128, width: 128, objectFit: 'contain', borderRadius: 1 }}
            />
          </Box>
        )}
        <Typography variant="h6" sx={{ fontWeight: 700, textAlign: 'center', mb: 0.5 }}>
          Mermer Stok Yönetimi Sistemi
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mb: 3 }}>
          Devam etmek için giriş yapın
        </Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={2}>
            <TextField
              label="Kullanıcı adı veya e-posta"
              value={usernameOrEmail}
              onChange={(e) => setUsernameOrEmail(e.target.value)}
              autoFocus
              fullWidth
            />
            <TextField
              label="Şifre"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
            />
            {error && <Alert severity="error">{error}</Alert>}
            <Button type="submit" variant="contained" size="large" disabled={submitting}>
              {submitting ? 'Giriş yapılıyor…' : 'Giriş Yap'}
            </Button>
            <Link component={RouterLink} to="/sifremi-unuttum" variant="body2" sx={{ textAlign: 'center' }}>
              Şifremi unuttum
            </Link>
          </Stack>
        </Box>
      </Paper>
    </Box>
  )
}
