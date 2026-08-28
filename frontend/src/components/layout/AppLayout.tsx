import { Outlet, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  Drawer,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material'
import LogoutIcon from '@mui/icons-material/LogoutOutlined'
import { logout } from '../../api/auth'
import { fetchCompanyBranding } from '../../api/systemSettings'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { Sidebar } from './Sidebar'

const DRAWER_WIDTH = 240

export function AppLayout() {
  const { user } = useCurrentUser()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const brandingQuery = useQuery({ queryKey: ['company-branding'], queryFn: fetchCompanyBranding, enabled: !!user })
  const branding = brandingQuery.data

  const handleLogout = async () => {
    try {
      await logout()
    } catch {
      // Oturum zaten geçersizse sunucu çağrısı başarısız olabilir; yine de yerel oturumu temizleyip yönlendiriyoruz.
    } finally {
      // setQueryData(key, undefined) TanStack Query tarafından "değiştirme" olarak yorumlanıp
      // yoksayılır; eski kullanıcı önbellekte kalır ve giriş sayfası "zaten girişli" sanıp geri
      // yönlendirir. removeQueries önbelleği tamamen temizler.
      queryClient.removeQueries({ queryKey: ['currentUser'] })
      navigate('/giris', { replace: true })
    }
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', border: 'none', bgcolor: 'background.paper' },
        }}
      >
        <Box sx={{ px: 3, py: 2.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
            Mermer Stok Yönetimi
          </Typography>
          {branding?.companyName && (
            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
              {branding.companyName}
            </Typography>
          )}
        </Box>
        {user && <Sidebar permissions={user.permissions} />}
      </Drawer>

      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <AppBar
          position="static"
          color="transparent"
          elevation={0}
          sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
        >
          <Toolbar sx={{ gap: 2, minHeight: 280, py: 3 }}>
            <Box sx={{ flex: 1 }} />

            {branding?.logoUrl && (
              <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                <Box
                  component="img"
                  src={branding.logoUrl}
                  alt="Firma logosu"
                  sx={{ height: 256, width: 256, objectFit: 'contain', borderRadius: 1 }}
                />
              </Box>
            )}

            <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
              {user && (
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                  <Chip label={user.role} size="small" color="primary" variant="outlined" />
                  <Avatar sx={{ width: 32, height: 32, fontSize: 14 }}>
                    {user.firstName.charAt(0)}
                    {user.lastName.charAt(0)}
                  </Avatar>
                  <Typography variant="body2">
                    {user.firstName} {user.lastName}
                  </Typography>
                  <Button size="small" startIcon={<LogoutIcon />} onClick={handleLogout}>
                    Çıkış Yap
                  </Button>
                </Stack>
              )}
            </Box>
          </Toolbar>
        </AppBar>

        <Box sx={{ flexGrow: 1, minWidth: 0, p: 3 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}
