import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  IconButton,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import {
  createNotificationRecipient,
  deleteNotificationRecipient,
  fetchNotificationRecipients,
  fetchSystemSettings,
  sendTestEmail,
  setNotificationRecipientStatus,
  updateSystemSettings,
  uploadCompanyLogo,
} from '../../api/systemSettings'
import { ImageThumbnail } from '../../components/common/ImageThumbnail'

type FeedbackState = { kind: 'success' | 'error'; message: string } | null

const initialForm = {
  smtpHost: '',
  smtpPort: '587',
  smtpUsername: '',
  smtpPassword: '',
  smtpSenderEmail: '',
  smtpSenderName: '',
  smtpUseSsl: true,
  notifyNewStock: true,
  notifyLowStock: true,
  notifyPlateSold: true,
}

function CompanyInfoSection() {
  const queryClient = useQueryClient()
  const settingsQuery = useQuery({ queryKey: ['system-settings'], queryFn: fetchSystemSettings })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [companyName, setCompanyName] = useState('')
  const [feedback, setFeedback] = useState<FeedbackState>(null)
  const [logoFeedback, setLogoFeedback] = useState<FeedbackState>(null)

  useEffect(() => {
    setCompanyName(settingsQuery.data?.companyName ?? '')
  }, [settingsQuery.data])

  const saveMutation = useMutation({
    mutationFn: (name: string) => {
      const s = settingsQuery.data
      return updateSystemSettings({
        companyName: name.trim() || null,
        smtpHost: s?.smtpHost ?? null,
        smtpPort: s?.smtpPort ?? null,
        smtpUsername: s?.smtpUsername ?? null,
        smtpPassword: null,
        clearSmtpPassword: false,
        smtpSenderEmail: s?.smtpSenderEmail ?? null,
        smtpSenderName: s?.smtpSenderName ?? null,
        smtpUseSsl: s?.smtpUseSsl ?? true,
        notifyNewStock: s?.notifyNewStock ?? true,
        notifyLowStock: s?.notifyLowStock ?? true,
        notifyPlateSold: s?.notifyPlateSold ?? true,
      })
    },
    onSuccess: (data) => {
      setFeedback({ kind: 'success', message: data.message })
      queryClient.invalidateQueries({ queryKey: ['system-settings'] })
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Firma adı kaydedilemedi.'
      setFeedback({ kind: 'error', message })
    },
  })

  const logoMutation = useMutation({
    mutationFn: uploadCompanyLogo,
    onSuccess: (data) => {
      setLogoFeedback({ kind: 'success', message: data.message })
      queryClient.invalidateQueries({ queryKey: ['system-settings'] })
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Logo yüklenemedi.'
      setLogoFeedback({ kind: 'error', message })
    },
  })

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setLogoFeedback(null)
    logoMutation.mutate(file)
  }

  return (
    <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
        Firma Bilgileri
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Firma adı ve logosu giriş ekranında ve raporlarda kullanılır.
      </Typography>

      <Stack spacing={2} sx={{ alignItems: 'center' }}>
        <ImageThumbnail src={settingsQuery.data?.logoUrl ?? null} alt="Firma logosu" size={96} />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={handleLogoChange}
        />
        <Button
          variant="outlined"
          size="small"
          onClick={() => fileInputRef.current?.click()}
          disabled={logoMutation.isPending}
        >
          {logoMutation.isPending ? 'Yükleniyor…' : 'Logo Seç'}
        </Button>
        {logoFeedback && (
          <Alert severity={logoFeedback.kind} sx={{ width: '100%' }}>
            {logoFeedback.message}
          </Alert>
        )}

        <TextField
          label="Firma Adı"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          fullWidth
        />
        {feedback && (
          <Alert severity={feedback.kind} sx={{ width: '100%' }}>
            {feedback.message}
          </Alert>
        )}
        <Button
          variant="contained"
          onClick={() => {
            setFeedback(null)
            saveMutation.mutate(companyName)
          }}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? 'Kaydediliyor…' : 'Kaydet'}
        </Button>
      </Stack>
    </Paper>
  )
}

