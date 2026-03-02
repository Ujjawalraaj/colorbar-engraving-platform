import React from 'react';
import { X } from 'lucide-react';
import EngravingPreview from './EngravingPreview';
import getStatusColor from '../utils/statusColors';

const OrderDetailModal = ({ selectedOrder, setSelectedOrder, updateOrderStatus }) => {
  if (!selectedOrder) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="order-detail-title" onClick={(e) => { if (e.target === e.currentTarget) setSelectedOrder(null); }}>
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-lg w-full max-w-5xl my-8">
          <div className="flex justify-between items-center p-6 border-b bg-white rounded-t-lg">
            <h2 id="order-detail-title" className="text-2xl font-semibold">Order Details - {selectedOrder.orderId}</h2>
            <button onClick={() => setSelectedOrder(null)} className="text-gray-500 hover:text-gray-700" aria-label="Close order details">
              <X size={24} />
            </button>
          </div>

          <div className="p-6 grid md:grid-cols-2 gap-6">
            {/* LEFT COLUMN */}
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-3 text-orange-600">Customer Information</h3>
                <div className="space-y-2">
                  <p className="text-sm"><strong>Name:</strong> {selectedOrder.customerName}</p>
                  <p className="text-sm"><strong>Email:</strong> {selectedOrder.email}</p>
                  <p className="text-sm"><strong>Phone:</strong> {selectedOrder.phone}</p>
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-3 text-orange-600">Order Information</h3>
                <div className="space-y-2">
                  <p className="text-sm"><strong>Order ID:</strong> {selectedOrder.orderId}</p>
                  <p className="text-sm"><strong>Date:</strong> {selectedOrder.orderDate}</p>
                  <p className="text-sm"><strong>Status:</strong> <span className={`px-2 py-1 rounded text-xs ${getStatusColor(selectedOrder.status)}`}>{selectedOrder.status}</span></p>
                  <p className="text-sm"><strong>Total:</strong> ₹{selectedOrder.totalAmount}</p>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-4">
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
                <h3 className="font-semibold mb-4 text-gray-700 text-center text-lg">Product Preview</h3>
                <div className="flex justify-center mb-3">
                  <EngravingPreview
                    previewData={selectedOrder.previewData}
                    productName={selectedOrder.productName}
                  />
                </div>
                {!selectedOrder.previewData && (
                  <p className="text-xs text-center text-gray-500 italic">
                    Preview available for orders created after preview feature was added
                  </p>
                )}
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-3 text-orange-600">Product Details</h3>
                <div className="space-y-2">
                  <p className="text-sm"><strong>Product:</strong> {selectedOrder.productName}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">Shade:</p>
                    <div
                      className="w-5 h-5 rounded-full border border-gray-300"
                      style={{ background: selectedOrder.shadeColor || '#e91e63' }}
                    ></div>
                    <span className="text-sm">{selectedOrder.shade}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">SKU:</p>
                    <div className="inline-flex items-center px-3 py-1 rounded bg-white border-2 border-orange-200">
                      <span className="text-sm font-mono font-semibold text-gray-800">
                        {selectedOrder.sku || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-3 text-orange-600">Engraving Details</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Engraving Text</p>
                    <div className="bg-white border-2 border-orange-200 p-4 text-center rounded">
                      <p className="text-2xl font-semibold">{selectedOrder.engravingText}</p>
                    </div>
                  </div>
                  <p className="text-sm"><strong>Font:</strong> {selectedOrder.font}</p>
                  {selectedOrder.motifs && selectedOrder.motifs.length > 0 && (
                    <div>
                      <p className="text-sm mb-2"><strong>Motifs:</strong></p>
                      <div className="flex gap-2 flex-wrap">
                        {selectedOrder.motifs.map((motif, i) => (
                          <div
                            key={`${motif}-${i}`}
                            className="w-10 h-10 bg-white border-2 border-orange-200 rounded flex items-center justify-center text-xl"
                            style={{ fontFamily: 'Emoticons, sans-serif' }}
                          >
                            {motif}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t p-6 bg-gray-50">
            <div className="mb-6">
              <h3 className="font-semibold mb-3 text-gray-900">Update Order Status</h3>
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={() => updateOrderStatus(selectedOrder.orderId, 'Pending')}
                  className={`px-6 py-2 rounded-md font-semibold transition ${selectedOrder.status === 'Pending' ? 'bg-yellow-600 text-white' : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'}`}
                >
                  Mark as Pending
                </button>
                <button
                  onClick={() => updateOrderStatus(selectedOrder.orderId, 'Processing')}
                  className={`px-6 py-2 rounded-md font-semibold transition ${selectedOrder.status === 'Processing' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800 hover:bg-blue-200'}`}
                >
                  Mark as Processing
                </button>
                <button
                  onClick={() => updateOrderStatus(selectedOrder.orderId, 'Completed')}
                  className={`px-6 py-2 rounded-md font-semibold transition ${selectedOrder.status === 'Completed' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-800 hover:bg-green-200'}`}
                >
                  Mark as Completed
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-8 py-3 bg-orange-600 text-white rounded-md hover:bg-orange-700 font-semibold transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailModal;
