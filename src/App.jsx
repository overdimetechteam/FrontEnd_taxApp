import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/common/ProtectedRoute'

// Auth
import Login from './pages/auth/Login'
import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword from './pages/auth/ResetPassword'

// Client pages
import ClientLayout from './components/layout/ClientLayout'
import ClientDashboard from './pages/client/Dashboard'
import TaxFormPage from './pages/client/TaxFormPage'
import ClientConfirmation from './pages/client/ClientConfirmation'

// Consultant pages
import ConsultantLayout from './components/layout/ConsultantLayout'
import ConsultantDashboard from './pages/consultant/Dashboard'
import ClientList from './pages/consultant/ClientList'
import RegisterClient from './pages/consultant/RegisterClient'
import ClientDetail from './pages/consultant/ClientDetail'
import TaxCalculation from './pages/consultant/TaxCalculation'
import ArchivePage from './pages/consultant/ArchivePage'
import Portfolio from './pages/consultant/Portfolio'
import StatusDrillDown from './pages/consultant/StatusDrillDown'

// Accounts Division pages
import AccountsDeptLayout from './components/layout/AccountsDeptLayout'
import AccountsDashboard from './pages/accounts/Dashboard'

// Super Admin pages
import SuperAdminLayout from './components/layout/SuperAdminLayout'
import SuperAdminDashboard from './pages/superadmin/Dashboard'
import SuperAdminClientList from './pages/superadmin/ClientList'
import ConsultantManagement from './pages/superadmin/ConsultantManagement'
import AccountsManagement from './pages/superadmin/AccountsManagement'
import TaxYears from './pages/superadmin/TaxYears'
import Messages from './pages/superadmin/Messages'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Client Routes */}
          <Route element={<ProtectedRoute role="client" />}>
            <Route element={<ClientLayout />}>
              <Route path="/client/dashboard" element={<ClientDashboard />} />
              <Route path="/client/tax-form/:submissionId?" element={<TaxFormPage />} />
              <Route path="/client/confirm/:submissionId" element={<ClientConfirmation />} />
            </Route>
          </Route>

          {/* Consultant Routes */}
          <Route element={<ProtectedRoute role="consultant" />}>
            <Route element={<ConsultantLayout />}>
              <Route path="/consultant/dashboard" element={<ConsultantDashboard />} />
              <Route path="/consultant/clients/register" element={<RegisterClient />} />
              <Route path="/consultant/archive" element={<ArchivePage />} />
              <Route path="/consultant/portfolio" element={<Portfolio />} />
              <Route path="/consultant/status/:statusKey" element={<StatusDrillDown />} />
            </Route>
          </Route>

          {/* Client detail & tax computation — shared by consultants and super_admin
              (super_admin needs this to edit returns even after client confirmation/archive) */}
          <Route element={<ProtectedRoute roles={['consultant', 'super_admin']} />}>
            <Route element={<ConsultantLayout />}>
              <Route path="/consultant/clients" element={<ClientList />} />
              <Route path="/consultant/clients/:clientId" element={<ClientDetail />} />
              <Route path="/consultant/submissions/:submissionId/calculate" element={<TaxCalculation />} />
            </Route>
          </Route>

          {/* Accounts Division Routes */}
          <Route element={<ProtectedRoute role="accounts_division" />}>
            <Route element={<AccountsDeptLayout />}>
              <Route path="/accounts/dashboard" element={<AccountsDashboard />} />
            </Route>
          </Route>

          {/* Super Admin Routes */}
          <Route element={<ProtectedRoute role="super_admin" />}>
            <Route element={<SuperAdminLayout />}>
              <Route path="/super-admin/dashboard" element={<SuperAdminDashboard />} />
              <Route path="/super-admin/messages" element={<Messages />} />
              <Route path="/super-admin/clients" element={<SuperAdminClientList />} />
              <Route path="/super-admin/clients/register" element={<RegisterClient />} />
              <Route path="/super-admin/consultants" element={<ConsultantManagement />} />
              <Route path="/super-admin/accounts" element={<AccountsManagement />} />
              <Route path="/super-admin/tax-years" element={<TaxYears />} />
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
