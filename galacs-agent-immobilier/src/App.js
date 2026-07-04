import { Route, Routes, BrowserRouter as Router, Navigate } from 'react-router-dom';
import LoginComponent from './pages/login/LoginComponent';
import DashboardComponent from './pages/dashboard/DashboardComponent';
import LeadsComponent from './pages/leads/LeadsComponent';
import CrmComponent from './pages/crm/CrmComponent';
import PipelineComponent from './pages/pipeline/PipelineComponent';
import NotificationsComponent from './pages/notifications/NotificationsComponent';
import ProfileComponent from './pages/profile/ProfileComponent';
import ParametresComponent from './pages/parametres/ParametresComponent';
import FicheLeadComponent from './pages/leads/FicheLeadComponent';
import EnchèreLiveComponent from './pages/leads/EnchèreLiveComponent';
import DeclarerVenteComponent from './pages/pipeline/DeclarerVenteComponent';
import StatusComponent from './pages/pipeline/StatusComponent';
import ContactDetaileCompenent from './pages/crm/ContactDetaileCompenent';
import NewContactComponent from './pages/crm/NewContactComponent';
import EditContactComponent from './pages/crm/EditContactComponent';
import EditProfileComponent from './pages/parametres/EditProfileComponent';
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import { AgentAuthProvider } from './contexts/AgentAuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { NotificationProvider } from './contexts/NotificationProvider';
const Layout = ({ children }) => (
  <div id="app">
    <Sidebar />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Topbar />
      <div id="page-area" style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  </div>
);

// Combines ProtectedRoute + Layout into one wrapper
const Protected = ({ children }) => (
  <ProtectedRoute>
    <Layout>{children}</Layout>
  </ProtectedRoute>
);

function App() {
  return (
    <AgentAuthProvider>
        <NotificationProvider>

      <Router>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LoginComponent />} />

          {/* Protected agent routes */}
          <Route path="/tableau-de-bord"          element={<Protected><DashboardComponent /></Protected>} />
          <Route path="/leads"                    element={<Protected><LeadsComponent /></Protected>} />
          <Route path="/leads/fichier_leads"      element={<Protected><FicheLeadComponent /></Protected>} />
          <Route path="/leads/enchère_live"       element={<Protected><EnchèreLiveComponent /></Protected>} />
          <Route path="/pipeline"                 element={<Protected><PipelineComponent /></Protected>} />
          <Route path="/pipeline/declarer_vente"  element={<Protected><DeclarerVenteComponent /></Protected>} />
          <Route path="/pipeline/status"          element={<Protected><StatusComponent /></Protected>} />
          <Route path="/crm"                      element={<Protected><CrmComponent /></Protected>} />
          <Route path="/crm/contact_detail"       element={<Protected><ContactDetaileCompenent /></Protected>} />
          <Route path="/crm/nouvelle_contact"     element={<Protected><NewContactComponent /></Protected>} />
          <Route path="/crm/modifier-contact"     element={<Protected><EditContactComponent /></Protected>} />
          <Route path="/notifications"            element={<Protected><NotificationsComponent /></Protected>} />
          <Route path="/profile"                  element={<Protected><ProfileComponent /></Protected>} />
          <Route path="/parametres"               element={<Protected><ParametresComponent /></Protected>} />
          <Route path="/parametres/edit-profile"  element={<Protected><EditProfileComponent /></Protected>} />

          {/* Catch-all → login */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
        </NotificationProvider>

    </AgentAuthProvider>
  );
}

export default App;