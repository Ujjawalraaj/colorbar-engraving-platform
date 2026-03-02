import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './components/LoginPage';
import Sidebar from './components/Sidebar';
import OverviewView from './components/OverviewView';
import OrdersView from './components/OrdersView';
import CustomersView from './components/CustomersView';
import UserManagementView from './components/UserManagementView';
import SettingsView from './components/SettingsView';
import OrderDetailModal from './components/OrderDetailModal';
import ErrorBoundary from './components/ErrorBoundary';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const ORDER_POLL_INTERVAL_MS = 30000; // 30 seconds

const Dashboard = () => {
  const { isLoggedIn, authToken, loggedInUser, userRole, isAdmin, authHeaders } = useAuth();

  const [activeView, setActiveView] = useState('overview');
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [sidebarHover, setSidebarHover] = useState(false);
  const sidebarOpen = sidebarPinned || sidebarHover;

  const [ordersData, setOrdersData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [customerSearch, setCustomerSearch] = useState('');

  const [usersList, setUsersList] = useState([]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/users`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) setUsersList(data);
    } catch (e) {
      console.error('Failed to fetch users', e);
    }
  }, [authHeaders]);

  useEffect(() => {
    const fetchOrders = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_URL}/api/orders`, { headers: authHeaders() });
        if (!response.ok) throw new Error('Failed to fetch orders');
        const data = await response.json();
        setOrdersData(data);
      } catch (error) {
        console.error('Error fetching orders:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isLoggedIn && authToken) {
      fetchOrders();
      fetchUsers();
      const interval = setInterval(fetchOrders, ORDER_POLL_INTERVAL_MS);
      return () => clearInterval(interval);
    }
  }, [isLoggedIn, authToken, authHeaders, fetchUsers]);

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const order = ordersData.find(o => o.orderId === orderId);
      if (!order) return;

      const response = await fetch(`${API_URL}/api/orders/${order.shopifyId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) throw new Error('Failed to update order');

      setOrdersData(prevOrders =>
        prevOrders.map(o => o.orderId === orderId ? { ...o, status: newStatus } : o)
      );
      setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
    } catch (error) {
      console.error('Error updating order:', error);
    }
  };

  const orders = ordersData;

  const filteredOrders = useMemo(() => orders.filter(order => {
    const matchesSearch =
      order.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.sku && order.sku.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFilter = filterStatus === 'all' || order.status === filterStatus;
    return matchesSearch && matchesFilter;
  }), [orders, searchTerm, filterStatus]);

  const uniqueCustomers = useMemo(() =>
    Array.from(new Set(orders.map(o => o.email))),
    [orders]
  );

  const filteredCustomers = useMemo(() =>
    customerSearch.trim()
      ? uniqueCustomers.filter(email => {
          const customerOrders = orders.filter(o => o.email === email);
          const c = customerOrders[0];
          const q = customerSearch.toLowerCase();
          return c.customerName.toLowerCase().includes(q) || email.toLowerCase().includes(q);
        })
      : uniqueCustomers,
    [uniqueCustomers, orders, customerSearch]
  );

  if (!isLoggedIn) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        fetchUsers={fetchUsers}
        sidebarOpen={sidebarOpen}
        sidebarPinned={sidebarPinned}
        setSidebarPinned={setSidebarPinned}
        setSidebarHover={setSidebarHover}
      />

      {/* Main Content */}
      <div style={{ transition: 'margin-left 200ms ease-out' }} className={`flex-1 ${sidebarOpen ? 'ml-64' : 'ml-20'}`}>
        {/* Sticky Header */}
        <div className="bg-white shadow-sm border-b sticky top-0 z-40">
          <div className="flex items-center justify-between px-6 pt-6 pb-3">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold">
                {activeView === 'overview' && 'Dashboard Overview'}
                {activeView === 'orders' && 'Orders Dashboard'}
                {activeView === 'customers' && 'Customers'}
                {activeView === 'users' && 'User Management'}
                {activeView === 'settings' && 'Settings'}
              </h1>
            </div>
            <p className="text-gray-600">Welcome, <strong className="capitalize">{loggedInUser}</strong> <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{userRole}</span></p>
          </div>

          {activeView === 'orders' && (
            <div className="px-6 pb-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="md:col-span-2 relative">
                  <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Search orders by ID, customer, product, or SKU..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-gray-50"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <select
                  className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-gray-50"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="all">All Status</option>
                  <option value="Pending">Pending</option>
                  <option value="Processing">Processing</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>
          )}

          {activeView === 'customers' && (
            <div className="px-6 pb-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search customers by name or email..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-gray-50"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="p-6">
          {activeView === 'overview' && <OverviewView orders={orders} />}
          {activeView === 'orders' && (
            <OrdersView filteredOrders={filteredOrders} isLoading={isLoading} setSelectedOrder={setSelectedOrder} />
          )}
          {activeView === 'customers' && (
            <CustomersView orders={orders} filteredCustomers={filteredCustomers} />
          )}
          {activeView === 'users' && isAdmin && (
            <UserManagementView usersList={usersList} fetchUsers={fetchUsers} />
          )}
          {activeView === 'settings' && (
            <SettingsView orders={orders} uniqueCustomers={uniqueCustomers} />
          )}
        </div>
      </div>

      <OrderDetailModal
        selectedOrder={selectedOrder}
        setSelectedOrder={setSelectedOrder}
        updateOrderStatus={updateOrderStatus}
      />
    </div>
  );
};

const App = () => (
  <ErrorBoundary>
    <AuthProvider>
      <Dashboard />
    </AuthProvider>
  </ErrorBoundary>
);

export default App;
