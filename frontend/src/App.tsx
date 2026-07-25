import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import TabBar from './components/TabBar';
import Home from './pages/Home';
import Profile from './pages/Profile';
import StockRecords from './pages/StockRecords';
import Units from './pages/Units';
import MedicineSort from './pages/MedicineSort';
import StopBackfillDate from './pages/StopBackfillDate';
import Login from './pages/Login';
import Register from './pages/Register';
import { ReactNode } from 'react';

function RequireAuth({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const loc = useLocation();
  if (!token) {
    return <Navigate to="/login" state={{ from: loc }} replace />;
  }
  return <>{children}</>;
}

function MainLayout() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/stock-records" element={<StockRecords />} />
        <Route path="/units" element={<Units />} />
        <Route path="/medicine-sort" element={<MedicineSort />} />
        <Route path="/stop-backfill-date" element={<StopBackfillDate />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <TabBar />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/*"
            element={
              <RequireAuth>
                <MainLayout />
              </RequireAuth>
            }
          />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
