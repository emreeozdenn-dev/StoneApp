import { useEffect, useState } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
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
import { TopNav } from './TopNav'

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

  const brandTitle = (
    <>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
        Mermer Stok Yönetimi
      </Typography>
      {branding?.companyName && (
        <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
          {branding.companyName}
        </Typography>
      )}
    </>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Masaüstünde menü üst çubuktadır; yan menü yalnızca mobilde hamburger düğmesiyle açılır. */}
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
        <Box sx={{ px: 3, py: 2.5 }}>{brandTitle}</Box>
        {user && <Sidebar permissions={user.permissions} onNavigate={() => setMobileOpen(false)} />}
      </Drawer>

      <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Tek satırlık üst çubuk: solda logo, ortada menü (masaüstü), sağda kullanıcı ve çıkış. */}
        <AppBar
          position="sticky"
          color="transparent"
          elevation={0}
          sx={{ top: 0, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
        >
          <Toolbar sx={{ gap: 1.5, minHeight: { xs: 64, md: 80 } }}>
            <IconButton
              edge="start"
              onClick={() => setMobileOpen(true)}
              sx={{ display: { xs: 'inline-flex', md: 'none' } }}
              aria-label="Menüyü aç"
            >
              <MenuIcon />
            </IconButton>

            <Box
              component={Link}
              to="/"
              sx={{ display: 'flex', alignItems: 'center', flexShrink: 0, color: 'inherit', textDecoration: 'none' }}
            >
              {branding?.logoUrl ? (
                <Box
                  component="img"
                  src={branding.logoUrl}
                  alt={branding.companyName ? `${branding.companyName} logosu` : 'Firma logosu'}
                  sx={{ height: { xs: 48, md: 64 }, width: 'auto', maxWidth: { xs: 140, md: 220 }, objectFit: 'contain', borderRadius: 1 }}
                />
              ) : (
                <Typography variant="subtitle1" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {branding?.companyName || 'Mermer Stok Yönetimi'}
                </Typography>
              )}
            </Box>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              {user && (
                <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                  <TopNav permissions={user.permissions} />
                </Box>
              )}
            </Box>

            {user && (
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexShrink: 0 }}>
                <Chip label={user.role} size="small" color="primary" variant="outlined" sx={{ display: { xs: 'none', lg: 'inline-flex' } }} />
                <Button
                  size="small"
                  onClick={() => navigate('/hesabim')}
                  sx={{ minWidth: 0, textTransform: 'none', color: 'text.primary' }}
                >
                  <Avatar sx={{ width: 32, height: 32, fontSize: 14, mr: { xs: 0, lg: 1 } }}>
                    {user.firstName.charAt(0)}
                    {user.lastName.charAt(0)}
                  </Avatar>
                  <Typography variant="body2" sx={{ display: { xs: 'none', lg: 'block' }, whiteSpace: 'nowrap' }}>
                    {user.firstName} {user.lastName}
                  </Typography>
                </Button>
                <Button
                  size="small"
                  startIcon={<LogoutIcon />}
                  onClick={handleLogout}
                  sx={{ minWidth: 0, whiteSpace: 'nowrap', '& .MuiButton-startIcon': { mr: { xs: 0, sm: 1 } } }}
                >
                  <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                    Çıkış Yap
                  </Box>
                </Button>
              </Stack>
            )}
          </Toolbar>
        </AppBar>

        <Box sx={{ flexGrow: 1, minWidth: 0, p: { xs: 1.5, md: 3 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}
