import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { type Product } from '../../types';
import { db, recordStockAdjustment } from '../../db';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
  AlertTriangle,
  Clock,
  Trash2,
  CheckCircle2,
  X,
  Search,
  PackageCheck
} from 'lucide-react';

export const ExpiryManagement: React.FC = () => {
  const { currentUser } = useAuth();
  const { showToast } = useNotification();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Write-off Modal
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [writeOffQty, setWriteOffQty] = useState<number>(1);
  const [writeOffType, setWriteOffType] = useState<'damaged' | 'expiry'>('expiry');
  const [writeOffReason, setWriteOffReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const prods = await db.products
        .where('businessId')
        .equals('drinks')
        .filter(p => p.isActive)
        .toArray();
      setProducts(prods);
    } catch (err) {
      console.error('Error loading expiry data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysLater = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  // Categorize products by expiry status
  const expiredProducts: Product[] = [];
  const criticalProducts: Product[] = []; // Expiring within 30 days
  const upcomingProducts: Product[] = []; // Expiring within 60 days
  const healthyProducts: Product[] = [];

  products.forEach(p => {
    if (!p.expiryDate) {
      healthyProducts.push(p);
      return;
    }

    const exp = new Date(p.expiryDate);
    if (exp < now) {
      expiredProducts.push(p);
    } else if (exp <= thirtyDaysLater) {
      criticalProducts.push(p);
    } else if (exp <= sixtyDaysLater) {
      upcomingProducts.push(p);
    } else {
      healthyProducts.push(p);
    }
  });

  const openWriteOff = (prod: Product, type: 'damaged' | 'expiry') => {
    setSelectedProduct(prod);
    setWriteOffType(type);
    setWriteOffQty(1);
    setWriteOffReason(
      type === 'expiry'
        ? `Expired batch write-off (${prod.expiryDate})`
        : 'Damaged can/bottle leakage in storage'
    );
  };

  const handleProcessWriteOff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !currentUser) return;

    if (writeOffQty <= 0) {
      showToast('Quantity must be greater than zero.', 'warning');
      return;
    }

    if (writeOffQty > selectedProduct.currentStock) {
      showToast(`Cannot write off more than current available stock (${selectedProduct.currentStock} ${selectedProduct.unit}).`, 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await recordStockAdjustment(
        {
          businessId: 'drinks',
          productId: selectedProduct.id,
          type: writeOffType,
          quantityDelta: -Number(writeOffQty),
          reason: writeOffReason
        },
        currentUser
      );

      showToast(`Written off ${writeOffQty} ${selectedProduct.unit} of ${selectedProduct.name} successfully!`, 'success');
      setSelectedProduct(null);
      loadData();
    } catch (err: any) {
      showToast(`Write-off failed: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
            Beverage Expiry Date & Damaged Stock Registry
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor approaching expiration dates, prevent spoilage losses, and log audited write-offs.
          </p>
        </div>

        <div className="flex gap-2">
          <span className="px-3 py-1 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>{expiredProducts.length} Expired</span>
          </span>
          <span className="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold rounded-xl flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>{criticalProducts.length} Due &lt;30 Days</span>
          </span>
        </div>
      </div>

      {/* Critical / Expired Section */}
      {(expiredProducts.length > 0 || criticalProducts.length > 0) && (
        <div className="space-y-3">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>Urgent Attention Required (Expired & Due Soon)</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[...expiredProducts, ...criticalProducts].map(p => {
              const isPast = p.expiryDate && new Date(p.expiryDate) < now;

              return (
                <div
                  key={p.id}
                  className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                    isPast
                      ? 'bg-rose-50/70 border-rose-200'
                      : 'bg-amber-50/70 border-amber-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-xs text-slate-900">{p.name}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isPast ? 'bg-rose-600 text-white' : 'bg-amber-600 text-white'
                        }`}
                      >
                        {isPast ? 'EXPIRED' : 'DUE SOON'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Expiry Date: <strong>{formatDate(p.expiryDate)}</strong>
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Current Stock: <strong>{p.currentStock} {p.unit}</strong> • Value:{' '}
                      <strong>{formatCurrency(p.currentStock * p.purchasePrice)}</strong>
                    </p>
                  </div>

                  <button
                    onClick={() => openWriteOff(p, 'expiry')}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0"
                  >
                    Write-off Stock
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All Products Expiry Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-bold text-sm text-slate-900">All Tracked Beverages & Shelf Life</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left divide-y divide-slate-200">
            <thead className="bg-slate-50 font-bold text-slate-600 uppercase">
              <tr>
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4">Brand</th>
                <th className="py-3 px-4 text-center">Current Stock</th>
                <th className="py-3 px-4 text-center">Expiry Date</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map(p => {
                const isPast = p.expiryDate && new Date(p.expiryDate) < now;
                const isCritical = p.expiryDate && !isPast && new Date(p.expiryDate) <= thirtyDaysLater;

                return (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{p.name}</td>
                    <td className="py-3 px-4 text-slate-500">{p.brand || '-'}</td>
                    <td className="py-3 px-4 text-center font-bold text-slate-800">
                      {p.currentStock} {p.unit}
                    </td>
                    <td className="py-3 px-4 text-center font-medium text-slate-700">
                      {p.expiryDate ? formatDate(p.expiryDate) : 'Not specified'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isPast
                            ? 'bg-rose-100 text-rose-800'
                            : isCritical
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isPast ? 'EXPIRED' : isCritical ? 'EXPIRING SOON' : 'HEALTHY'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => openWriteOff(p, 'damaged')}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-[11px] transition-colors cursor-pointer mr-1"
                      >
                        Write-off Damaged
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Write-off Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-fade-in">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-400" />
                <h3 className="font-bold text-base">Write-off Stock Loss</h3>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProcessWriteOff} className="p-6 space-y-4">
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs space-y-1">
                <span className="font-bold text-slate-900 block">{selectedProduct.name}</span>
                <span className="text-slate-600 block">
                  Available Stock: <strong>{selectedProduct.currentStock} {selectedProduct.unit}</strong>
                </span>
                <span className="text-slate-600 block">
                  Unit Cost Price: <strong>{formatCurrency(selectedProduct.purchasePrice)}</strong>
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Reason Category *
                </label>
                <select
                  value={writeOffType}
                  onChange={e => setWriteOffType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium"
                >
                  <option value="expiry">Expired Past Best-Before Date</option>
                  <option value="damaged">Damaged / Broken / Leaking Can or Bottle</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Quantity to Write-Off ({selectedProduct.unit}) *
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedProduct.currentStock}
                  required
                  value={writeOffQty}
                  onChange={e => setWriteOffQty(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-rose-700"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Detailed Justification *
                </label>
                <textarea
                  required
                  rows={2}
                  value={writeOffReason}
                  onChange={e => setWriteOffReason(e.target.value)}
                  placeholder="State batch code or damage cause..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  Confirm Loss Write-Off
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
