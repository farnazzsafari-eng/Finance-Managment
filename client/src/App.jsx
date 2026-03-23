import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout/Layout';
import { Login, Register, JoinHousehold } from './pages/Login';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Assets from './pages/Assets';
import Import from './pages/Import';
import Settings from './pages/Settings';
import Pricing from './pages/Pricing';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 60, textAlign: 'center' }}>Loading...</div>;
  return user ? children : <Navigate to="/login" />;
}

function WriteProtectedRoute({ children }) {
  const { user, loading, isAdvisor } = useAuth();
  if (loading) return <div style={{ padding: 60, textAlign: 'center' }}>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (isAdvisor) return <Navigate to="/" />;
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return null;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" /> : <Register />} />
      <Route path="/join/:inviteToken" element={user ? <Navigate to="/" /> : <JoinHousehold />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/accounts" element={<Navigate to="/settings" />} />
        <Route path="/reports" element={<Navigate to="/transactions" />} />
        <Route path="/assets" element={<Assets />} />
        <Route path="/import" element={<WriteProtectedRoute><Import /></WriteProtectedRoute>} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/pricing" element={<Pricing />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
