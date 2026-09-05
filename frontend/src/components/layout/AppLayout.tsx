import { useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  Drawer,
  IconButton,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material'
import LogoutIcon from '@mui/icons-material/LogoutOutlined'
import MenuIcon from '@mui/icons-material/MenuOutlined'
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
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    document.title = branding?.companyName || 'Mermer Stok Yönetimi'
  }, [branding?.companyName])

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

  const drawerContent = (
    <>
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
      {user && <Sidebar permissions={user.permissions} onNavigate={() => setMobileOpen(false)} />}
    </>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', bgcolor: 'background.paper' },
          }}
        >
          {drawerContent}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', border: 'none', bgcolor: 'background.paper' },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>

      <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <AppBar
          position="static"
          color="transparent"
          elevation={0}
          sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
        >
          <Toolbar sx={{ gap: 1, minHeight: { xs: 64, md: 280 }, py: { xs: 1, md: 3 } }}>
            <IconButton
              edge="start"
              onClick={() => setMobileOpen(true)}
              sx={{ display: { xs: 'inline-flex', md: 'none' } }}
            >
              <MenuIcon />
            </IconButton>

            <Box sx={{ flex: 1, display: { xs: 'none', md: 'block' } }} />

            {branding?.logoUrl && (
              <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                <Box
                  component="img"
                  src={branding.logoUrl}
                  alt="Firma logosu"
                  sx={{ height: { xs: 44, md: 256 }, width: { xs: 44, md: 256 }, objectFit: 'contain', borderRadius: 1 }}
                />
              </Box>
            )}

            <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
              {user && (
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Chip label={user.role} size="small" color="primary" variant="outlined" sx={{ display: { xs: 'none', sm: 'inline-flex' } }} />
                  <Button
                    size="small"
                    onClick={() => navigate('/hesabim')}
                    sx={{ minWidth: 0, textTransform: 'none', color: 'text.primary' }}
                  >
                    <Avatar sx={{ width: 32, height: 32, fontSize: 14, mr: { xs: 0, sm: 1 } }}>
                      {user.firstName.charAt(0)}
                      {user.lastName.charAt(0)}
                    </Avatar>
                    <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' } }}>
                      {user.firstName} {user.lastName}
                    </Typography>
                  </Button>
                  <Button
                    size="small"
                    startIcon={<LogoutIcon />}
                    onClick={handleLogout}
                    sx={{ minWidth: 0, '& .MuiButton-startIcon': { mr: { xs: 0, sm: 1 } } }}
                  >
                    <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                      Çıkış Yap
                    </Box>
                  </Button>
                </Stack>
              )}
            </Box>
          </Toolbar>
        </AppBar>

        <Box sx={{ flexGrow: 1, minWidth: 0, p: { xs: 1.5, md: 3 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}
