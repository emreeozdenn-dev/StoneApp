import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { deleteOffer, fetchOffers, markOfferSold, OFFER_STATUS_LABELS, type Offer } from '../../api/offers'
import { fetchCompanyBranding } from '../../api/systemSettings'
import { hasPermission, useCurrentUser } from '../../auth/useCurrentUser'
import { ColumnSettingsButton } from '../../components/common/ColumnSettingsButton'
import { OfferPreviewDocument } from '../../components/common/OfferPreviewDocument'
import { type ColumnDef, useColumnPreferences } from '../../components/common/useColumnPreferences'
import { useDraggableColumns } from '../../components/common/useDraggableColumns'
import { exportOfferPdf } from '../../utils/plateExport'

type OfferColumnKey =
  | 'offerDate'
  | 'companyName'
  | 'currency'
  | 'totalAmount'
  | 'status'
  | 'createdByUserName'
  | 'createdAt'

const OFFER_COLUMNS: ColumnDef<OfferColumnKey>[] = [
  { key: 'offerDate', label: 'Teklif Tarihi' },
  { key: 'companyName', label: 'Firma' },
  { key: 'currency', label: 'Para Birimi' },
  { key: 'totalAmount', label: 'Genel Toplam', align: 'right' },
  { key: 'status', label: 'Durum' },
  { key: 'createdByUserName', label: 'Oluşturan' },
  { key: 'createdAt', label: 'Oluşturma Tarihi' },
]

