import { NavLink } from 'react-router-dom'
import {
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material'
import DashboardIcon from '@mui/icons-material/DashboardOutlined'
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScannerOutlined'
import DiamondIcon from '@mui/icons-material/DiamondOutlined'
import Inventory2Icon from '@mui/icons-material/Inventory2Outlined'
import ViewModuleIcon from '@mui/icons-material/ViewModuleOutlined'
import NotificationsIcon from '@mui/icons-material/NotificationsOutlined'
import GroupIcon from '@mui/icons-material/GroupOutlined'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettingsOutlined'
import HistoryIcon from '@mui/icons-material/HistoryOutlined'
import SettingsIcon from '@mui/icons-material/SettingsOutlined'
import FactCheckIcon from '@mui/icons-material/FactCheckOutlined'
import { hasPermission } from '../../auth/useCurrentUser'

interface SidebarProps {
  permissions: string[]
}

const itemSx = {
  borderRadius: 1.5,
  mx: 1,
  '&.active': {
    bgcolor: 'primary.main',
    color: 'primary.contrastText',
    '& .MuiListItemIcon-root': { color: 'primary.contrastText' },
  },
}

export function Sidebar({ permissions }: SidebarProps) {
  return (
    <List sx={{ py: 2 }} component="nav">
      <NavItem to="/" icon={<DashboardIcon />} label="Dashboard" end />
      <NavItem to="/qr-tara" icon={<QrCodeScannerIcon />} label="QR Kod Tara" />
      {hasPermission(permissions, 'stones.view') && (
        <NavItem to="/taslar" icon={<DiamondIcon />} label="Taşlar" />
      )}
      {hasPermission(permissions, 'incomingstock.view') && (
        <NavItem to="/gelen-stok" icon={<Inventory2Icon />} label="Gelen Stok" />
      )}
      {hasPermission(permissions, 'plates.view') && (
        <NavItem to="/plakalar" icon={<ViewModuleIcon />} label="Plakalar" />
      )}
      {hasPermission(permissions, 'notifications.view') && (
        <NavItem to="/bildirim-gecmisi" icon={<NotificationsIcon />} label="Bildirim Geçmişi" />
      )}

      {(hasPermission(permissions, 'users.manage') ||
        hasPermission(permissions, 'settings.manage') ||
        hasPermission(permissions, 'qrscanlog.view') ||
        hasPermission(permissions, 'auditlog.view')) && (
        <>
          <Divider sx={{ my: 1.5, mx: 2 }} />
          <Typography
            variant="caption"
            sx={{ px: 3, color: 'text.secondary', fontWeight: 600, letterSpacing: 0.4 }}
          >
            YÖNETİM
          </Typography>
        </>
      )}
      {hasPermission(permissions, 'users.manage') && (
        <NavItem to="/kullanicilar" icon={<GroupIcon />} label="Kullanıcı Yönetimi" />
      )}
      {hasPermission(permissions, 'users.manage') && (
        <NavItem to="/roller" icon={<AdminPanelSettingsIcon />} label="Roller & Yetkiler" />
      )}
      {hasPermission(permissions, 'qrscanlog.view') && (
        <NavItem to="/qr-tarama-gecmisi" icon={<HistoryIcon />} label="QR Tarama Geçmişi" />
      )}
      {hasPermission(permissions, 'auditlog.view') && (
        <NavItem to="/denetim-kaydi" icon={<FactCheckIcon />} label="Denetim Kaydı" />
      )}
      {hasPermission(permissions, 'settings.manage') && (
        <NavItem to="/ayarlar/sistem" icon={<SettingsIcon />} label="Sistem Ayarları" />
      )}
    </List>
  )
}

function NavItem({
  to,
  icon,
  label,
  end,
}: {
  to: string
  icon: React.ReactNode
  label: string
  end?: boolean
}) {
  return (
    <ListItemButton component={NavLink} to={to} end={end} sx={itemSx}>
      <ListItemIcon sx={{ minWidth: 40 }}>{icon}</ListItemIcon>
      <ListItemText primary={label} slotProps={{ primary: { sx: { fontSize: 14, fontWeight: 500 } } }} />
    </ListItemButton>
  )
}
