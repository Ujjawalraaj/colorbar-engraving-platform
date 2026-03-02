import React, { useState, useEffect } from 'react';
import { Users, Settings, Database, Download, Shield, ShieldCheck, Copy, Eye, EyeOff } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { APP_VERSION } from '../constants/config';

const SettingsView = ({ orders, uniqueCustomers }) => {
  const { authHeaders, isAdmin, API_URL } = useAuth();

  const [settingsData, setSettingsData] = useState({ adminName: '', adminEmail: '' });
  const [profileMessage, setProfileMessage] = useState(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState(null);
  const [savingPassword, setSavingPassword] = useState(false);

  // 2FA state
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpLoaded, setTotpLoaded] = useState(false);
  const [setupStep, setSetupStep] = useState('idle'); // 'idle' | 'scanning' | 'showBackup'
  const [setupData, setSetupData] = useState(null); // { qrCode, secret }
  const [setupCode, setSetupCode] = useState('');
  const [setupMessage, setSetupMessage] = useState(null);
  const [backupCodes, setBackupCodes] = useState([]);
  const [showSecret, setShowSecret] = useState(false);
  const [backupCopied, setBackupCopied] = useState(false);

  // Load profile from backend
  useEffect(() => {
    if (!profileLoaded) {
      fetch(`${API_URL}/api/auth/profile`, { headers: authHeaders() })
        .then(r => r.json())
        .then(data => {
          setSettingsData({ adminName: data.displayName || '', adminEmail: data.email || '' });
          setProfileLoaded(true);
        })
        .catch(() => {});
    }
  }, [profileLoaded, authHeaders, API_URL]);

  // Load TOTP status from backend
  useEffect(() => {
    if (!totpLoaded) {
      fetch(`${API_URL}/api/auth/totp/status`, { headers: authHeaders() })
        .then(r => r.json())
        .then(data => {
          setTotpEnabled(!!data.totpEnabled);
          setTotpLoaded(true);
        })
        .catch(() => {});
    }
  }, [totpLoaded, authHeaders, API_URL]);

  // 2FA handlers
  const handleStartSetup = async () => {
    setSetupMessage(null);
    try {
      const response = await fetch(`${API_URL}/api/auth/totp/setup`, {
        method: 'POST',
        headers: authHeaders()
      });
      const data = await response.json();
      if (!response.ok) {
        setSetupMessage({ type: 'error', text: data.error || 'Failed to start 2FA setup' });
        return;
      }
      setSetupData(data);
      setSetupStep('scanning');
    } catch (error) {
      setSetupMessage({ type: 'error', text: 'Network error' });
    }
  };

  const handleVerifySetup = async () => {
    setSetupMessage(null);
    try {
      const response = await fetch(`${API_URL}/api/auth/totp/verify-setup`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ totpCode: setupCode })
      });
      const data = await response.json();
      if (!response.ok) {
        setSetupMessage({ type: 'error', text: data.error || 'Verification failed' });
        return;
      }
      setBackupCodes(data.backupCodes);
      setSetupStep('showBackup');
      setTotpEnabled(true);
    } catch (error) {
      setSetupMessage({ type: 'error', text: 'Network error' });
    }
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n')).then(() => {
      setBackupCopied(true);
      setTimeout(() => setBackupCopied(false), 2000);
    });
  };

  const handleSaveProfile = async () => {
    setProfileMessage(null);
    setSavingProfile(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/profile`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ displayName: settingsData.adminName, email: settingsData.adminEmail })
      });
      const data = await response.json();
      if (!response.ok) {
        setProfileMessage({ type: 'error', text: data.error || 'Failed to save profile' });
        return;
      }
      setProfileMessage({ type: 'success', text: 'Profile saved successfully' });
    } catch (error) {
      setProfileMessage({ type: 'error', text: 'Network error — is the backend running?' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async () => {
    setPasswordMessage(null);
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'New password must be at least 6 characters' });
      return;
    }
    setSavingPassword(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ oldPassword: currentPassword, newPassword })
      });
      const data = await response.json();
      if (!response.ok) {
        setPasswordMessage({ type: 'error', text: data.error || 'Failed to change password' });
        return;
      }
      setPasswordMessage({ type: 'success', text: 'Password updated successfully' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setPasswordMessage({ type: 'error', text: 'Network error — is the backend running?' });
    } finally {
      setSavingPassword(false);
    }
  };

  const exportData = () => {
    const rows = orders.map((order, idx) => ({
      'S.No': idx + 1,
      'Order ID': order.orderId || '',
      'Order Date': order.orderDate || '',
      'Customer Name': order.customerName || '',
      'Email': order.email || '',
      'Phone': order.phone || '',
      'Product Name': order.productName || '',
      'Shade': order.shade || '',
      'Engraving Text': order.engravingText || '',
      'Motifs': Array.isArray(order.motifs) ? order.motifs.join(', ') : '',
      'Font': order.font || '',
      'Total Amount': order.totalAmount || '',
      'Status': order.status || 'Pending',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 5 }, { wch: 14 }, { wch: 12 }, { wch: 20 }, { wch: 28 },
      { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 18 }, { wch: 12 },
      { wch: 12 }, { wch: 12 }, { wch: 10 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Engraving Orders');
    const fileName = `colorbar-engraving-orders-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const resetAllData = async () => {
    if (!window.confirm('Are you sure you want to reset all data? This action cannot be undone!')) return;
    try {
      const response = await fetch(`${API_URL}/api/reset`, {
        method: 'POST',
        headers: authHeaders()
      });
      const data = await response.json();
      if (!response.ok) {
        alert(data.error || 'Failed to reset data');
        return;
      }
      alert(data.message || 'Data reset successfully');
    } catch (error) {
      alert('Network error — is the backend running?');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Users size={20} className="text-orange-600" />
          Account Settings
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="display-name" className="block text-sm font-medium text-gray-700 mb-2">Display Name</label>
            <input
              id="display-name"
              type="text"
              value={settingsData.adminName}
              onChange={(e) => { setSettingsData(prev => ({ ...prev, adminName: e.target.value })); setProfileMessage(null); }}
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Enter your display name"
            />
          </div>
          <div>
            <label htmlFor="email-address" className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
            <input
              id="email-address"
              type="email"
              value={settingsData.adminEmail}
              onChange={(e) => { setSettingsData(prev => ({ ...prev, adminEmail: e.target.value })); setProfileMessage(null); }}
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Enter your email address"
            />
          </div>
        </div>
        {profileMessage && (
          <div className={`mt-3 p-3 rounded-lg border ${profileMessage.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            <p className="text-sm">{profileMessage.text}</p>
          </div>
        )}
        <button
          onClick={handleSaveProfile}
          disabled={savingProfile}
          className="mt-4 px-6 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {savingProfile ? 'Saving...' : 'Save Profile'}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Settings size={20} className="text-orange-600" />
          Change Password
        </h3>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Enter current password"
            />
          </div>
          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Enter new password"
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Confirm new password"
            />
          </div>
        </div>
        {passwordMessage && (
          <div className={`mt-3 p-3 rounded-lg border ${passwordMessage.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            <p className="text-sm">{passwordMessage.text}</p>
          </div>
        )}
        <button
          onClick={handlePasswordChange}
          disabled={savingPassword}
          className="mt-4 px-6 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {savingPassword ? 'Updating...' : 'Update Password'}
        </button>
      </div>

      {/* Two-Factor Authentication */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Shield size={20} className="text-orange-600" />
          Two-Factor Authentication
        </h3>

        {setupStep === 'idle' && !totpEnabled && (
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Add an extra layer of security to your account by enabling two-factor authentication with Google Authenticator or any TOTP-compatible app.
            </p>
            <button
              onClick={handleStartSetup}
              className="flex items-center gap-2 px-6 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition font-medium"
            >
              <ShieldCheck size={16} />
              Set Up Two-Factor Authentication
            </button>
          </div>
        )}

        {setupStep === 'idle' && totpEnabled && (
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
              <ShieldCheck size={14} />
              Enabled
            </span>
            <span className="text-sm text-gray-600">Two-factor authentication is active on your account. Contact an admin to reset it.</span>
          </div>
        )}

        {setupStep === 'scanning' && setupData && (
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code below to verify.
            </p>
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="bg-white p-3 rounded-lg border shadow-sm">
                <img src={setupData.qrCode} alt="TOTP QR Code" className="w-48 h-48" />
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Manual entry key
                    <button
                      onClick={() => setShowSecret(!showSecret)}
                      className="ml-2 text-gray-400 hover:text-gray-600"
                    >
                      {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </label>
                  <code className="block p-2 bg-gray-100 rounded text-sm font-mono break-all">
                    {showSecret ? setupData.secret : '************************************'}
                  </code>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Enter verification code</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={setupCode}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        if (val.length <= 6) setSetupCode(val);
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && setupCode.length === 6 && handleVerifySetup()}
                      className="w-40 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-center text-lg tracking-widest font-mono"
                      placeholder="000000"
                      autoFocus
                    />
                    <button
                      onClick={handleVerifySetup}
                      disabled={setupCode.length !== 6}
                      className="px-6 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Verify
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => { setSetupStep('idle'); setSetupData(null); setSetupCode(''); setSetupMessage(null); }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel setup
                </button>
              </div>
            </div>
          </div>
        )}

        {setupStep === 'showBackup' && (
          <div>
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
              <p className="text-sm font-semibold text-yellow-800 mb-1">Save your backup codes</p>
              <p className="text-sm text-yellow-700">
                These codes can be used to access your account if you lose your authenticator device. Each code can only be used once. Store them in a safe place.
              </p>
            </div>
            <div className="bg-gray-50 border rounded-lg p-4 mb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {backupCodes.map((code, i) => (
                  <code key={i} className="text-center py-2 px-3 bg-white border rounded text-sm font-mono font-semibold text-gray-800">
                    {code}
                  </code>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={copyBackupCodes}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-200 transition text-sm font-medium"
              >
                <Copy size={14} />
                {backupCopied ? 'Copied!' : 'Copy all codes'}
              </button>
              <button
                onClick={() => { setSetupStep('idle'); setBackupCodes([]); setSetupData(null); setSetupCode(''); }}
                className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition text-sm font-medium"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {setupMessage && (
          <div className={`mt-3 p-3 rounded-lg border ${setupMessage.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            <p className="text-sm">{setupMessage.text}</p>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="bg-white rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Database size={20} className="text-orange-600" />
            Data Management
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div>
                <p className="font-medium text-blue-900">Export All Orders</p>
                <p className="text-sm text-blue-700">Download all order data as Excel file (.xlsx)</p>
              </div>
              <button
                onClick={exportData}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
              >
                <Download size={16} />
                Export
              </button>
            </div>
            <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
              <div>
                <p className="font-medium text-red-900">Reset All Data</p>
                <p className="text-sm text-red-700">Clear all orders and settings (Cannot be undone)</p>
              </div>
              <button
                onClick={resetAllData}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
              >
                Reset Data
              </button>
            </div>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="bg-white rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold mb-4">System Information</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="p-3 bg-gray-50 rounded">
              <p className="text-gray-600">Total Orders</p>
              <p className="text-xl font-semibold text-gray-900">{orders.length}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded">
              <p className="text-gray-600">Total Customers</p>
              <p className="text-xl font-semibold text-gray-900">{uniqueCustomers.length}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded">
              <p className="text-gray-600">Total Revenue</p>
              <p className="text-xl font-semibold text-gray-900">
                ₹{orders.reduce((sum, o) => sum + parseFloat(o.totalAmount || 0), 0).toLocaleString('en-IN')}
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded">
              <p className="text-gray-600">Version</p>
              <p className="text-xl font-semibold text-gray-900">v{APP_VERSION}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsView;