export function OffersPage() {
  const { user } = useCurrentUser()
  const queryClient = useQueryClient()
  const offersQuery = useQuery({ queryKey: ['offers'], queryFn: fetchOffers })
  const brandingQuery = useQuery({ queryKey: ['company-branding'], queryFn: fetchCompanyBranding })

  const canDelete = hasPermission(user?.permissions, 'offers.delete')
  const canMarkSold = hasPermission(user?.permissions, 'offers.create')

  const columnPrefs = useColumnPreferences('offers', OFFER_COLUMNS)
  const draggableColumns = useDraggableColumns(columnPrefs.reorderTo)

  const [viewOffer, setViewOffer] = useState<Offer | null>(null)
  const viewContainerRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Offer | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const deleteMutation = useMutation({
    mutationFn: deleteOffer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers'] })
      setDeleteTarget(null)
      setDeleteError(null)
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Teklif silinemedi.'
      setDeleteError(message)
    },
  })

  const [soldTarget, setSoldTarget] = useState<Offer | null>(null)
  const [soldError, setSoldError] = useState<string | null>(null)
  const markSoldMutation = useMutation({
    mutationFn: markOfferSold,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers'] })
      queryClient.invalidateQueries({ queryKey: ['plates'] })
      queryClient.invalidateQueries({ queryKey: ['stones'] })
      setSoldTarget(null)
      setSoldError(null)
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Teklif satıldı olarak işaretlenemedi.'
      setSoldError(message)
    },
  })

  const handleExportPdf = async () => {
    if (!viewContainerRef.current) return
    setExporting(true)
    try {
      await exportOfferPdf(viewContainerRef.current, `teklif-${viewOffer?.id ?? ''}.pdf`)
    } finally {
      setExporting(false)
    }
  }

  function renderOfferCell(key: OfferColumnKey, o: Offer) {
    switch (key) {
      case 'offerDate':
        return new Date(o.offerDate).toLocaleDateString('tr-TR')
      case 'companyName':
        return o.companyName
      case 'currency':
        return o.currency
      case 'totalAmount':
        return `${o.totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${o.currency}`
      case 'status':
        return (
          <Chip
            size="small"
            color={o.status === 'Gonderildi' ? 'info' : 'default'}
            label={OFFER_STATUS_LABELS[o.status]}
          />
        )
      case 'createdByUserName':
        return o.createdByUserName
      case 'createdAt':
        return new Date(o.createdAt).toLocaleString('tr-TR')
      default:
        return null
    }
  }

  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Teklifler
        </Typography>
        <ColumnSettingsButton columns={OFFER_COLUMNS} prefs={columnPrefs} />
      </Stack>

      <Box sx={{ overflowX: 'auto' }}>
        <Table sx={{ minWidth: 760 }}>
          <TableHead>
            <TableRow>
              {columnPrefs.visibleOrderedKeys.map((key) => {
                const col = OFFER_COLUMNS.find((c) => c.key === key)
                return (
                  <TableCell key={key} align={col?.align} {...draggableColumns.getHeaderCellProps(key)}>
                    {col?.label}
                  </TableCell>
                )
              })}
              <TableCell>İşlem</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {offersQuery.data?.map((o) => (
              <TableRow key={o.id}>
                {columnPrefs.visibleOrderedKeys.map((key) => {
                  const col = OFFER_COLUMNS.find((c) => c.key === key)
                  return (
                    <TableCell key={key} align={col?.align}>
                      {renderOfferCell(key, o)}
                    </TableCell>
                  )
                })}
                <TableCell>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Button size="small" onClick={() => setViewOffer(o)}>
                      Görüntüle
                    </Button>
                    {canDelete && (
                      <Button
                        size="small"
                        color="error"
                        onClick={() => {
                          setDeleteTarget(o)
                          setDeleteError(null)
                        }}
                      >
                        Sil
                      </Button>
                    )}
                    {o.isSold ? (
                      <Chip size="small" color="success" label="Satıldı" />
                    ) : (
                      canMarkSold && (
                        <Button
                          size="small"
                          color="success"
                          onClick={() => {
                            setSoldTarget(o)
                            setSoldError(null)
                          }}
                        >
                          Satıldı
                        </Button>
                      )
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {offersQuery.data?.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
            Henüz kaydedilmiş teklif yok.
          </Typography>
        )}
      </Box>

      <Dialog open={!!viewOffer} onClose={() => setViewOffer(null)} maxWidth="md" fullWidth>
        <DialogTitle>Teklif Detayı</DialogTitle>
        <DialogContent>
          {viewOffer && (
            <OfferPreviewDocument
              containerRef={(el) => {
                viewContainerRef.current = el
              }}
              companyName={viewOffer.companyName}
              companyAddress={viewOffer.companyAddress ?? ''}
              offerDate={viewOffer.offerDate}
              currency={viewOffer.currency}
              vatIncluded={viewOffer.vatIncluded}
              validityDays={viewOffer.validityDays}
              deliveryMethod={viewOffer.deliveryMethod ?? ''}
              deliveryAddress={viewOffer.deliveryAddress ?? ''}
              shippingIncluded={viewOffer.shippingIncluded}
              usdRate={viewOffer.usdRate}
              total={viewOffer.totalAmount}
              brandingCompanyName={brandingQuery.data?.companyName}
              brandingLogoUrl={brandingQuery.data?.logoUrl}
              items={viewOffer.items.map((i) => ({
                stoneName: i.stoneName,
                widthCm: i.widthCm,
                heightCm: i.heightCm,
                thicknessCm: i.thicknessCm,
                texture: i.texture,
                areaM2: i.areaM2,
                unitPrice: i.unitPrice,
                quantity: i.quantity,
              }))}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewOffer(null)}>Kapat</Button>
          <Button variant="contained" disabled={exporting} onClick={handleExportPdf}>
            {exporting ? 'Hazırlanıyor…' : 'PDF İndir'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Teklifi Sil</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            <strong>{deleteTarget?.companyName}</strong> firmasına ait teklif kalıcı olarak silinecek. Bu işlem geri
            alınamaz.
          </Typography>
          {deleteError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {deleteError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Vazgeç</Button>
          <Button
            variant="contained"
            color="error"
            disabled={deleteMutation.isPending}
            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
          >
            Sil
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!soldTarget} onClose={() => setSoldTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Teklifi Satıldı Olarak İşaretle</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            <strong>{soldTarget?.companyName}</strong> firmasına ait teklifteki plakalar Satıldı olarak
            işaretlenecek ve satış tutarları teklif kalemlerindeki fiyatlara göre plakalara işlenecek. Bu işlem
            geri alınamaz.
          </Typography>
          {soldError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {soldError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSoldTarget(null)}>Vazgeç</Button>
          <Button
            variant="contained"
            color="success"
            disabled={markSoldMutation.isPending}
            onClick={() => soldTarget && markSoldMutation.mutate(soldTarget.id)}
          >
            {markSoldMutation.isPending ? 'İşleniyor…' : 'Satıldı Olarak İşaretle'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
