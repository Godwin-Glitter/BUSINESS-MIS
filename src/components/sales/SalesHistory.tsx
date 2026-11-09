import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { type Sale } from '../../types';
import { db, reverseSale } from '../../db';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import {
  History,
  Search,
  Filter,
  RotateCcw,
  Printer,
  X,
  AlertTriangle,
  CheckCircle2,
  Calendar
} from 'lucide-react';

interface SalesHistoryProps {
  onOpenReceipt: (sale: Sale) => void;
}

export const SalesHistory: React.FC<SalesHistoryProps> = ({ onOpenReceipt }) => {
  const { activeBusiness, currentUser } = useAuth();
  const { showToast } = useNotification();

  const [sales, setSales] = useState<Sale[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  // Reversal Modal
  const [reversalTarget, setReversalTarget] = useState<Sale | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadSales = async () => {
    setLoading(true);
    try {
      const records = await db.sales
        .where('businessId')
        .equals(activeBusiness)
        .reverse()
        .toArray();
      setSales(records);
    } catch (err) {
      console.error('Error loading sales history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
  }, [activeBusiness]);

  const handleConfirmReversal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversalTarget || !currentUser) return;

    if (!reversalReason.trim()) {
      showToast('Please provide a mandatory reason for cancelling/reversing this transaction.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      await reverseSale(reversalTarget.id, reversalReason.trim(), currentUser);
      showToast(`Sale #${reversalTarget.receiptNumber} reversed. Stock restored and audit log updated.`, 'success');
      setReversalTarget(null);
      setReversalReason('');
      loadSales();
    } catch (err: any) {
      showToast(`Reversal failed: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSales = sales.filter(s => {
    const matchesSearch =
      s.receiptNumber.toLowerCase().includes(search.toLowerCase()) ||
      s.customerName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    const matchesPayment = paymentFilter === 'all' || s.paymentMethod === paymentFilter;
    return matchesSearch && matchesStatus && matchesPayment;
  });

  return (
    <div className="space-y-5 pb-12 animate-fade-in">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Sales Transaction Ledger</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete transaction record with printable receipts and supervised transaction reversal control.
          </p>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Total Sales Count: <strong>{sales.length}</strong>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by receipt number or customer name..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-blue-600"
          />
        </div>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
        >
          <option value="all">All Payment Statuses</option>
          <option value="completed">Completed (Paid in Full)</option>
          <option value="partially_paid">Partially Paid</option>
          <option value="credit">Full Credit Sale</option>
          <option value="cancelled">Reversed / Cancelled</option>
        </select>

        <select
          value={paymentFilter}
          onChange={e => setPaymentFilter(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
        >
          <option value="all">All Channels</option>
          <option value="cash">Cash</option>
          <option value="momo">Mobile Money</option>
          <option value="bank">Bank Transfer</option>
          <option value="credit">Credit</option>
          <option value="split">Split Payment</option>
        </select>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left divide-y divide-slate-200">
            <thead className="bg-slate-50 font-bold text-slate-600 uppercase">
              <tr>
                <th className="py-3 px-4">Receipt #</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Items Summary</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4 text-right">Paid</th>
                <th className="py-3 px-4 text-right">Debt Balance</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">Loading sales records...</td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No transactions match filters.
                  </td>
                </tr>
              ) : (
                filteredSales.map(sale => (
                  <tr
                    key={sale.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      sale.isReversed ? 'bg-rose-50/30 opacity-75' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {sale.receiptNumber}
                      {sale.isReversed && (
                        <span className="block text-[10px] font-sans font-bold text-rose-600">
                          VOIDED
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {formatDateTime(sale.createdAt)}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">
                      {sale.customerName}
                    </td>
                    <td className="py-3 px-4 text-slate-600 truncate max-w-xs">
                      {sale.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {formatCurrency(sale.totalAmount)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600">
                      {formatCurrency(sale.amountPaid)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-amber-700">
                      {sale.outstandingBalance > 0 ? formatCurrency(sale.outstandingBalance) : '-'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          sale.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : sale.status === 'partially_paid'
                            ? 'bg-blue-100 text-blue-800'
                            : sale.status === 'credit'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {sale.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onOpenReceipt(sale)}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg text-[11px] transition-colors cursor-pointer"
                        >
                          Receipt
                        </button>
                        {!sale.isReversed && (
                          <button
                            onClick={() => setReversalTarget(sale)}
                            title="Reverse transaction and return items to stock"
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reversal Confirmation Modal */}
      {reversalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-fade-in">
            <div className="bg-rose-950 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                <h3 className="font-bold text-base">Reverse / Void Sales Transaction</h3>
              </div>
              <button
                onClick={() => setReversalTarget(null)}
                className="p-1.5 text-white/70 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmReversal} className="p-6 space-y-4">
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-900 space-y-1">
                <span className="font-bold block">
                  Receipt #{reversalTarget.receiptNumber} • {formatCurrency(reversalTarget.totalAmount)}
                </span>
                <span className="block text-rose-800">
                  Customer: <strong>{reversalTarget.customerName}</strong>
                </span>
                <p className="text-[11px] text-rose-700 pt-1">
                  Reversing will immediately restore physical inventory for all {reversalTarget.items.length} items,
                  remove the revenue from reports, adjust customer debts, and preserve an unalterable audit log.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Mandatory Reversal Justification *
                </label>
                <textarea
                  required
                  rows={3}
                  value={reversalReason}
                  onChange={e => setReversalReason(e.target.value)}
                  placeholder="Explain why this transaction is being reversed (e.g. Customer returned goods, mistaken quantity entry by cashier)..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:outline-rose-600"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setReversalTarget(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Keep Sale Intact
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  Confirm Reversal & Restore Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
