import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'
import { hasPermission, useCurrentUser } from './useCurrentUser'

interface ProtectedRouteProps {
  permission?: string
}

export function ProtectedRoute({ permission }: ProtectedRouteProps) {
  const { user, isLoading, isError } = useCurrentUser()
  const location = useLocation()

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (isError || !user) {
    const returnUrl = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/giris?returnUrl=${returnUrl}`} replace />
  }

  if (permission && !hasPermission(user.permissions, permission)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
