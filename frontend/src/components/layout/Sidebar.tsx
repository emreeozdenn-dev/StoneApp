import { Fragment } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material'
import { visibleNavGroups, type NavItemDef } from './navItems'

interface SidebarProps {
  permissions: string[]
  onNavigate?: () => void
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

export function Sidebar({ permissions, onNavigate }: SidebarProps) {
  return (
    <List sx={{ py: 2 }} component="nav">
      {visibleNavGroups(permissions).map((group, index) => (
        <Fragment key={group.label}>
          {index > 0 && (
            <>
              <Divider sx={{ my: 1.5, mx: 2 }} />
              <Typography
                variant="caption"
                sx={{ px: 3, color: 'text.secondary', fontWeight: 600, letterSpacing: 0.4 }}
              >
                {group.label}
              </Typography>
            </>
          )}
          {group.items.map((item) => (
            <NavItem key={item.to} item={item} onNavigate={onNavigate} />
          ))}
        </Fragment>
      ))}
    </List>
  )
}

function NavItem({ item, onNavigate }: { item: NavItemDef; onNavigate?: () => void }) {
  return (
    <ListItemButton component={NavLink} to={item.to} end={item.end} onClick={onNavigate} sx={itemSx}>
      <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
      <ListItemText primary={item.label} slotProps={{ primary: { sx: { fontSize: 14, fontWeight: 500 } } }} />
    </ListItemButton>
  )
}
