import React, { useState } from 'react';
import { Shield, Copy, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ColorbarLogo from './ColorbarLogo';

const LoginPage = () => {
  const { login, API_URL } = useAuth();
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // 2FA verification state
  const [step, setStep] = useState('credentials'); // 'credentials' | 'totp' | 'setup' | 'setupVerify' | 'backupCodes'
  const [pendingToken, setPendingToken] = useState('');
  const [totpCode, setTotpCode] = useState('');

  // Mandatory 2FA setup state (for users without 2FA)
  const [setupToken, setSetupToken] = useState('');
  const [setupRole, setSetupRole] = useState('');
  const [setupData, setSetupData] = useState(null); // { qrCode, secret }
  const [setupCode, setSetupCode] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [backupCodes, setBackupCodes] = useState([]);
  const [backupCopied, setBackupCopied] = useState(false);

  const handleLoginClick = async () => {
    setLoginError('');
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      const data = await response.json();
      if (!response.ok) {
        setLoginError(data.error || 'Login failed');
        return;
      }

      // User has 2FA enabled — go to TOTP code entry
      if (data.requires2FA) {
        setPendingToken(data.pendingToken);
        setStep('totp');
        return;
      }

      // User has no 2FA — must set it up before accessing dashboard
      if (data.totpEnabled === false) {
        setSetupToken(data.token);
        setSetupRole(data.role);
        await startTotpSetup(data.token);
        return;
      }

      // Fallback (shouldn't reach here normally)
      login(loginUsername, data.token, data.role);
    } catch (error) {
      setLoginError('Cannot connect to server. Is the backend running?');
    }
  };

  const startTotpSetup = async (token) => {
    setLoginError('');
    try {
      const response = await fetch(`${API_URL}/api/auth/totp/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (!response.ok) {
        setLoginError(data.error || 'Failed to start 2FA setup');
        return;
      }
      setSetupData(data);
      setStep('setup');
    } catch (error) {
      setLoginError('Network error during 2FA setup');
    }
  };

  const handleVerifySetup = async () => {
    setLoginError('');
    try {
      const response = await fetch(`${API_URL}/api/auth/totp/verify-setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${setupToken}`
        },
        body: JSON.stringify({ totpCode: setupCode })
      });
      const data = await response.json();
      if (!response.ok) {
        setLoginError(data.error || 'Verification failed');
        return;
      }
      setBackupCodes(data.backupCodes);
      setStep('backupCodes');
    } catch (error) {
      setLoginError('Network error during verification');
    }
  };

  const handleSetupComplete = () => {
    login(loginUsername, setupToken, setupRole);
  };

  const handleVerify2FA = async () => {
    setLoginError('');
    try {
      const response = await fetch(`${API_URL}/api/auth/verify-2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingToken, totpCode })
      });
      const data = await response.json();
      if (!response.ok) {
        setLoginError(data.error || 'Verification failed');
        return;
      }
      login(loginUsername, data.token, data.role);
    } catch (error) {
      setLoginError('Cannot connect to server. Is the backend running?');
    }
  };

  const handleBackToLogin = () => {
    setStep('credentials');
    setPendingToken('');
    setTotpCode('');
    setSetupToken('');
    setSetupRole('');
    setSetupData(null);
    setSetupCode('');
    setBackupCodes([]);
    setLoginError('');
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n')).then(() => {
      setBackupCopied(true);
      setTimeout(() => setBackupCopied(false), 2000);
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 to-pink-600 flex items-center justify-center p-4">
      <div className={`bg-white rounded-2xl shadow-2xl p-8 w-full ${step === 'setup' || step === 'backupCodes' ? 'max-w-lg' : 'max-w-md'}`}>
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <ColorbarLogo width="182" />
          </div>
          {step === 'credentials' && (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Admin Panel</h1>
              <p className="text-gray-600">Engraving Orders Management</p>
            </>
          )}
          {step === 'totp' && (
            <>
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-orange-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Two-Factor Authentication</h2>
              <p className="text-sm text-gray-600 mt-1">Enter the 6-digit code from your authenticator app</p>
            </>
          )}
          {step === 'setup' && (
            <>
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-orange-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Set Up Two-Factor Authentication</h2>
              <p className="text-sm text-gray-600 mt-1">2FA is required for all accounts. Scan the QR code with your authenticator app.</p>
            </>
          )}
          {step === 'backupCodes' && (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Save Your Backup Codes</h2>
              <p className="text-sm text-gray-600 mt-1">Store these codes safely. Each can only be used once.</p>
            </>
          )}
        </div>

        {/* Step 1: Credentials */}
        {step === 'credentials' && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
              <input
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLoginClick()}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Enter username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLoginClick()}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Enter password"
              />
            </div>
            {loginError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700 text-center">{loginError}</p>
              </div>
            )}
            <button
              onClick={handleLoginClick}
              className="w-full bg-orange-600 text-white py-3 rounded-lg font-semibold hover:bg-orange-700 transition shadow-lg"
            >
              Sign In
            </button>
          </div>
        )}

        {/* Step 2a: TOTP code entry (user already has 2FA) */}
        {step === 'totp' && (
          <div className="space-y-6">
            <div>
              <input
                type="text"
                value={totpCode}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9a-fA-F]/g, '');
                  if (val.length <= 8) setTotpCode(val);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleVerify2FA()}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-center text-2xl tracking-widest font-mono"
                placeholder="000000"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-2 text-center">
                Lost your authenticator? Enter a backup code instead.
              </p>
            </div>
            {loginError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700 text-center">{loginError}</p>
              </div>
            )}
            <button
              onClick={handleVerify2FA}
              className="w-full bg-orange-600 text-white py-3 rounded-lg font-semibold hover:bg-orange-700 transition shadow-lg"
            >
              Verify
            </button>
            <button
              onClick={handleBackToLogin}
              className="w-full text-sm text-gray-500 hover:text-gray-700 transition"
            >
              Back to login
            </button>
          </div>
        )}

        {/* Step 2b: Mandatory 2FA setup (user has no 2FA) */}
        {step === 'setup' && setupData && (
          <div className="space-y-5">
            <div className="flex justify-center">
              <div className="bg-white p-3 rounded-lg border shadow-sm">
                <img src={setupData.qrCode} alt="TOTP QR Code" className="w-48 h-48" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Manual entry key
                <button
                  onClick={() => setShowSecret(!showSecret)}
                  className="ml-2 text-gray-400 hover:text-gray-600 inline-flex items-center"
                >
                  {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </label>
              <code className="block p-2 bg-gray-100 rounded text-sm font-mono break-all">
                {showSecret ? setupData.secret : '************************************'}
              </code>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Enter the 6-digit code from your app</label>
              <input
                type="text"
                value={setupCode}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  if (val.length <= 6) setSetupCode(val);
                }}
                onKeyDown={(e) => e.key === 'Enter' && setupCode.length === 6 && handleVerifySetup()}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-center text-2xl tracking-widest font-mono"
                placeholder="000000"
                autoFocus
              />
            </div>
            {loginError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700 text-center">{loginError}</p>
              </div>
            )}
            <button
              onClick={handleVerifySetup}
              disabled={setupCode.length !== 6}
              className="w-full bg-orange-600 text-white py-3 rounded-lg font-semibold hover:bg-orange-700 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Verify & Enable 2FA
            </button>
            <button
              onClick={handleBackToLogin}
              className="w-full text-sm text-gray-500 hover:text-gray-700 transition"
            >
              Back to login
            </button>
          </div>
        )}

        {/* Step 3: Backup codes (after mandatory setup) */}
        {step === 'backupCodes' && (
          <div className="space-y-5">
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                These codes can be used if you lose your authenticator device. Each code works only once. <strong>Save them now</strong> — you won't see them again.
              </p>
            </div>
            <div className="bg-gray-50 border rounded-lg p-4">
              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((code, i) => (
                  <code key={i} className="text-center py-2 px-3 bg-white border rounded text-sm font-mono font-semibold text-gray-800">
                    {code}
                  </code>
                ))}
              </div>
            </div>
            <button
              onClick={copyBackupCodes}
              className="w-full flex items-center justify-center gap-2 py-2 bg-gray-100 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
            >
              <Copy size={14} />
              {backupCopied ? 'Copied!' : 'Copy all codes'}
            </button>
            <button
              onClick={handleSetupComplete}
              className="w-full bg-orange-600 text-white py-3 rounded-lg font-semibold hover:bg-orange-700 transition shadow-lg"
            >
              I've saved my codes — Continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
