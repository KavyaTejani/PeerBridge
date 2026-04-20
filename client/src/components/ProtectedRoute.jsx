import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function ProtectedRoute({ children }) {
  const { user } = useAuth();
  
  if (user === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-xl font-mono text-gray-600 animate-pulse">Loading Auth...</div>
      </div>
    );
  }

  if (user === null) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