function SmtpSection() {
  const queryClient = useQueryClient()
  const settingsQuery = useQuery({ queryKey: ['system-settings'], queryFn: fetchSystemSettings })

  const [form, setForm] = useState(initialForm)
  const [hasPassword, setHasPassword] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [feedback, setFeedback] = useState<FeedbackState>(null)
  const [testFeedback, setTestFeedback] = useState<FeedbackState>(null)

  useEffect(() => {
    const s = settingsQuery.data
    if (!s) return
    setForm({
      smtpHost: s.smtpHost ?? '',
      smtpPort: s.smtpPort ? String(s.smtpPort) : '587',
      smtpUsername: s.smtpUsername ?? '',
      smtpPassword: '',
      smtpSenderEmail: s.smtpSenderEmail ?? '',
      smtpSenderName: s.smtpSenderName ?? '',
      smtpUseSsl: s.smtpUseSsl,
      notifyNewStock: s.notifyNewStock,
      notifyLowStock: s.notifyLowStock,
      notifyPlateSold: s.notifyPlateSold,
    })
    setHasPassword(s.hasSmtpPassword)
  }, [settingsQuery.data])

  const saveMutation = useMutation({
    mutationFn: updateSystemSettings,
    onSuccess: (data) => {
      setFeedback({ kind: 'success', message: data.message })
      queryClient.invalidateQueries({ queryKey: ['system-settings'] })
      setForm((prev) => ({ ...prev, smtpPassword: '' }))
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Ayarlar kaydedilemedi.'
      setFeedback({ kind: 'error', message })
    },
  })

  const testMutation = useMutation({
    mutationFn: sendTestEmail,
    onSuccess: (data) => setTestFeedback({ kind: 'success', message: data.message }),
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Test e-postası gönderilemedi.'
      setTestFeedback({ kind: 'error', message })
    },
  })

  const handleChange =
    (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
    }

  const handleSave = () => {
    setFeedback(null)
    saveMutation.mutate({
      companyName: settingsQuery.data?.companyName ?? null,
      smtpHost: form.smtpHost || null,
      smtpPort: form.smtpPort ? Number(form.smtpPort) : null,
      smtpUsername: form.smtpUsername || null,
      smtpPassword: form.smtpPassword || null,
      clearSmtpPassword: false,
      smtpSenderEmail: form.smtpSenderEmail || null,
      smtpSenderName: form.smtpSenderName || null,
      smtpUseSsl: form.smtpUseSsl,
      notifyNewStock: form.notifyNewStock,
      notifyLowStock: form.notifyLowStock,
      notifyPlateSold: form.notifyPlateSold,
    })
  }

  const handleSendTest = () => {
    setTestFeedback(null)
    if (!testEmail.trim()) return
    testMutation.mutate(testEmail.trim())
  }

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
        SMTP / E-posta Bildirimleri
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Yeni Stok, Düşük Stok ve Plaka Satıldı olaylarında gönderilecek e-postalar için SMTP
        sunucu bilgileri.
      </Typography>
      <Stack spacing={2}>
        <Stack direction="row" spacing={2}>
          <TextField
            label="SMTP Sunucu"
            value={form.smtpHost}
            onChange={handleChange('smtpHost')}
            placeholder="smtp.gmail.com"
            fullWidth
          />
          <TextField
            label="Port"
            value={form.smtpPort}
            onChange={handleChange('smtpPort')}
            sx={{ maxWidth: 140 }}
          />
        </Stack>
        <TextField label="Kullanıcı Adı" value={form.smtpUsername} onChange={handleChange('smtpUsername')} fullWidth />
        <TextField
          label={hasPassword ? 'Şifre (değiştirmek için girin)' : 'Şifre'}
          type="password"
          value={form.smtpPassword}
          onChange={handleChange('smtpPassword')}
          placeholder={hasPassword ? '••••••••' : ''}
          fullWidth
        />
        <Stack direction="row" spacing={2}>
          <TextField
            label="Gönderen E-posta"
            value={form.smtpSenderEmail}
            onChange={handleChange('smtpSenderEmail')}
            fullWidth
          />
          <TextField
            label="Gönderen Adı"
            value={form.smtpSenderName}
            onChange={handleChange('smtpSenderName')}
            fullWidth
          />
        </Stack>
        <FormControlLabel
          control={
            <Switch
              checked={form.smtpUseSsl}
              onChange={(e) => setForm((prev) => ({ ...prev, smtpUseSsl: e.target.checked }))}
            />
          }
          label="SSL/TLS kullan"
        />

        <Stack direction="row" spacing={3} sx={{ pt: 1 }}>
          <FormControlLabel
            control={
              <Switch
                checked={form.notifyNewStock}
                onChange={(e) => setForm((prev) => ({ ...prev, notifyNewStock: e.target.checked }))}
              />
            }
            label="Yeni Stok"
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.notifyLowStock}
                onChange={(e) => setForm((prev) => ({ ...prev, notifyLowStock: e.target.checked }))}
              />
            }
            label="Düşük Stok"
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.notifyPlateSold}
                onChange={(e) => setForm((prev) => ({ ...prev, notifyPlateSold: e.target.checked }))}
              />
            }
            label="Plaka Satıldı"
          />
        </Stack>

        {feedback && <Alert severity={feedback.kind}>{feedback.message}</Alert>}

        <Button variant="contained" onClick={handleSave} disabled={saveMutation.isPending} sx={{ alignSelf: 'flex-start' }}>
          {saveMutation.isPending ? 'Kaydediliyor…' : 'Kaydet'}
        </Button>

        <Stack direction="row" spacing={1} sx={{ pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <TextField
            size="small"
            label="Test alıcı e-postası"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            fullWidth
            sx={{ mt: 2 }}
          />
        </Stack>
        <Button
          variant="outlined"
          onClick={handleSendTest}
          disabled={testMutation.isPending || !testEmail.trim()}
          sx={{ alignSelf: 'flex-start' }}
        >
          {testMutation.isPending ? 'Gönderiliyor…' : 'Test E-postası Gönder'}
        </Button>
        {testFeedback && <Alert severity={testFeedback.kind}>{testFeedback.message}</Alert>}
      </Stack>
    </Paper>
  )
}

