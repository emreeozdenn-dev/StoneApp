import { useMemo, type ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { alpha, useTheme } from '@mui/material/styles'
import {
  Box,
  Chip,
  LinearProgress,
  Link,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from '@mui/material'
import DiamondIcon from '@mui/icons-material/DiamondOutlined'
import WarningAmberIcon from '@mui/icons-material/WarningAmberOutlined'
import ViewModuleIcon from '@mui/icons-material/ViewModuleOutlined'
import TrendingUpIcon from '@mui/icons-material/TrendingUpOutlined'
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchangeOutlined'
import WarehouseIcon from '@mui/icons-material/WarehouseOutlined'
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScannerOutlined'
import { fetchIncomingStocks, fetchPlates, fetchStones } from '../../api/catalog'
import { fetchExchangeRates } from '../../api/exchangeRates'
import { fetchQrScanHistory } from '../../api/qrScan'
import { hasPermission, useCurrentUser } from '../../auth/useCurrentUser'

export function DashboardPage() {
  const theme = useTheme()
  const { user } = useCurrentUser()
  const permissions = user?.permissions

  const canSeeStones = hasPermission(permissions, 'stones.view')
  const canSeeIncoming = hasPermission(permissions, 'incomingstock.view')
  const canSeePlates = hasPermission(permissions, 'plates.view')
  const canSeeQrLog = hasPermission(permissions, 'qrscanlog.view')

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
  const qrHistoryQuery = useQuery({
    queryKey: ['qr-scan-history'],
    queryFn: fetchQrScanHistory,
    enabled: canSeeQrLog,
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

  const warehouseBreakdown = useMemo(() => {
    const totals = new Map<string, number>()
    for (const p of activePlates) {
      totals.set(p.warehouse, (totals.get(p.warehouse) ?? 0) + p.area)
    }
    const entries = [...totals.entries()].sort((a, b) => b[1] - a[1])
    const max = entries[0]?.[1] ?? 0
    return entries.map(([warehouse, area]) => ({
      warehouse,
      area,
      pct: max > 0 ? (area / max) * 100 : 0,
    }))
  }, [activePlates])

  const recentScans = useMemo(() => (qrHistoryQuery.data ?? []).slice(0, 5), [qrHistoryQuery.data])

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
            icon={<DiamondIcon fontSize="small" />}
            label="Taş Çeşidi"
            value={stonesQuery.data?.length ?? '—'}
            sub={`${stonesQuery.data?.filter((s) => s.status === 'Aktif').length ?? 0} aktif`}
          />
        )}
        {canSeeStones && (
          <StatTile
            icon={<WarningAmberIcon fontSize="small" />}
            label="Düşük Stok Uyarısı"
            value={lowStockStones.length}
            status={lowStockStones.length > 0 ? 'warning' : 'success'}
          />
        )}
        {canSeePlates && (
          <StatTile
            icon={<ViewModuleIcon fontSize="small" />}
            label="Aktif Plaka Alanı"
            value={`${activeArea.toLocaleString('tr-TR')} m²`}
            sub={`${activePlates.length} plaka`}
          />
        )}
        {canSeePlates && (
          <StatTile
            icon={<TrendingUpIcon fontSize="small" />}
            label="Bu Ay Satılan Plaka"
            value={soldThisMonth.length}
            status="success"
          />
        )}
        {ratesQuery.data && (ratesQuery.data.usdTry || ratesQuery.data.eurTry) && (
          <Paper variant="outlined" sx={{ p: 2.5, flex: '1 1 200px', minWidth: 200 }}>
            <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', mb: 1.5 }}>
              <IconBadge color={theme.palette.primary.main}>
                <CurrencyExchangeIcon fontSize="small" />
              </IconBadge>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                Güncel Döviz Kuru
              </Typography>
            </Stack>
            <Stack direction="row" spacing={3}>
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

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} sx={{ alignItems: 'flex-start' }}>
        <Stack spacing={2} sx={{ flex: { lg: 1.6 }, width: '100%', minWidth: 0 }}>
          {canSeePlates && (
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <PanelHead title="Son Satılan Plakalar" to={recentSold.length > 0 ? '/plakalar' : undefined} />
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

          {canSeeIncoming && (
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <PanelHead title="Son Gelen Parti/Lotlar" to={recentIncoming.length > 0 ? '/gelen-stok' : undefined} />
              {recentIncoming.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Henüz gelen parti/lot kaydı yok.
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
        </Stack>

        <Stack spacing={2} sx={{ flex: { lg: 1 }, width: '100%', minWidth: 0 }}>
          {canSeeStones && (
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <PanelHead title="Düşük Stok Uyarıları" />
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
                      <Typography variant="caption" sx={{ color: 'warning.main', fontWeight: 600 }}>
                        {s.currentStock.toLocaleString('tr-TR')} / {s.minimumStock.toLocaleString('tr-TR')} m²
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              )}
            </Paper>
          )}

          {canSeePlates && warehouseBreakdown.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <PanelHead title="Depo Bazında Aktif Stok" icon={<WarehouseIcon fontSize="small" />} />
              <Stack spacing={1.5}>
                {warehouseBreakdown.map((w) => (
                  <Box key={w.warehouse}>
                    <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {w.warehouse}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {w.area.toLocaleString('tr-TR')} m²
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={w.pct}
                      sx={{ height: 5, borderRadius: 3, bgcolor: 'action.hover' }}
                    />
                  </Box>
                ))}
              </Stack>
            </Paper>
          )}

          {canSeeQrLog && recentScans.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <PanelHead
                title="Son QR Taramaları"
                icon={<QrCodeScannerIcon fontSize="small" />}
                to="/qr-tarama-gecmisi"
              />
              <Stack spacing={1}>
                {recentScans.map((scan) => (
                  <Stack key={scan.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Box
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        flexShrink: 0,
                        bgcolor:
                          scan.result === 'Success'
                            ? 'success.main'
                            : scan.result === 'NotFound'
                              ? 'warning.main'
                              : 'error.main',
                      }}
                    />
                    <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                      <Typography component="span" variant="body2" sx={{ fontWeight: 500 }}>
                        {scan.plateNo ?? scan.rawScannedValue}
                      </Typography>{' '}
                      tarandı
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                      {new Date(scan.scannedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Paper>
          )}
        </Stack>
      </Stack>
    </Box>
  )
}

function IconBadge({ children, color }: { children: ReactNode; color: string }) {
  return (
    <Box
      sx={{
        width: 34,
        height: 34,
        borderRadius: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: alpha(color, 0.12),
        color,
      }}
    >
      {children}
    </Box>
  )
}

function PanelHead({ title, icon, to }: { title: string; icon?: ReactNode; to?: string }) {
  return (
    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        {icon}
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
      </Stack>
      {to && (
        <Link component={RouterLink} to={to} underline="hover" variant="caption" sx={{ fontWeight: 500 }}>
          Tümünü gör
        </Link>
      )}
    </Stack>
  )
}

function StatTile({
  icon,
  label,
  value,
  sub,
  status,
}: {
  icon: ReactNode
  label: string
  value: string | number
  sub?: string
  status?: 'success' | 'warning' | 'error'
}) {
  const theme = useTheme()
  const color = status ? theme.palette[status].main : theme.palette.primary.main

  return (
    <Paper variant="outlined" sx={{ p: 2.5, flex: '1 1 200px', minWidth: 200 }}>
      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', mb: 1.5 }}>
        <IconBadge color={color}>{icon}</IconBadge>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
          {label}
        </Typography>
      </Stack>
      <Typography variant="h4" sx={{ fontWeight: 700, color: status ? `${status}.main` : 'text.primary' }}>
        {value}
      </Typography>
      {sub && (
        <Typography variant="caption" color="text.secondary">
          {sub}
        </Typography>
      )}
    </Paper>
  )
}
