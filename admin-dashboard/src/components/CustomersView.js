import React from 'react';

const CustomersView = ({ orders, filteredCustomers }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Customers</h2>
        <div className="text-sm text-gray-600">
          Total Customers: <strong>{filteredCustomers.length}</strong>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold">Customer Name</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">Phone Number</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">Email ID</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">Total Orders</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">Last Order Date</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredCustomers.map((email) => {
              const customerOrders = orders.filter(o => o.email === email);
              const customer = customerOrders[0];
              const lastOrder = [...customerOrders].sort(
                (a, b) => new Date(b.orderDate) - new Date(a.orderDate)
              )[0];

              return (
                <tr key={email} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-gray-900">{customer.customerName}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-gray-900">{customer.phone}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-gray-900">{customer.email}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                      {customerOrders.length} {customerOrders.length === 1 ? 'Order' : 'Orders'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-gray-900">{lastOrder.orderDate}</p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredCustomers.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No customers found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomersView;
