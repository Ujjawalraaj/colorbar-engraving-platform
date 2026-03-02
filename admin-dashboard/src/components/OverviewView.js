import React from 'react';
import { ShoppingBag } from 'lucide-react';
import getStatusColor from '../utils/statusColors';

const OverviewView = ({ orders }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow border">
        <div className="flex items-center justify-between gap-8 flex-wrap">
          <div className="flex items-center gap-4">
            <ShoppingBag size={24} className="text-blue-500" />
            <div>
              <h3 className="text-gray-600 text-sm">Total Orders</h3>
              <p className="text-3xl font-bold">{orders.length}</p>
            </div>
          </div>

          <div className="h-12 w-px bg-gray-300"></div>

          <div className="flex items-center gap-4">
            <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
            <div>
              <h3 className="text-gray-600 text-sm">Pending</h3>
              <p className="text-3xl font-bold text-yellow-600">
                {orders.filter(o => o.status === 'Pending').length}
              </p>
            </div>
          </div>

          <div className="h-12 w-px bg-gray-300"></div>

          <div className="flex items-center gap-4">
            <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
            <div>
              <h3 className="text-gray-600 text-sm">Processing</h3>
              <p className="text-3xl font-bold text-blue-600">
                {orders.filter(o => o.status === 'Processing').length}
              </p>
            </div>
          </div>

          <div className="h-12 w-px bg-gray-300"></div>

          <div className="flex items-center gap-4">
            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
            <div>
              <h3 className="text-gray-600 text-sm">Completed</h3>
              <p className="text-3xl font-bold text-green-600">
                {orders.filter(o => o.status === 'Completed').length}
              </p>
            </div>
          </div>

          <div className="h-12 w-px bg-gray-300"></div>

          <div className="flex items-center gap-4 bg-gradient-to-r from-orange-500 to-pink-600 px-6 py-4 rounded-lg text-white -m-2">
            <div>
              <h3 className="text-orange-100 text-sm">Total Revenue</h3>
              <p className="text-3xl font-bold">
                ₹{orders.reduce((sum, o) => sum + parseFloat(o.totalAmount || 0), 0).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Orders</h3>
        <div className="space-y-3">
          {orders.slice(0, 3).map((order) => (
            <div key={order.orderId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-semibold text-gray-900">{order.orderId}</p>
                <p className="text-sm text-gray-600">{order.customerName}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900">₹{order.totalAmount}</p>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
                  {order.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OverviewView;
