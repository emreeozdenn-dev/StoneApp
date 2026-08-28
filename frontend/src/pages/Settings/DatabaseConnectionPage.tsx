import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { apiClient } from '../../api/client'

type FeedbackState = { kind: 'success' | 'error'; message: string } | null

interface ConnectionForm {
  server: string
  port: string
  database: string
  userId: string
  password: string
}

const initialConnectionForm: ConnectionForm = {
  server: '',
  port: '5432',
  database: 'postgres',
  userId: 'postgres',
  password: '',
}

function DatabaseConnectionSection() {
  const [form, setForm] = useState<ConnectionForm>(initialConnectionForm)
  const [feedback, setFeedback] = useState<FeedbackState>(null)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleChange = (field: keyof ConnectionForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const toPayload = () => ({
    server: form.server,
    port: Number(form.port),
    database: form.database,
    userId: form.userId,
    password: form.password,
  })

  const handleTest = async () => {
    setTesting(true)
    setFeedback(null)
    try {
      const { data } = await apiClient.post('/settings/connection/test', toPayload())
      setFeedback({ kind: data.success ? 'success' : 'error', message: data.message })
    } catch {
      setFeedback({ kind: 'error', message: 'Test isteği başarısız oldu. API çalışıyor mu kontrol edin.' })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setFeedback(null)
    try {
      const { data } = await apiClient.post('/settings/connection', toPayload())
      setFeedback({ kind: 'success', message: data.message })
    } catch {
      setFeedback({ kind: 'error', message: 'Kaydetme başarısız oldu.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
        Postgres Bağlantısı
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Supabase projenizin Database ayarlarındaki "Connection string" bilgileri (doğrudan
        bağlantı, pooler değil).
      </Typography>
      <Stack spacing={2}>
        <TextField
          label="Sunucu (Host)"
          value={form.server}
          onChange={handleChange('server')}
          placeholder="db.xxxxxxxxxxxx.supabase.co"
          fullWidth
        />
        <TextField label="Port" value={form.port} onChange={handleChange('port')} fullWidth />
        <TextField label="Veritabanı Adı" value={form.database} onChange={handleChange('database')} fullWidth />
        <TextField label="Kullanıcı Adı" value={form.userId} onChange={handleChange('userId')} fullWidth />
        <TextField
          label="Şifre"
          type="password"
          value={form.password}
          onChange={handleChange('password')}
          fullWidth
        />

        {feedback && <Alert severity={feedback.kind}>{feedback.message}</Alert>}

        <Stack direction="row" spacing={2}>
          <Button variant="outlined" onClick={handleTest} disabled={testing}>
            {testing ? 'Test ediliyor…' : 'Bağlantıyı Test Et'}
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  )
}

interface SupabaseForm {
  projectUrl: string
  anonKey: string
  serviceRoleKey: string
}

const initialSupabaseForm: SupabaseForm = {
  projectUrl: '',
  anonKey: '',
  serviceRoleKey: '',
}

function SupabaseSection() {
  const [form, setForm] = useState<SupabaseForm>(initialSupabaseForm)
  const [feedback, setFeedback] = useState<FeedbackState>(null)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleChange = (field: keyof SupabaseForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const toPayload = () => ({
    projectUrl: form.projectUrl,
    anonKey: form.anonKey,
    serviceRoleKey: form.serviceRoleKey,
  })

  const handleTest = async () => {
    setTesting(true)
    setFeedback(null)
    try {
      const { data } = await apiClient.post('/settings/supabase/test', toPayload())
      setFeedback({ kind: data.success ? 'success' : 'error', message: data.message })
    } catch {
      setFeedback({ kind: 'error', message: 'Test isteği başarısız oldu. API çalışıyor mu kontrol edin.' })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setFeedback(null)
    try {
      const { data } = await apiClient.post('/settings/supabase', toPayload())
      setFeedback({ kind: 'success', message: data.message })
    } catch {
      setFeedback({ kind: 'error', message: 'Kaydetme başarısız oldu.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
        Supabase (Auth + Storage)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Project Settings &rsaquo; API sayfasından alınır. Service role key gizli tutulur, hiçbir
        API yanıtında geri dönmez.
      </Typography>
      <Stack spacing={2}>
        <TextField
          label="Project URL"
          value={form.projectUrl}
          onChange={handleChange('projectUrl')}
          placeholder="https://xxxxxxxxxxxx.supabase.co"
          fullWidth
        />
        <TextField label="anon key" value={form.anonKey} onChange={handleChange('anonKey')} fullWidth />
        <TextField
          label="service role key"
          type="password"
          value={form.serviceRoleKey}
          onChange={handleChange('serviceRoleKey')}
          fullWidth
        />

        {feedback && <Alert severity={feedback.kind}>{feedback.message}</Alert>}

        <Stack direction="row" spacing={2}>
          <Button variant="outlined" onClick={handleTest} disabled={testing}>
            {testing ? 'Test ediliyor…' : 'Bağlantıyı Test Et'}
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  )
}

export function DatabaseConnectionPage() {
  return (
    <Box sx={{ maxWidth: 560, mx: 'auto', mt: 6, mb: 6, px: 2 }}>
      <Typography variant="h5" sx={{ fontWeight: 600 }} gutterBottom>
        Ayarlar &rsaquo; Supabase Bağlantısı
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Her iki bölümü de doldurup test edin, ardından kaydedin. Kayıttan sonra API'nin yeniden
        başlatılması gerekir.
      </Typography>

      <Stack spacing={3}>
        <DatabaseConnectionSection />
        <SupabaseSection />
      </Stack>
    </Box>
  )
}
