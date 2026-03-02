import React, { useState, useMemo, useEffect } from 'react';
import { Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import getStatusColor from '../utils/statusColors';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 'All'];

const OrdersView = ({ filteredOrders, isLoading, setSelectedOrder }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [ordersPerPage, setOrdersPerPage] = useState(10);

  // Group orders by shopifyOrderNumber
  const grouped = useMemo(() => {
    const groups = [];
    const seen = {};
    filteredOrders.forEach(order => {
      const key = order.shopifyOrderNumber;
      if (!seen[key]) {
        seen[key] = { items: [] };
        groups.push(seen[key]);
      }
      seen[key].items.push(order);
    });
    return groups;
  }, [filteredOrders]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredOrders]);

  const showAll = ordersPerPage === 'All';
  const totalPages = showAll ? 1 : Math.ceil(grouped.length / ordersPerPage);
  const paginatedGroups = showAll
    ? grouped
    : grouped.slice((currentPage - 1) * ordersPerPage, currentPage * ordersPerPage);

  // Calculate display range (in terms of groups/orders)
  const startIdx = showAll ? 1 : (currentPage - 1) * ordersPerPage + 1;
  const endIdx = showAll ? grouped.length : Math.min(currentPage * ordersPerPage, grouped.length);

  // Generate page numbers with ellipsis for large page counts
  const getPageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = [];
    if (currentPage <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push('...', totalPages);
    } else if (currentPage >= totalPages - 3) {
      pages.push(1, '...');
      for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
    }
    return pages;
  };

  return (
    <div className="space-y-6">
      {isLoading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <p className="text-blue-800 font-semibold">Loading orders from Shopify...</p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow border overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold whitespace-nowrap">Order ID</th>
              <th className="px-6 py-4 text-left text-sm font-semibold whitespace-nowrap">Customer</th>
              <th className="px-6 py-4 text-left text-sm font-semibold whitespace-nowrap">Product</th>
              <th className="px-6 py-4 text-left text-sm font-semibold whitespace-nowrap">SKU</th>
              <th className="px-6 py-4 text-left text-sm font-semibold whitespace-nowrap">Shade</th>
              <th className="px-6 py-4 text-left text-sm font-semibold whitespace-nowrap">Engraving</th>
              <th className="px-6 py-4 text-left text-sm font-semibold whitespace-nowrap">Font</th>
              <th className="px-6 py-4 text-left text-sm font-semibold whitespace-nowrap">Motifs</th>
              <th className="px-6 py-4 text-left text-sm font-semibold whitespace-nowrap">Status</th>
              <th className="px-6 py-4 text-left text-sm font-semibold whitespace-nowrap">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {paginatedGroups.map((group) => (
                group.items.map((order, idx) => (
                  <tr key={order.orderId} className={`hover:bg-gray-50 ${idx > 0 ? 'border-t border-dashed border-gray-200' : ''}`}>
                    {idx === 0 && (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap align-top" rowSpan={group.items.length}>
                          <p className="font-semibold">ORD-{order.shopifyOrderNumber}</p>
                          <p className="text-xs text-gray-500">{order.orderDate}</p>
                          {group.items.length > 1 && (
                            <span className="inline-block mt-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full font-medium">
                              {group.items.length} items
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap align-top" rowSpan={group.items.length}>
                          <p className="font-medium">{order.customerName}</p>
                          <p className="text-xs text-gray-500">{order.email}</p>
                        </td>
                      </>
                    )}
                    <td className="px-6 py-4 text-sm">{order.productName}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="inline-flex items-center px-2.5 py-1 rounded bg-gray-100 border border-gray-300">
                        <span className="text-xs font-mono font-semibold text-gray-700">
                          {order.sku || 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-5 h-5 rounded-full border border-gray-300"
                          style={{ background: order.shadeColor || '#e91e63' }}
                          title={order.shade}
                        ></div>
                        <span className="text-sm">{order.shade || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold">{order.engravingText}</td>
                    <td className="px-6 py-4 text-sm">{order.font || 'Not specified'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {order.motifs && order.motifs.length > 0 ? (
                        <div className="flex gap-1 flex-wrap">
                          {order.motifs.map((m, i) => (
                            <span
                              key={`${m}-${i}`}
                              className="text-lg"
                              style={{ fontFamily: 'Emoticons, sans-serif' }}
                              title={`Motif ${i + 1}`}
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">No motifs</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        aria-label={`View order ${order.orderId}`}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 text-sm"
                      >
                        <Eye size={16} />
                        View
                      </button>
                    </td>
                  </tr>
                ))
              ))}
          </tbody>
        </table>
        {filteredOrders.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No orders found</p>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {grouped.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-lg shadow border px-6 py-4">
          {/* Left: info + per-page selector */}
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>
              Showing <span className="font-semibold text-gray-900">{startIdx}–{endIdx}</span> of{' '}
              <span className="font-semibold text-gray-900">{grouped.length}</span> orders
            </span>
            <div className="flex items-center gap-2">
              <label htmlFor="perPage" className="text-gray-500">Per page:</label>
              <select
                id="perPage"
                value={ordersPerPage}
                onChange={(e) => {
                  const val = e.target.value === 'All' ? 'All' : Number(e.target.value);
                  setOrdersPerPage(val);
                  setCurrentPage(1);
                }}
                className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                {PAGE_SIZE_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Right: page navigation */}
          {!showAll && totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
              </button>
              {getPageNumbers().map((page, i) =>
                page === '...' ? (
                  <span key={`ellipsis-${i}`} className="px-2 text-gray-400">...</span>
                ) : (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium border ${
                      currentPage === page
                        ? 'bg-orange-600 text-white border-orange-600'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {page}
                  </button>
                )
              )}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OrdersView;
