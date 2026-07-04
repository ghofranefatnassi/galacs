import { Navigate } from 'react-router-dom';
import { useAgentAuth } from '../contexts/AgentAuthContext';

export default function ProtectedRoute({ children }) {
  const { user } = useAgentAuth();
  if (!user) return <Navigate to="/" replace />;
  return children;
}