function RecipientsSection() {
  const queryClient = useQueryClient()
  const recipientsQuery = useQuery({
    queryKey: ['notification-recipients'],
    queryFn: fetchNotificationRecipients,
  })
  const [newEmail, setNewEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['notification-recipients'] })

  const createMutation = useMutation({
    mutationFn: createNotificationRecipient,
    onSuccess: () => {
      invalidate()
      setNewEmail('')
      setError(null)
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Alıcı eklenemedi.'
      setError(message)
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => setNotificationRecipientStatus(id, active),
    onSuccess: invalidate,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteNotificationRecipient,
    onSuccess: invalidate,
  })

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
        Bildirim Alıcıları
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Yeni Stok / Düşük Stok / Plaka Satıldı e-postaları aşağıdaki aktif adreslere gönderilir.
      </Typography>

      <Stack spacing={1.5} sx={{ mb: 2 }}>
        {recipientsQuery.data?.map((r) => (
          <Stack key={r.id} direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Chip
              label={r.isActive ? 'Aktif' : 'Pasif'}
              size="small"
              color={r.isActive ? 'success' : 'default'}
              variant={r.isActive ? 'filled' : 'outlined'}
            />
            <Typography variant="body2" sx={{ flex: 1 }}>
              {r.email}
            </Typography>
            <Switch
              size="small"
              checked={r.isActive}
              onChange={(e) => statusMutation.mutate({ id: r.id, active: e.target.checked })}
            />
            <IconButton size="small" color="error" onClick={() => deleteMutation.mutate(r.id)}>
              <DeleteOutlinedIcon fontSize="small" />
            </IconButton>
          </Stack>
        ))}
        {recipientsQuery.data?.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            Henüz alıcı eklenmedi.
          </Typography>
        )}
      </Stack>

      <Stack direction="row" spacing={1}>
        <TextField
          size="small"
          label="E-posta ekle"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && newEmail.trim() && createMutation.mutate(newEmail.trim())}
          fullWidth
        />
        <Button
          variant="outlined"
          disabled={!newEmail.trim() || createMutation.isPending}
          onClick={() => createMutation.mutate(newEmail.trim())}
        >
          Ekle
        </Button>
      </Stack>
      {error && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {error}
        </Alert>
      )}
    </Paper>
  )
}

export function SystemSettingsPage() {
  return (
    <Box sx={{ maxWidth: 560, mx: 'auto', mt: 2, mb: 6, px: 2 }}>
      <Typography variant="h5" sx={{ fontWeight: 600 }} gutterBottom>
        Sistem Ayarları
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        E-posta bildirimleri için SMTP sunucusunu ve alıcı listesini yapılandırın.
      </Typography>

      <Stack spacing={3}>
        <CompanyInfoSection />
        <SmtpSection />
        <RecipientsSection />
      </Stack>
    </Box>
  )
}
