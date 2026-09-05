import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import QRCode from 'qrcode'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import {
  disableTwoFactor,
  enableTwoFactor,
  fetchTwoFactorStatus,
  setupTwoFactor,
  type TwoFactorSetup,
} from '../../api/twoFactor'
import { useCurrentUser } from '../../auth/useCurrentUser'

export function MyAccountPage() {
  const { user } = useCurrentUser()
  const queryClient = useQueryClient()
  const statusQuery = useQuery({ queryKey: ['twoFactorStatus'], queryFn: fetchTwoFactorStatus })

  const [setupOpen, setSetupOpen] = useState(false)
  const [setupData, setSetupData] = useState<(TwoFactorSetup & { qrDataUrl: string }) | null>(null)
  const [setupCode, setSetupCode] = useState('')
  const [setupError, setSetupError] = useState<string | null>(null)

  const [disableOpen, setDisableOpen] = useState(false)
  const [disableCode, setDisableCode] = useState('')
  const [disableError, setDisableError] = useState<string | null>(null)

  const setupMutation = useMutation({
    mutationFn: setupTwoFactor,
    onSuccess: async (data) => {
      const qrDataUrl = await QRCode.toDataURL(data.otpAuthUri, { width: 240, margin: 2 })
      setSetupData({ ...data, qrDataUrl })
      setSetupError(null)
    },
  })

  const enableMutation = useMutation({
    mutationFn: enableTwoFactor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['twoFactorStatus'] })
      setSetupOpen(false)
      setSetupData(null)
      setSetupCode('')
      setSetupError(null)
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Kod doğrulanamadı.'
      setSetupError(message)
    },
  })

  const disableMutation = useMutation({
    mutationFn: disableTwoFactor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['twoFactorStatus'] })
      setDisableOpen(false)
      setDisableCode('')
      setDisableError(null)
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Kod doğrulanamadı.'
      setDisableError(message)
    },
  })

  const openSetup = () => {
    setSetupOpen(true)
    setSetupData(null)
    setSetupCode('')
    setSetupError(null)
    setupMutation.mutate()
  }

  const closeSetup = () => {
    setSetupOpen(false)
    setSetupData(null)
    setSetupCode('')
    setSetupError(null)
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
        Hesabım
      </Typography>

      <Paper variant="outlined" sx={{ p: 3, maxWidth: 520 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
          {user?.firstName} {user?.lastName}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {user?.email}
        </Typography>

        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              İki Faktörlü Doğrulama (2FA)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Giriş yaparken authenticator uygulamasından ek bir kod istenir.
            </Typography>
          </Box>
          {!statusQuery.isLoading && (
            <Chip
              label={statusQuery.data ? 'Etkin' : 'Kapalı'}
              color={statusQuery.data ? 'success' : 'default'}
              size="small"
            />
          )}
        </Stack>

        <Box sx={{ mt: 2 }}>
          {statusQuery.data ? (
            <Button variant="outlined" color="error" onClick={() => setDisableOpen(true)}>
              2FA'yı Kapat
            </Button>
          ) : (
            <Button variant="contained" onClick={openSetup} disabled={statusQuery.isLoading}>
              2FA'yı Etkinleştir
            </Button>
          )}
        </Box>
      </Paper>

      <Dialog open={setupOpen} onClose={closeSetup} maxWidth="xs" fullWidth>
        <DialogTitle>İki Faktörlü Doğrulamayı Etkinleştir</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1, alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'flex-start' }}>
              Google Authenticator veya Microsoft Authenticator ile aşağıdaki QR kodu okutun, ardından
              uygulamada görünen 6 haneli kodu girin.
            </Typography>
            {setupData ? (
              <>
                <Box component="img" src={setupData.qrDataUrl} alt="2FA QR kod" sx={{ width: 200, height: 200 }} />
                <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all', textAlign: 'center' }}>
                  QR okutamıyorsanız bu kodu manuel girin: <strong>{setupData.secret}</strong>
                </Typography>
                <TextField
                  label="Doğrulama Kodu"
                  value={setupCode}
                  onChange={(e) => setSetupCode(e.target.value)}
                  fullWidth
                  autoFocus
                  slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 6 } }}
                />
                {setupError && (
                  <Alert severity="error" sx={{ width: '100%' }}>
                    {setupError}
                  </Alert>
                )}
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Hazırlanıyor…
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeSetup}>Vazgeç</Button>
          <Button
            variant="contained"
            disabled={!setupData || setupCode.length === 0 || enableMutation.isPending}
            onClick={() => enableMutation.mutate(setupCode)}
          >
            Etkinleştir
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={disableOpen}
        onClose={() => {
          setDisableOpen(false)
          setDisableCode('')
          setDisableError(null)
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>İki Faktörlü Doğrulamayı Kapat</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Kapatmak için authenticator uygulamanızdaki güncel 6 haneli kodu girin.
            </Typography>
            <TextField
              label="Doğrulama Kodu"
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value)}
              fullWidth
              autoFocus
              slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 6 } }}
            />
            {disableError && <Alert severity="error">{disableError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setDisableOpen(false)
              setDisableCode('')
              setDisableError(null)
            }}
          >
            Vazgeç
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={disableCode.length === 0 || disableMutation.isPending}
            onClick={() => disableMutation.mutate(disableCode)}
          >
            Kapat
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
