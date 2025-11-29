import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const { token } = useAuthStore();
    if (!token) return <Navigate to="/login" replace />;
    return <>{children}</>;
};
