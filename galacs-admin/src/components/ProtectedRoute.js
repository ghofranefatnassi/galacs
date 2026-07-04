import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user } = useAuth();

  // Not logged in → redirect to login
  if (!user) return <Navigate to="/login" replace />;

  return children;
}