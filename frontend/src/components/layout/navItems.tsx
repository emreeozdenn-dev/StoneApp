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
import RequestQuoteIcon from '@mui/icons-material/RequestQuoteOutlined'
import { hasPermission } from '../../auth/useCurrentUser'

export interface NavItemDef {
  to: string
  label: string
  icon: React.ReactNode
  end?: boolean
  permission?: string
}

export interface NavGroupDef {
  label: string
  items: NavItemDef[]
}

// Menü tek yerde tanımlanır; masaüstünde üst menü, mobilde açılır yan menü aynı listeyi kullanır.
export const NAV_GROUPS: NavGroupDef[] = [
  {
    label: 'STOK',
    items: [
      { to: '/', label: 'Dashboard', icon: <DashboardIcon />, end: true },
      { to: '/qr-tara', label: 'QR Kod Tara', icon: <QrCodeScannerIcon /> },
      { to: '/taslar', label: 'Taşlar', icon: <DiamondIcon />, permission: 'stones.view' },
      { to: '/gelen-stok', label: 'Gelen Parti/Lot', icon: <Inventory2Icon />, permission: 'incomingstock.view' },
      { to: '/plakalar', label: 'Plakalar', icon: <ViewModuleIcon />, permission: 'plates.view' },
      { to: '/bildirim-gecmisi', label: 'Bildirim Geçmişi', icon: <NotificationsIcon />, permission: 'notifications.view' },
    ],
  },
  {
    label: 'SATIŞ YÖNETİMİ',
    items: [{ to: '/teklifler', label: 'Teklifler', icon: <RequestQuoteIcon />, permission: 'offers.view' }],
  },
  {
    label: 'YÖNETİM',
    items: [
      { to: '/kullanicilar', label: 'Kullanıcı Yönetimi', icon: <GroupIcon />, permission: 'users.manage' },
      { to: '/roller', label: 'Roller & Yetkiler', icon: <AdminPanelSettingsIcon />, permission: 'users.manage' },
      { to: '/qr-tarama-gecmisi', label: 'QR Tarama Geçmişi', icon: <HistoryIcon />, permission: 'qrscanlog.view' },
      { to: '/denetim-kaydi', label: 'Denetim Kaydı', icon: <FactCheckIcon />, permission: 'auditlog.view' },
      { to: '/ayarlar/sistem', label: 'Sistem Ayarları', icon: <SettingsIcon />, permission: 'settings.manage' },
    ],
  },
]

/** Kullanıcının yetkisi olan öğeleri döndürür; hiç öğesi kalmayan gruplar atlanır. */
export function visibleNavGroups(permissions: string[]): NavGroupDef[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || hasPermission(permissions, item.permission)),
  })).filter((group) => group.items.length > 0)
}
