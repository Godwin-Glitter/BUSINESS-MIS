import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { type Product, type InventoryMovement } from '../../types';
import { db, recordStockAdjustment } from '../../db';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import {
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  RotateCcw,
  Plus,
  Minus,
  Search,
  X,
  History,
  CheckCircle2,
  Package
} from 'lucide-react';

export const InventoryManagement: React.FC = () => {
  const { activeBusiness, currentUser } = useAuth();
  const { showToast } = useNotification();

  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'balances' | 'movements'>('balances');
  const [stockFilter, setStockFilter] = useState<'all' | 'reorder' | 'out'>('all');
  const [loading, setLoading] = useState(true);

  // Adjustment Modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adjustType, setAdjustType] = useState<'adjustment' | 'damaged' | 'expiry' | 'return'>('adjustment');
  const [quantityDelta, setQuantityDelta] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const prods = await db.products.where('businessId').equals(activeBusiness).toArray();
      setProducts(prods);

      const movs = await db.inventoryMovements
        .where('businessId')
        .equals(activeBusiness)
        .reverse()
        .limit(100)
        .toArray();
      setMovements(movs);
    } catch (err) {
      console.error('Error loading inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeBusiness]);

  const openAdjustmentModal = (prod: Product) => {
    setSelectedProduct(prod);
    setQuantityDelta(0);
    setAdjustType('adjustment');
    setAdjustReason('');
    setIsAdjustModalOpen(true);
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !currentUser) return;

    if (quantityDelta === 0) {
      showToast('Adjustment quantity delta cannot be zero.', 'warning');
      return;
    }

    if (!adjustReason.trim()) {
      showToast('Please state a clear reason for the stock adjustment for audit purposes.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      await recordStockAdjustment(
        {
          businessId: activeBusiness,
          productId: selectedProduct.id,
          type: adjustType,
          quantityDelta: Number(quantityDelta),
          reason: adjustReason.trim()
        },
        currentUser
      );

      showToast(`Stock adjusted for ${selectedProduct.name} successfully!`, 'success');
      setIsAdjustModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast(`Adjustment failed: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered Products
  const filteredProducts = products.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.codeSku.toLowerCase().includes(search.toLowerCase());
    const matchesStock =
      stockFilter === 'all'
        ? true
        : stockFilter === 'reorder'
        ? p.currentStock <= p.minStockLevel
        : p.currentStock <= 0;
    return matchesSearch && matchesStock;
  });

  const totalValuation = products.reduce(
    (sum, p) => sum + Math.max(0, p.currentStock) * p.purchasePrice,
    0
  );
  const lowStockCount = products.filter(p => p.currentStock <= p.minStockLevel && p.currentStock > 0).length;
  const outOfStockCount = products.filter(p => p.currentStock <= 0).length;

  return (
    <div className="space-y-5 pb-12 animate-fade-in">
      {/* Top Valuation and Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Total Inventory Valuation
          </span>
          <span className="text-xl font-black text-slate-900 tracking-tight">
            {formatCurrency(totalValuation)}
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5">Based on weighted purchase cost</span>
        </div>

        <div
          onClick={() => {
            setStockFilter('all');
            setActiveTab('balances');
          }}
          className={`p-4 rounded-2xl border shadow-2xs cursor-pointer transition-all ${
            stockFilter === 'all'
              ? 'bg-blue-50/60 border-blue-300 ring-2 ring-blue-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Total Managed SKUs
          </span>
          <span className="text-xl font-black text-slate-900 tracking-tight">{products.length}</span>
          <span className="text-[11px] text-slate-400 block mt-0.5">Click to view all items</span>
        </div>

        <div
          onClick={() => {
            setStockFilter('reorder');
            setActiveTab('balances');
          }}
          className={`p-4 rounded-2xl border shadow-2xs cursor-pointer transition-all ${
            stockFilter === 'reorder'
              ? 'bg-amber-100/90 border-amber-400 ring-2 ring-amber-500/30'
              : 'bg-amber-50/70 border-amber-200 hover:bg-amber-100/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block mb-1">
              Low Stock Warnings
            </span>
            {lowStockCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            )}
          </div>
          <span className="text-xl font-black text-amber-900 tracking-tight">{lowStockCount}</span>
          <span className="text-[11px] text-amber-700 font-medium block mt-0.5">Click to filter reorder items</span>
        </div>

        <div
          onClick={() => {
            setStockFilter('out');
            setActiveTab('balances');
          }}
          className={`p-4 rounded-2xl border shadow-2xs cursor-pointer transition-all ${
            stockFilter === 'out'
              ? 'bg-rose-100/90 border-rose-400 ring-2 ring-rose-500/30'
              : 'bg-rose-50/70 border-rose-200 hover:bg-rose-100/50'
          }`}
        >
          <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider block mb-1">
            Out of Stock Items
          </span>
          <span className="text-xl font-black text-rose-900 tracking-tight">{outOfStockCount}</span>
          <span className="text-[11px] text-rose-700 font-medium block mt-0.5">Click to filter zero stock</span>
        </div>
      </div>

      {/* Tab Switcher & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setActiveTab('balances')}
            className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'balances'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Physical Stock Balances ({products.length})
          </button>
          <button
            onClick={() => setActiveTab('movements')}
            className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'movements'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Stock Movement Audit Trail
          </button>
        </div>

        {activeTab === 'balances' && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick stock status pills */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setStockFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  stockFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({products.length})
              </button>
              <button
                onClick={() => setStockFilter('reorder')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  stockFilter === 'reorder'
                    ? 'bg-amber-500 text-white shadow-2xs font-bold'
                    : 'text-amber-800 hover:bg-amber-100'
                }`}
              >
                <span>Reorder Alert</span>
                <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">{lowStockCount + outOfStockCount}</span>
              </button>
              <button
                onClick={() => setStockFilter('out')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  stockFilter === 'out'
                    ? 'bg-rose-500 text-white shadow-2xs font-bold'
                    : 'text-rose-800 hover:bg-rose-100'
                }`}
              >
                <span>Out of Stock</span>
                <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">{outOfStockCount}</span>
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filter by product or SKU..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-blue-600"
              />
            </div>
          </div>
        )}
      </div>

      {/* Main View: Balances or Movements */}
      {activeTab === 'balances' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left divide-y divide-slate-200">
              <thead className="bg-slate-50 font-bold text-slate-600 uppercase">
                <tr>
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-center">Unit</th>
                  <th className="py-3 px-4 text-right">Avg Unit Cost</th>
                  <th className="py-3 px-4 text-center">Current Stock</th>
                  <th className="py-3 px-4 text-center">Min Threshold</th>
                  <th className="py-3 px-4 text-right">Total Valuation</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map(p => {
                  const isLow = p.currentStock <= p.minStockLevel && p.currentStock > 0;
                  const isOut = p.currentStock <= 0;
                  const val = Math.max(0, p.currentStock) * p.purchasePrice;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">{p.codeSku}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{p.name}</td>
                      <td className="py-3 px-4 text-slate-600">{p.categoryName}</td>
                      <td className="py-3 px-4 text-center text-slate-600">{p.unit}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-700">
                        {formatCurrency(p.purchasePrice)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                            isOut
                              ? 'bg-rose-100 text-rose-800'
                              : isLow
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {p.currentStock}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-slate-500 font-medium">
                        {p.minStockLevel}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatCurrency(val)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => openAdjustmentModal(p)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg text-[11px] transition-colors cursor-pointer"
                        >
                          Adjust Stock
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left divide-y divide-slate-200">
              <thead className="bg-slate-50 font-bold text-slate-600 uppercase">
                <tr>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-center">Delta Qty</th>
                  <th className="py-3 px-4 text-center">Previous</th>
                  <th className="py-3 px-4 text-center">New Balance</th>
                  <th className="py-3 px-4">Reference & Reason</th>
                  <th className="py-3 px-4">Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No stock movements recorded yet.
                    </td>
                  </tr>
                ) : (
                  movements.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {formatDateTime(m.createdAt)}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">{m.productName}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            m.type === 'purchase'
                              ? 'bg-blue-100 text-blue-800'
                              : m.type === 'sale'
                              ? 'bg-emerald-100 text-emerald-800'
                              : m.type === 'damaged' || m.type === 'expiry'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {m.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold">
                        <span className={m.quantity > 0 ? 'text-emerald-700' : 'text-rose-700'}>
                          {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-slate-500 font-medium">
                        {m.previousStock}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-900">
                        {m.newStock}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        <span className="font-semibold block">{m.referenceId}</span>
                        <span className="text-[11px] text-slate-500">{m.reason}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">{m.recordedByUserName}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {isAdjustModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-fade-in">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base">Record Stock Adjustment</h3>
              </div>
              <button
                onClick={() => setIsAdjustModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="p-6 space-y-4">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                <span className="text-slate-500 block">Product:</span>
                <span className="font-bold text-sm text-slate-900 block">{selectedProduct.name}</span>
                <div className="flex justify-between mt-1 text-slate-600">
                  <span>Current Physical Stock:</span>
                  <span className="font-black text-slate-900">
                    {selectedProduct.currentStock} {selectedProduct.unit}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Adjustment Type *
                </label>
                <select
                  value={adjustType}
                  onChange={e => setAdjustType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:outline-blue-600"
                >
                  <option value="adjustment">Stock Count Reconciliation / Physical Audit</option>
                  <option value="damaged">Damaged / Broken in Transit or Warehouse</option>
                  <option value="expiry">Expired Stock Write-Off</option>
                  <option value="return">Returned Stock Accepted into Warehouse</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Quantity Change (+ to Add, - to Deduct) *
                </label>
                <input
                  type="number"
                  required
                  value={quantityDelta || ''}
                  onChange={e => setQuantityDelta(parseInt(e.target.value) || 0)}
                  placeholder="e.g. -5 or +10"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:outline-blue-600"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  New calculated stock will be: <strong>{selectedProduct.currentStock + (quantityDelta || 0)}</strong> {selectedProduct.unit}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Audit Reason / Justification *
                </label>
                <textarea
                  required
                  rows={2}
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  placeholder="Explain why this stock was modified (e.g. 2 bags torn during rain, monthly physical stock-take discrepancy)..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:outline-blue-600"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  Confirm Stock Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
