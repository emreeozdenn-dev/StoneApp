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
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import DiamondIcon from '@mui/icons-material/DiamondOutlined'
import WarningAmberIcon from '@mui/icons-material/WarningAmberOutlined'
import ViewModuleIcon from '@mui/icons-material/ViewModuleOutlined'
import LayersIcon from '@mui/icons-material/LayersOutlined'
import TrendingUpIcon from '@mui/icons-material/TrendingUpOutlined'
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchangeOutlined'
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScannerOutlined'
import { fetchIncomingStocks, fetchPlates, fetchStones } from '../../api/catalog'
import { fetchExchangeRates } from '../../api/exchangeRates'
import { fetchQrScanHistory } from '../../api/qrScan'
import { hasPermission, useCurrentUser } from '../../auth/useCurrentUser'

export function DashboardPage() {
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

  // Konsinye partilerden gelen, satılmamış (Aktif veya Rezerve) plakalar, taş bazında
  const consignment = useMemo(() => {
    const plates = (platesQuery.data ?? []).filter(
      (p) => p.supplyType === 'Konsinye' && (p.status === 'Aktif' || p.status === 'Rezerve'),
    )
    const stoneCodes = new Map((stonesQuery.data ?? []).map((s) => [s.id, s.code]))
    const suppliersByStock = new Map((incomingQuery.data ?? []).map((r) => [r.id, r.supplier]))

    const groups = new Map<
      number,
      { stoneId: number; stoneName: string; count: number; reserved: number; area: number; suppliers: Set<string> }
    >()
    for (const p of plates) {
      let g = groups.get(p.stoneId)
      if (!g) {
        g = { stoneId: p.stoneId, stoneName: p.stoneName, count: 0, reserved: 0, area: 0, suppliers: new Set() }
        groups.set(p.stoneId, g)
      }
      g.count += 1
      g.area += p.area
      if (p.status === 'Rezerve') g.reserved += 1
      const supplier = suppliersByStock.get(p.incomingStockId)?.trim()
      if (supplier) g.suppliers.add(supplier)
    }

    const rows = [...groups.values()].sort((a, b) => b.area - a.area)
    const maxArea = rows[0]?.area ?? 0
    return {
      rows: rows.map((r) => ({
        ...r,
        code: stoneCodes.get(r.stoneId),
        suppliers: [...r.suppliers].sort((a, b) => a.localeCompare(b, 'tr')),
        pct: maxArea > 0 ? (r.area / maxArea) * 100 : 0,
      })),
      totalCount: plates.length,
      totalArea: plates.reduce((sum, p) => sum + p.area, 0),
    }
  }, [platesQuery.data, stonesQuery.data, incomingQuery.data])

  const recentScans = useMemo(() => (qrHistoryQuery.data ?? []).slice(0, 5), [qrHistoryQuery.data])

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{ justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, mb: 3 }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>
            Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Hoş geldiniz, {user?.firstName} {user?.lastName}.
          </Typography>
        </Box>
        {ratesQuery.data && (ratesQuery.data.usdTry || ratesQuery.data.eurTry) && (
          <Paper
            variant="outlined"
            sx={{ px: 1.5, py: 0.75, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}
          >
            <CurrencyExchangeIcon fontSize="small" sx={{ color: 'primary.main' }} />
            <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              <Typography component="span" variant="caption" color="text.secondary">
                USD{' '}
              </Typography>
              <b>{ratesQuery.data.usdTry ? `${ratesQuery.data.usdTry.toLocaleString('tr-TR')} ₺` : '—'}</b>
            </Typography>
            <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              <Typography component="span" variant="caption" color="text.secondary">
                EUR{' '}
              </Typography>
              <b>{ratesQuery.data.eurTry ? `${ratesQuery.data.eurTry.toLocaleString('tr-TR')} ₺` : '—'}</b>
            </Typography>
            <Typography variant="caption" color="text.secondary">
              TCMB, {ratesQuery.data.date}
            </Typography>
          </Paper>
        )}
      </Stack>

      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 2, mb: 3 }}>
        {canSeeStones && (
          <StatTile
            icon={<DiamondIcon fontSize="small" />}
            label="Taş Çeşidi"
            value={stonesQuery.data?.length ?? '—'}
            sub={`${stonesQuery.data?.filter((s) => s.status === 'Aktif').length ?? 0} aktif`}
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
        {canSeePlates && (
          <StatTile
            icon={<LayersIcon fontSize="small" />}
            label="Konsinye Stok"
            value={`${formatArea(consignment.totalArea)} m²`}
            sub={`${consignment.rows.length} taş çeşidi · ${consignment.totalCount} plaka`}
            status="warning"
            valueColor="text.primary"
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
          {canSeePlates && (
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <PanelHead
                title="Konsinye Stok (Satılmamış)"
                icon={<LayersIcon fontSize="small" />}
                to={consignment.rows.length > 0 ? '/plakalar' : undefined}
                linkLabel="Plakalara git"
              />
              {consignment.rows.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Satılmamış konsinye plaka yok.
                </Typography>
              ) : (
                <>
                  <Table size="small" sx={{ '& td, & th': { fontVariantNumeric: 'tabular-nums' } }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ pl: 0, color: 'text.secondary' }}>Taş</TableCell>
                        <TableCell sx={{ color: 'text.secondary', textAlign: 'right !important' }}>Plaka</TableCell>
                        <TableCell sx={{ pr: 0, color: 'text.secondary', textAlign: 'right !important' }}>
                          Toplam m²
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {consignment.rows.map((r) => (
                        <TableRow key={r.stoneId}>
                          <TableCell sx={{ pl: 0 }}>
                            <Link component={RouterLink} to="/plakalar" underline="hover" variant="body2">
                              {r.stoneName}
                            </Link>
                            {(r.code || r.suppliers.length > 0) && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                {[r.code, r.suppliers.join(', ')].filter(Boolean).join(' · ')}
                              </Typography>
                            )}
                            <LinearProgress
                              variant="determinate"
                              value={r.pct}
                              sx={{ mt: 0.75, height: 4, borderRadius: 2, bgcolor: 'action.hover' }}
                            />
                          </TableCell>
                          <TableCell sx={{ textAlign: 'right !important', whiteSpace: 'nowrap' }}>
                            {r.count}
                            {r.reserved > 0 && (
                              <Chip
                                label={`${r.reserved} rezerve`}
                                size="small"
                                color="warning"
                                variant="outlined"
                                sx={{ ml: 1, height: 20, fontSize: 11 }}
                              />
                            )}
                          </TableCell>
                          <TableCell sx={{ pr: 0, textAlign: 'right !important', whiteSpace: 'nowrap' }}>
                            {formatArea(r.area)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell sx={{ pl: 0, fontWeight: 700, borderBottom: 'none' }}>
                          Toplam · {consignment.rows.length} taş
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, borderBottom: 'none', textAlign: 'right !important' }}>
                          {consignment.totalCount}
                        </TableCell>
                        <TableCell
                          sx={{ pr: 0, fontWeight: 700, borderBottom: 'none', textAlign: 'right !important' }}
                        >
                          {formatArea(consignment.totalArea)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    Durumu Aktif veya Rezerve olan konsinye plakalar.
                  </Typography>
                </>
              )}
            </Paper>
          )}

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

function formatArea(area: number) {
  return area.toLocaleString('tr-TR', { maximumFractionDigits: 2 })
}

function PanelHead({
  title,
  icon,
  to,
  linkLabel = 'Tümünü gör',
}: {
  title: string
  icon?: ReactNode
  to?: string
  linkLabel?: string
}) {
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
          {linkLabel}
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
  valueColor,
}: {
  icon: ReactNode
  label: string
  value: string | number
  sub?: string
  status?: 'success' | 'warning' | 'error'
  valueColor?: string
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
      <Typography variant="h4" sx={{ fontWeight: 700, color: valueColor ?? (status ? `${status}.main` : 'text.primary') }}>
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
