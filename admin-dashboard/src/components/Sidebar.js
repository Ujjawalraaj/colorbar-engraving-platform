import React from 'react';
import { LogOut, Home, ShoppingBag, Users, Settings, UserCog, Pin } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import colorbarLogo from '../assets/colorbar-logo.png';
import ColorbarLogo from './ColorbarLogo';

const Sidebar = ({ activeView, setActiveView, fetchUsers, sidebarOpen, sidebarPinned, setSidebarPinned, setSidebarHover }) => {
  const { isAdmin, logout } = useAuth();

  return (
    <div
      style={{ transition: 'width 200ms ease-out' }}
      className={`bg-gray-900 text-white h-screen fixed left-0 top-0 z-50 ${sidebarOpen ? 'w-64' : 'w-20'}`}
      onMouseEnter={() => { if (!sidebarPinned) setSidebarHover(true); }}
      onMouseLeave={() => { if (!sidebarPinned) setSidebarHover(false); }}
    >
      <div className={sidebarOpen ? 'p-6' : 'py-6 px-2'}>
        <div className="flex items-center justify-between mb-8">
          <div className="flex-1 flex justify-center">
            {sidebarOpen ? (
              <ColorbarLogo width="170" white />
            ) : (
              <img src={colorbarLogo} alt="Colorbar" className="w-10 h-auto brightness-0 invert" />
            )}
          </div>
          {sidebarOpen && (
            <button
              onClick={() => setSidebarPinned(prev => !prev)}
              title={sidebarPinned ? 'Unpin sidebar' : 'Pin sidebar'}
              className="p-1.5 rounded-md hover:bg-gray-700 transition text-gray-400 hover:text-white"
            >
              <Pin size={16} className={`transition-transform duration-300 ${sidebarPinned ? '-rotate-45' : 'rotate-0'}`} />
            </button>
          )}
        </div>

        <nav className="space-y-2">
          {[
            { key: 'overview', label: 'Overview', icon: Home },
            { key: 'orders', label: 'Orders Dashboard', icon: ShoppingBag },
            { key: 'customers', label: 'Customers', icon: Users },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveView(key)}
              title={!sidebarOpen ? label : undefined}
              className={`w-full flex items-center gap-3 ${sidebarOpen ? 'px-4' : 'px-0'} py-3 rounded-lg transition ${!sidebarOpen ? 'justify-center' : ''} ${activeView === key ? 'bg-orange-600' : 'hover:bg-gray-800'}`}
            >
              <Icon size={20} />
              {sidebarOpen && <span>{label}</span>}
            </button>
          ))}

          {isAdmin && (
            <button
              onClick={() => { setActiveView('users'); fetchUsers(); }}
              title={!sidebarOpen ? 'User Management' : undefined}
              className={`w-full flex items-center gap-3 ${sidebarOpen ? 'px-4' : 'px-0'} py-3 rounded-lg transition ${!sidebarOpen ? 'justify-center' : ''} ${activeView === 'users' ? 'bg-orange-600' : 'hover:bg-gray-800'}`}
            >
              <UserCog size={20} />
              {sidebarOpen && <span>User Management</span>}
            </button>
          )}

          <button
            onClick={() => setActiveView('settings')}
            title={!sidebarOpen ? 'Settings' : undefined}
            className={`w-full flex items-center gap-3 ${sidebarOpen ? 'px-4' : 'px-0'} py-3 rounded-lg transition ${!sidebarOpen ? 'justify-center' : ''} ${activeView === 'settings' ? 'bg-orange-600' : 'hover:bg-gray-800'}`}
          >
            <Settings size={20} />
            {sidebarOpen && <span>Settings</span>}
          </button>
        </nav>

        <div className={`absolute bottom-6 left-0 right-0 ${sidebarOpen ? 'px-6' : 'px-2'}`}>
          <button
            onClick={logout}
            title={!sidebarOpen ? 'Logout' : undefined}
            aria-label="Logout"
            className={`w-full flex items-center gap-3 ${sidebarOpen ? 'px-4' : 'px-0'} py-3 rounded-lg hover:bg-red-600 transition ${!sidebarOpen ? 'justify-center' : ''}`}
          >
            <LogOut size={20} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
