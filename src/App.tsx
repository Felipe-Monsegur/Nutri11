import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { DataProvider } from './context/DataContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import NotAuthorized from './pages/NotAuthorized';
import Dashboard from './pages/Dashboard';
import MealHistory from './pages/MealHistory';
import MealForm from './pages/MealForm';
import Management from './pages/Management';
import InfoPage from './pages/InfoPage';

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);

  return null;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isAllowed, checkingAccess } = useAuth();

  if (loading || checkingAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0c111b]">
        <div className="text-lg text-slate-200 tracking-wide animate-pulse">Cargando...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (!isAllowed) {
    return <Navigate to="/not-authorized" />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/not-authorized" element={<NotAuthorized />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/comidas"
        element={
          <ProtectedRoute>
            <Layout>
              <MealHistory />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/comidas/nueva"
        element={
          <ProtectedRoute>
            <Layout>
              <MealForm />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/comidas/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <MealForm />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/gestion"
        element={
          <ProtectedRoute>
            <Layout>
              <Management />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/informacion"
        element={
          <ProtectedRoute>
            <Layout>
              <InfoPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route path="/entrenamientos/*" element={<Navigate to="/comidas" replace />} />
      <Route path="/progreso" element={<Navigate to="/" replace />} />
      <Route path="/peso" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <ThemeProvider>
          <DataProvider>
            <ToastProvider>
              <AppRoutes />
            </ToastProvider>
          </DataProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
