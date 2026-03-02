import React, { useState } from 'react';
import { Users, UserPlus, KeyRound, Trash2, ShieldCheck, ShieldOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const UserManagementView = ({ usersList, fetchUsers }) => {
  const { authHeaders, loggedInUser, API_URL } = useAuth();

  const [newUsername, setNewUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('user');
  const [userFormError, setUserFormError] = useState('');
  const [userFormSuccess, setUserFormSuccess] = useState('');
  const [resetTarget, setResetTarget] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  const handleCreateUser = async () => {
    setUserFormError('');
    setUserFormSuccess('');
    try {
      const res = await fetch(`${API_URL}/api/users`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ username: newUsername, password: newUserPassword, role: newUserRole })
      });
      const data = await res.json();
      if (!res.ok) { setUserFormError(data.error); return; }
      setUserFormSuccess(`User "${data.username}" created successfully`);
      setNewUsername('');
      setNewUserPassword('');
      setNewUserRole('user');
      fetchUsers();
    } catch (e) {
      setUserFormError('Network error');
    }
  };

  const handleChangeRole = async (uname, role) => {
    try {
      const res = await fetch(`${API_URL}/api/users/${uname}/role`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ role })
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Failed to update role'); return; }
      fetchUsers();
    } catch (e) {
      alert('Network error');
    }
  };

  const handleDeleteUser = async (uname) => {
    if (!window.confirm(`Delete user "${uname}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API_URL}/api/users/${uname}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }
      fetchUsers();
    } catch (e) {
      alert('Network error');
    }
  };

  const handleResetPassword = async (uname) => {
    setResetError('');
    setResetSuccess('');
    try {
      const res = await fetch(`${API_URL}/api/users/${uname}/password`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ newPassword: resetPassword })
      });
      const data = await res.json();
      if (!res.ok) { setResetError(data.error); return; }
      setResetSuccess(`Password reset for "${uname}"`);
      setResetPassword('');
      setTimeout(() => { setResetTarget(''); setResetSuccess(''); }, 2000);
    } catch (e) {
      setResetError('Network error');
    }
  };

  const handleReset2FA = async (uname) => {
    if (!window.confirm(`Reset two-factor authentication for "${uname}"? They will need to set it up again.`)) return;
    try {
      const res = await fetch(`${API_URL}/api/users/${uname}/totp`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Failed to reset 2FA'); return; }
      fetchUsers();
    } catch (e) {
      alert('Network error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Create User Card */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <UserPlus size={20} className="text-orange-600" />
          Create New User
        </h3>
        <div className="grid md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => { setNewUsername(e.target.value); setUserFormError(''); setUserFormSuccess(''); }}
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="e.g. user@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input
              type="password"
              value={newUserPassword}
              onChange={(e) => { setNewUserPassword(e.target.value); setUserFormError(''); setUserFormSuccess(''); }}
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Min 6 characters"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
            <select
              value={newUserRole}
              onChange={(e) => setNewUserRole(e.target.value)}
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleCreateUser}
              className="w-full flex items-center justify-center gap-2 px-6 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition font-semibold"
            >
              <UserPlus size={16} />
              Create User
            </button>
          </div>
        </div>
        {userFormError && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{userFormError}</p>
          </div>
        )}
        {userFormSuccess && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-700">{userFormSuccess}</p>
          </div>
        )}
        <p className="mt-3 text-xs text-gray-500">
          Username: 3-64 characters, email addresses allowed.
        </p>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow border overflow-x-auto">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Users size={20} className="text-orange-600" />
            All Users
            <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-sm font-normal">
              {usersList.length}
            </span>
          </h3>
          <button
            onClick={fetchUsers}
            className="text-sm text-orange-600 hover:text-orange-700 font-medium"
          >
            Refresh
          </button>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Username</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Role</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">2FA</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Reset Password</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {usersList.map((u) => {
              const isSelf = u.username === loggedInUser;
              const isResetting = resetTarget === u.username;
              return (
                <tr key={u.username} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-sm uppercase">
                        {u.username[0]}
                      </div>
                      <span className="font-medium text-gray-900">{u.username}</span>
                      {isSelf && (
                        <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full font-medium">You</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={u.role || 'user'}
                      onChange={(e) => handleChangeRole(u.username, e.target.value)}
                      disabled={isSelf}
                      title={isSelf ? 'You cannot change your own role' : ''}
                      className={`px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                        isSelf ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-800'
                      } ${u.role === 'admin' ? 'border-blue-300' : 'border-gray-300'}`}
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    {u.totp_enabled ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                          <ShieldCheck size={12} />
                          Enabled
                        </span>
                        {!isSelf && (
                          <button
                            onClick={() => handleReset2FA(u.username)}
                            title={`Reset 2FA for ${u.username}`}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition"
                          >
                            <ShieldOff size={12} />
                            Reset
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-medium">
                        Not set up
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {isResetting ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="password"
                          value={resetPassword}
                          onChange={(e) => { setResetPassword(e.target.value); setResetError(''); setResetSuccess(''); }}
                          className="w-40 px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                          placeholder="New password"
                          autoFocus
                        />
                        <button
                          onClick={() => handleResetPassword(u.username)}
                          className="px-3 py-1.5 bg-orange-600 text-white text-sm rounded-md hover:bg-orange-700 font-medium"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => { setResetTarget(''); setResetPassword(''); setResetError(''); setResetSuccess(''); }}
                          className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setResetTarget(u.username); setResetPassword(''); setResetError(''); setResetSuccess(''); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-100 transition"
                      >
                        <KeyRound size={14} />
                        Reset
                      </button>
                    )}
                    {isResetting && resetError && (
                      <p className="mt-1 text-xs text-red-600">{resetError}</p>
                    )}
                    {isResetting && resetSuccess && (
                      <p className="mt-1 text-xs text-green-600">{resetSuccess}</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleDeleteUser(u.username)}
                      disabled={isSelf}
                      title={isSelf ? 'Cannot delete your own account' : `Delete ${u.username}`}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition font-medium ${
                        isSelf
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                      }`}
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {usersList.length === 0 && (
          <div className="text-center py-10 text-gray-500">No users found</div>
        )}
      </div>
    </div>
  );
};

export default UserManagementView;
