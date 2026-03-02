import React, { createContext, useContext, useState, useCallback } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authToken, setAuthToken] = useState(null);
  const [loggedInUser, setLoggedInUser] = useState('');
  const [userRole, setUserRole] = useState('');

  const isAdmin = userRole === 'admin';

  const authHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`
  }), [authToken]);

  const login = (username, token, role) => {
    setLoggedInUser(username);
    setAuthToken(token);
    setUserRole(role || 'user');
    setIsLoggedIn(true);
  };

  const logout = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: authHeaders()
      });
    } catch (_) { /* best-effort */ }
    setIsLoggedIn(false);
    setAuthToken(null);
    setLoggedInUser('');
    setUserRole('');
  };

  return (
    <AuthContext.Provider value={{
      isLoggedIn, authToken, loggedInUser, userRole, isAdmin,
      authHeaders, login, logout, API_URL
    }}>
      {children}
    </AuthContext.Provider>
  );
};
