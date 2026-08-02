import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import LoginPage from './pages/LoginPage.jsx';
import PushApprovePage from './pages/PushApprovePage.jsx';
import Navbar from './components/Navbar.jsx';

// Video App imports
import { ThemeProvider } from './context/ThemeContext';
import { MeetingProvider } from './context/MeetingContext';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import History from './pages/History';
import Settings from './pages/Settings';
import MeetingRoom from './pages/MeetingRoom';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  return user ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  return children;
}

function FullPageLoader() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--cream)',
      flexDirection: 'column', gap: '16px'
    }}>
      <div className="spinner" style={{ width: 32, height: 32, color: 'var(--gold)' }} />
      <p style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-body)', fontSize: 14 }}>
        Loading…
      </p>
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const isVideoRoute = location.pathname.startsWith('/dashboard') || 
                       location.pathname.startsWith('/history') || 
                       location.pathname.startsWith('/settings') || 
                       location.pathname.startsWith('/meeting');
  const showNavbar = !isVideoRoute;

  return (
    <AuthProvider>
      <ThemeProvider>
        <MeetingProvider>
          <>
            {showNavbar && <Navbar />}
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/login" element={
                <PublicRoute><LoginPage /></PublicRoute>
              } />
              <Route path="/push-approve" element={
                <PublicRoute><PushApprovePage /></PublicRoute>
              } />
              
              {/* Video Dashboard Protected Routes */}
              <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/history" element={<History />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
              {/* Meeting Room - Accessible without login so guests can join */}
              <Route path="/meeting/:roomName" element={<MeetingRoom />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </>
        </MeetingProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
