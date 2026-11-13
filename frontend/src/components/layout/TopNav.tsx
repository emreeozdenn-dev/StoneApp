import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Box, Button, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMoreOutlined'
import { visibleNavGroups, type NavGroupDef } from './navItems'

const linkSx = {
  flexShrink: 0,
  px: 1.5,
  borderRadius: 1.5,
  color: 'text.primary',
  fontSize: 14,
  fontWeight: 500,
  textTransform: 'none',
  whiteSpace: 'nowrap',
  '& .MuiButton-startIcon': { mr: 0.75 },
  '&.active': {
    bgcolor: 'primary.main',
    color: 'primary.contrastText',
    '&:hover': { bgcolor: 'primary.dark' },
  },
} as const

// Tek öğeli gruplar (Teklifler) doğrudan bağlantı olur; çok öğeli yönetim grubu açılır menüde toplanır.
const DROPDOWN_GROUP = 'YÖNETİM'

export function TopNav({ permissions }: { permissions: string[] }) {
  const groups = visibleNavGroups(permissions)
  const inline = groups.filter((g) => g.label !== DROPDOWN_GROUP).flatMap((g) => g.items)
  const dropdown = groups.find((g) => g.label === DROPDOWN_GROUP)

  return (
    <Box
      component="nav"
      sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.5, overflowX: 'auto', scrollbarWidth: 'thin' }}
    >
      {inline.map((item) => (
        <Button key={item.to} component={NavLink} to={item.to} end={item.end} startIcon={item.icon} sx={linkSx}>
          {item.label}
        </Button>
      ))}
      {dropdown && <DropdownGroup group={dropdown} />}
    </Box>
  )
}

function DropdownGroup({ group }: { group: NavGroupDef }) {
  const { pathname } = useLocation()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const active = group.items.some((item) => pathname.startsWith(item.to))
  const label = group.label.charAt(0) + group.label.slice(1).toLocaleLowerCase('tr-TR')

  return (
    <>
      <Button
        className={active ? 'active' : undefined}
        endIcon={<ExpandMoreIcon />}
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        sx={linkSx}
      >
        {label}
      </Button>
      <Menu
        anchorEl={anchor}
        open={!!anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {group.items.map((item) => (
          <MenuItem
            key={item.to}
            component={NavLink}
            to={item.to}
            selected={pathname.startsWith(item.to)}
            onClick={() => setAnchor(null)}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText>{item.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
