import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import Admin from './pages/Admin';
import Marketplace from './pages/Marketplace';
import Docs from './pages/Docs';
import Pricing from './pages/Pricing';
import Confirm from './pages/Confirm';
import Verify from './pages/Verify';
import './index.css';
import { ThemeProvider } from './components/ThemeProvider';

// Simple protected route helper
function PrivateRoute({ children }: { children: React.ReactElement }) {
  // In a real app, use auth state to verify login. 
  // We'll rely on Dashboard's logic for full data loading for now.
  return children;
}

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/confirm" element={<Confirm />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/extensions" element={<Marketplace />} />
        <Route path="/docs" element={<Docs />} />

        {/* Dynamic user dashboard */}
        <Route path="/dashboard/:username" element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        } />
        
        {/* Fallback route */}
        <Route path="/dashboard" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
