import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { LoginPage } from './pages/Login/LoginPage'
import { SetupPage } from './pages/Setup/SetupPage'
import { DashboardPage } from './pages/Dashboard/DashboardPage'
import { UsersPage } from './pages/Users/UsersPage'
import { RolesPage } from './pages/Roles/RolesPage'
import { DatabaseConnectionPage } from './pages/Settings/DatabaseConnectionPage'
import { StonesPage } from './pages/Stones/StonesPage'
import { IncomingStockPage } from './pages/IncomingStock/IncomingStockPage'
import { PlatesPage } from './pages/Plates/PlatesPage'
import { QrScanPage } from './pages/QrScan/QrScanPage'
import { QrScanHistoryPage } from './pages/QrScanHistory/QrScanHistoryPage'
import { NotificationsPage } from './pages/Notifications/NotificationsPage'
import { SystemSettingsPage } from './pages/Settings/SystemSettingsPage'
import { AuditLogPage } from './pages/AuditLog/AuditLogPage'

function App() {
  return (
    <Routes>
      <Route path="/giris" element={<LoginPage />} />
      <Route path="/kurulum" element={<SetupPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/qr-tara" element={<QrScanPage />} />

          <Route element={<ProtectedRoute permission="stones.view" />}>
            <Route path="/taslar" element={<StonesPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="incomingstock.view" />}>
            <Route path="/gelen-stok" element={<IncomingStockPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="plates.view" />}>
            <Route path="/plakalar" element={<PlatesPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="notifications.view" />}>
            <Route path="/bildirim-gecmisi" element={<NotificationsPage />} />
          </Route>

          <Route element={<ProtectedRoute permission="users.manage" />}>
            <Route path="/kullanicilar" element={<UsersPage />} />
            <Route path="/roller" element={<RolesPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="qrscanlog.view" />}>
            <Route path="/qr-tarama-gecmisi" element={<QrScanHistoryPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="auditlog.view" />}>
            <Route path="/denetim-kaydi" element={<AuditLogPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="settings.manage" />}>
            <Route path="/ayarlar/sistem" element={<SystemSettingsPage />} />
            <Route path="/ayarlar/veritabani" element={<DatabaseConnectionPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
