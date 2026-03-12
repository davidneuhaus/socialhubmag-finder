import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminRoute({ children }) {
    const { admin, loading } = useAuth();

    if (loading) {
        return (
            <div className="admin-loading">
                <div className="button-spinner" />
            </div>
        );
    }

    if (!admin) {
        return <Navigate to="/admin/login" replace />;
    }

    return children;
}
