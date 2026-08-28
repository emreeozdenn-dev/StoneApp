import { useMemo } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Chip,
  Link,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from '@mui/material'
import { fetchIncomingStocks, fetchPlates, fetchStones } from '../../api/catalog'
import { fetchExchangeRates } from '../../api/exchangeRates'
import { hasPermission, useCurrentUser } from '../../auth/useCurrentUser'

export function DashboardPage() {
  const { user } = useCurrentUser()
  const permissions = user?.permissions

  const canSeeStones = hasPermission(permissions, 'stones.view')
  const canSeeIncoming = hasPermission(permissions, 'incomingstock.view')
  const canSeePlates = hasPermission(permissions, 'plates.view')

  const stonesQuery = useQuery({ queryKey: ['stones'], queryFn: fetchStones, enabled: canSeeStones })
  const incomingQuery = useQuery({
    queryKey: ['incoming-stock'],
    queryFn: fetchIncomingStocks,
    enabled: canSeeIncoming,
  })
  const platesQuery = useQuery({ queryKey: ['plates'], queryFn: fetchPlates, enabled: canSeePlates })
  const ratesQuery = useQuery({
    queryKey: ['exchange-rates'],
    queryFn: fetchExchangeRates,
    staleTime: 30 * 60_000,
  })

  const lowStockStones = useMemo(
    () => stonesQuery.data?.filter((s) => s.isBelowMinimumStock) ?? [],
    [stonesQuery.data],
  )

  const activePlates = useMemo(() => platesQuery.data?.filter((p) => p.status === 'Aktif') ?? [], [platesQuery.data])
  const activeArea = useMemo(() => activePlates.reduce((sum, p) => sum + p.area, 0), [activePlates])

  const soldThisMonth = useMemo(() => {
    if (!platesQuery.data) return []
    const now = new Date()
    return platesQuery.data.filter((p) => {
      if (p.status !== 'Satildi' || !p.soldAt) return false
      const soldAt = new Date(p.soldAt)
      return soldAt.getFullYear() === now.getFullYear() && soldAt.getMonth() === now.getMonth()
    })
  }, [platesQuery.data])

  const recentIncoming = useMemo(
    () => [...(incomingQuery.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
    [incomingQuery.data],
  )

  const recentSold = useMemo(
    () =>
      (platesQuery.data ?? [])
        .filter((p) => p.status === 'Satildi' && p.soldAt)
        .sort((a, b) => (b.soldAt ?? '').localeCompare(a.soldAt ?? ''))
        .slice(0, 5),
    [platesQuery.data],
  )

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>
        Dashboard
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Hoş geldiniz, {user?.firstName} {user?.lastName}.
      </Typography>

      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 2, mb: 3 }}>
        {canSeeStones && (
          <StatTile
            label="Taş Çeşidi"
            value={stonesQuery.data?.length ?? '—'}
            sub={`${stonesQuery.data?.filter((s) => s.status === 'Aktif').length ?? 0} aktif`}
          />
        )}
        {canSeeStones && (
          <StatTile
            label="Düşük Stok Uyarısı"
            value={lowStockStones.length}
            status={lowStockStones.length > 0 ? 'warning' : 'success'}
          />
        )}
        {canSeePlates && (
          <StatTile
            label="Aktif Plaka Alanı"
            value={`${activeArea.toLocaleString('tr-TR')} m²`}
            sub={`${activePlates.length} plaka`}
          />
        )}
        {canSeePlates && <StatTile label="Bu Ay Satılan Plaka" value={soldThisMonth.length} status="success" />}
        {ratesQuery.data && (ratesQuery.data.usdTry || ratesQuery.data.eurTry) && (
          <Paper variant="outlined" sx={{ p: 2.5, flex: '1 1 200px', minWidth: 200 }}>
            <Typography variant="body2" color="text.secondary">
              Güncel Döviz Kuru
            </Typography>
            <Stack direction="row" spacing={3} sx={{ mt: 0.5 }}>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {ratesQuery.data.usdTry ? `${ratesQuery.data.usdTry.toLocaleString('tr-TR')} ₺` : '—'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  1 USD
                </Typography>
              </Box>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {ratesQuery.data.eurTry ? `${ratesQuery.data.eurTry.toLocaleString('tr-TR')} ₺` : '—'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  1 EUR
                </Typography>
              </Box>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              TCMB, {ratesQuery.data.date}
            </Typography>
          </Paper>
        )}
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        {canSeeStones && (
          <Paper variant="outlined" sx={{ p: 2.5, flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
              Düşük Stok Uyarıları
            </Typography>
            {lowStockStones.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Minimum seviyenin altında taş yok.
              </Typography>
            ) : (
              <Stack spacing={1.25}>
                {lowStockStones.map((s) => (
                  <Stack key={s.id} direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <Link component={RouterLink} to="/taslar" underline="hover" variant="body2">
                      {s.name} ({s.code})
                    </Link>
                    <Typography variant="caption" color="text.secondary">
                      {s.currentStock.toLocaleString('tr-TR')} / {s.minimumStock.toLocaleString('tr-TR')} m²
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            )}
          </Paper>
        )}

        {canSeeIncoming && (
          <Paper variant="outlined" sx={{ p: 2.5, flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
              Son Gelen Stoklar
            </Typography>
            {recentIncoming.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Henüz gelen stok kaydı yok.
              </Typography>
            ) : (
              <Table size="small">
                <TableBody>
                  {recentIncoming.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell sx={{ pl: 0 }}>
                        <Link component={RouterLink} to="/gelen-stok" underline="hover" variant="body2">
                          {r.batchCode}
                        </Link>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {r.stoneName}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ pr: 0 }}>
                        <Typography variant="caption" color="text.secondary">
                          {r.arrivalDate}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>
        )}

        {canSeePlates && (
          <Paper variant="outlined" sx={{ p: 2.5, flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
              Son Satılan Plakalar
            </Typography>
            {recentSold.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Henüz satılan plaka yok.
              </Typography>
            ) : (
              <Table size="small">
                <TableBody>
                  {recentSold.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell sx={{ pl: 0 }}>
                        <Link component={RouterLink} to="/plakalar" underline="hover" variant="body2">
                          {p.plateNo}
                        </Link>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {p.stoneName}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ pr: 0 }}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'flex-end' }}>
                          <Typography variant="caption" color="text.secondary">
                            {p.area.toLocaleString('tr-TR')} m²
                          </Typography>
                          <Chip label="Satıldı" size="small" color="default" />
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>
        )}
      </Stack>
    </Box>
  )
}

function StatTile({
  label,
  value,
  sub,
  status,
}: {
  label: string
  value: string | number
  sub?: string
  status?: 'success' | 'warning' | 'error'
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5, flex: '1 1 200px', minWidth: 200 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', mt: 0.5 }}>
        <Typography
          variant="h4"
          sx={{ fontWeight: 700, color: status ? `${status}.main` : 'text.primary' }}
        >
          {value}
        </Typography>
      </Stack>
      {sub && (
        <Typography variant="caption" color="text.secondary">
          {sub}
        </Typography>
      )}
    </Paper>
  )
}
