import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { FiltersProvider } from './context/FiltersContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MainPage from './pages/MainPage';
import UploadPage from './pages/UploadPage';
import Profile from './pages/Profile';
import Signup from './pages/Signup';
import TradeDataPage from './pages/TradeDataPage';
import DataDeduplication from './pages/DataDeduplication';
import UserManagement from './pages/UserManagement';
import ReportsPage from './pages/ReportsPage';
import './App.css';

function App() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const token = localStorage.getItem('authToken');
    return !!token;
  });

  const [userRole, setUserRole] = useState(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        return user.role || 'user';
      } catch (e) {
        return '';
      }
    }
    return '';
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleLogin = (user) => {
    setIsAuthenticated(true);
    if (user && user.role) {
      setUserRole(user.role);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUserRole('');
  };

  return (
    <Router>
      <div className="App">
        {isAuthenticated && (
          <Navbar
            theme={theme}
            toggleTheme={toggleTheme}
            onLogout={handleLogout}
            userRole={userRole}
          />
        )}

        <FiltersProvider>
          <div className={isAuthenticated ? 'container' : 'container-full'}>
          <Routes>

            {/* Public Routes */}
            <Route
              path="/login"
              element={isAuthenticated ? <Navigate to="/" replace /> : <Login onLogin={handleLogin} />}
            />
            <Route
              path="/signup"
              element={isAuthenticated ? <Navigate to="/" replace /> : <Signup />}
            />


            {/* Protected Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute isAuthenticated={isAuthenticated} userRole={userRole}>
                  <MainPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute isAuthenticated={isAuthenticated} userRole={userRole}>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute isAuthenticated={isAuthenticated} userRole={userRole}>
                  <ReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/upload"
              element={
                <ProtectedRoute isAuthenticated={isAuthenticated} userRole={userRole}>
                  <UploadPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/trade-data"
              element={
                <ProtectedRoute isAuthenticated={isAuthenticated} userRole={userRole}>
                  <TradeDataPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute isAuthenticated={isAuthenticated} userRole={userRole}>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/deduplication"
              element={
                <ProtectedRoute
                  isAuthenticated={isAuthenticated}
                  userRole={userRole}
                  requiredRole="admin"
                >
                  <DataDeduplication />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute
                  isAuthenticated={isAuthenticated}
                  userRole={userRole}
                  requiredRole="admin"
                >
                  <UserManagement />
                </ProtectedRoute>
              }
            />

            {/* Default redirect */}
            <Route path="*" element={<Navigate to={isAuthenticated ? '/' : '/login'} replace />} />
          </Routes>
          </div>
        </FiltersProvider>

        {isAuthenticated && <Footer />}
      </div>
    </Router>
  );
}

export default App;