import { Route, Routes, BrowserRouter as Router, Navigate } from 'react-router-dom';
import LoginComponent from "./pages/login/LoginComponent";
import DashboardComponent from './pages/dashboard/DashboardComponent';
import NotificationComponent from './pages/notifications/NotificationComponent';
import ParametreComponent from './pages/parametres/ParametreComponent';
import AllGestionLeadsComponent from './pages/gestionLead/AllGestionLead/AllGestionLeadsComponent';
import AnalyseComponent from './pages/analyse/AnalyseComponent';
import Agent from './pages/agents/Agent/Agent';
import FichierAgent from './pages/agents/FicherAgent/FichierAgent';
import NewAgent from './pages/agents/NewAgent/NewAgent';
import VenteComponent from './pages/ventes/Vente/VenteComponent';
import DossierVenteComponent from './pages/ventes/DossierVente/DossierVenteComponent';
import EnchereComponent from './pages/enchere/AllEnchere/EnchereComponent';
import EnchereDetailComponent from './pages/enchere/enchereDetail/EnchereDetailComponent';
import UpdateAgent from './pages/agents/UpdateAgent/UpdateAgent';
import ParametreAdmin from './pages/parametres/ParametreAdmin';
import LayoutAdmin from './components/layout/LayoutAdmin';
import Commissions from './pages/commissions/Commissions';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Wrap LayoutAdmin + ProtectedRoute together to keep routes clean
const Protected = ({ children }) => (
  <ProtectedRoute>
    <LayoutAdmin>{children}</LayoutAdmin>
  </ProtectedRoute>
);

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LoginComponent />} />

          {/* Protected dashboard routes */}
          <Route path="/tableau-de-bord"              element={<Protected><DashboardComponent /></Protected>} />
          <Route path="/notification"                 element={<Protected><NotificationComponent /></Protected>} />
          <Route path="/parametre"                    element={<Protected><ParametreComponent /></Protected>} />
          <Route path="/parametre/parametre-admin"    element={<Protected><ParametreAdmin /></Protected>} />
          <Route path="/gestion-leads"                element={<Protected><AllGestionLeadsComponent /></Protected>} />
          <Route path="/analyse"                      element={<Protected><AnalyseComponent /></Protected>} />
          <Route path="/commissions"                  element={<Protected><Commissions /></Protected>} />
          <Route path="/agents"                       element={<Protected><Agent /></Protected>} />
          <Route path="/agents/modifier-agent"        element={<Protected><UpdateAgent /></Protected>} />
          <Route path="/agents/fichier-agent"         element={<Protected><FichierAgent /></Protected>} />
          <Route path="/agents/ajouter-agent"         element={<Protected><NewAgent /></Protected>} />
          <Route path="/enchere"                      element={<Protected><EnchereComponent /></Protected>} />
          <Route path="/enchere/enchere-detail"       element={<Protected><EnchereDetailComponent /></Protected>} />
          <Route path="/ventes"                       element={<Protected><VenteComponent /></Protected>} />
          <Route path="/ventes/dossier-vente"         element={<Protected><DossierVenteComponent /></Protected>} />

          {/* Catch-all → login */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;