export interface PermissionGroup {
  title: string
  keys: string[]
}

export const PERMISSION_LABELS: Record<string, string> = {
  'stones.view': 'Taşları Görüntüle',
  'stones.create': 'Taş Ekle',
  'stones.edit': 'Taş Düzenle',
  'stones.delete': 'Taş Sil',
  'incomingstock.view': 'Gelen Parti/Lot Görüntüle',
  'incomingstock.create': 'Gelen Parti/Lot Ekle',
  'incomingstock.edit': 'Gelen Parti/Lot Düzenle',
  'incomingstock.delete': 'Gelen Parti/Lot Sil',
  'plates.view': 'Plakaları Görüntüle',
  'plates.create': 'Plaka Ekle',
  'plates.edit': 'Plaka Düzenle',
  'plates.delete': 'Plaka Sil',
  'cost.unit.view': 'Birim Maliyeti Görüntüle',
  'cost.currency.view': 'Maliyet Para Birimini Görüntüle',
  'cost.sale.view': 'Satış Maliyetini Görüntüle',
  'users.manage': 'Kullanıcı Yönetimi',
  'settings.manage': 'Sistem Ayarlarını Yönet',
  'theme.manage': 'Tema Yönetimi',
  'notifications.view': 'Bildirim Geçmişini Görüntüle',
  'auditlog.view': 'Denetim Kaydını Görüntüle',
  'qrscanlog.view': 'QR Tarama Geçmişini Görüntüle',
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  { title: 'Taşlar', keys: ['stones.view', 'stones.create', 'stones.edit', 'stones.delete'] },
  {
    title: 'Gelen Parti/Lot',
    keys: ['incomingstock.view', 'incomingstock.create', 'incomingstock.edit', 'incomingstock.delete'],
  },
  { title: 'Plakalar', keys: ['plates.view', 'plates.create', 'plates.edit', 'plates.delete'] },
  { title: 'Maliyet', keys: ['cost.unit.view', 'cost.currency.view', 'cost.sale.view'] },
  { title: 'Bildirimler', keys: ['notifications.view'] },
  { title: 'Geçmiş Kayıtları', keys: ['qrscanlog.view', 'auditlog.view'] },
  { title: 'Yönetim', keys: ['users.manage', 'settings.manage', 'theme.manage'] },
]
