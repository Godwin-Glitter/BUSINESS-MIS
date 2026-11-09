import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { type Customer, type CustomerPayment } from '../../types';
import { db, recordCustomerPayment } from '../../db';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import {
  CreditCard,
  Plus,
  Search,
  Banknote,
  Smartphone,
  Building,
  CheckCircle2,
  X,
  History
} from 'lucide-react';

interface CustomerPaymentsProps {
  preselectedCustomer?: Customer | null;
  onClearPreselectedCustomer?: () => void;
}

export const CustomerPayments: React.FC<CustomerPaymentsProps> = ({
  preselectedCustomer,
  onClearPreselectedCustomer
}) => {
  const { activeBusiness, currentUser } = useAuth();
  const { showToast } = useNotification();

  const [payments, setPayments] = useState<CustomerPayment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Record Payment Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'momo' | 'bank'>('cash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const records = await db.customerPayments
        .where('businessId')
        .equals(activeBusiness)
        .reverse()
        .toArray();
      setPayments(records);

      const custs = await db.customers.where('businessId').equals(activeBusiness).toArray();
      setCustomers(custs);
    } catch (err) {
      console.error('Error loading payments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeBusiness]);

  // If redirected with preselected customer
  useEffect(() => {
    if (preselectedCustomer) {
      setSelectedCustomerId(preselectedCustomer.id);
      setAmount(preselectedCustomer.outstandingDebt);
      setIsModalOpen(true);
    }
  }, [preselectedCustomer]);

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !currentUser) {
      showToast('Please select a customer.', 'warning');
      return;
    }

    if (amount <= 0) {
      showToast('Payment amount must be greater than zero.', 'warning');
      return;
    }

    const customer = customers.find(c => c.id === selectedCustomerId);
    if (!customer) return;

    setIsSubmitting(true);
    try {
      await recordCustomerPayment(
        {
          businessId: activeBusiness,
          customerId: selectedCustomerId,
          amountPaid: Number(amount),
          paymentMethod,
          referenceNumber: referenceNumber.trim() || undefined,
          notes: notes.trim() || undefined
        },
        currentUser
      );

      showToast(`Payment of ${formatCurrency(amount)} recorded for ${customer.name}!`, 'success');
      setIsModalOpen(false);
      setSelectedCustomerId('');
      setAmount(0);
      setReferenceNumber('');
      setNotes('');
      if (onClearPreselectedCustomer) onClearPreselectedCustomer();
      loadData();
    } catch (err: any) {
      showToast(`Error recording payment: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCustObj = customers.find(c => c.id === selectedCustomerId);

  const filteredPayments = payments.filter(p =>
    p.customerName.toLowerCase().includes(search.toLowerCase()) ||
    p.receiptNumber.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 pb-12 animate-fade-in">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Customer Debt Collections & Payments</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Record customer repayments towards credit sales and debt reconciliation.
          </p>
        </div>

        <button
          onClick={() => {
            setSelectedCustomerId(customers[0]?.id || '');
            setAmount(0);
            setIsModalOpen(true);
          }}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Record Customer Repayment</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search payments by receipt or customer name..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-blue-600"
          />
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left divide-y divide-slate-200">
            <thead className="bg-slate-50 font-bold text-slate-600 uppercase">
              <tr>
                <th className="py-3 px-4">Payment Receipt #</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-4 text-right">Amount Received</th>
                <th className="py-3 px-4">Payment Method</th>
                <th className="py-3 px-4">Transaction Reference</th>
                <th className="py-3 px-4">Notes</th>
                <th className="py-3 px-4">Recorded By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">Loading payment receipts...</td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">No payment records found.</td>
                </tr>
              ) : (
                filteredPayments.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{p.receiptNumber}</td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{formatDateTime(p.createdAt)}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">{p.customerName}</td>
                    <td className="py-3 px-4 text-right font-black text-emerald-600">
                      {formatCurrency(p.amountPaid)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="capitalize font-bold text-slate-700 px-2 py-0.5 rounded bg-slate-100">
                        {p.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">{p.referenceNumber || '-'}</td>
                    <td className="py-3 px-4 text-slate-600 truncate max-w-xs">{p.notes || '-'}</td>
                    <td className="py-3 px-4 text-slate-500 font-medium">{p.recordedByUserName}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-fade-in">
            <div className="bg-emerald-950 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base">Record Customer Debt Payment</h3>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  if (onClearPreselectedCustomer) onClearPreselectedCustomer();
                }}
                className="p-1.5 text-white/70 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Select Customer *
                </label>
                <select
                  required
                  value={selectedCustomerId}
                  onChange={e => {
                    setSelectedCustomerId(e.target.value);
                    const c = customers.find(item => item.id === e.target.value);
                    if (c) setAmount(c.outstandingDebt);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:outline-emerald-600"
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.outstandingDebt > 0 ? `(Owes ${formatCurrency(c.outstandingDebt)})` : '(No debt)'}
                    </option>
                  ))}
                </select>
              </div>

              {selectedCustObj && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs space-y-1">
                  <div className="flex justify-between text-amber-900 font-bold">
                    <span>Current Outstanding Debt:</span>
                    <span>{formatCurrency(selectedCustObj.outstandingDebt)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 text-[11px]">
                    <span>Lifetime Purchases:</span>
                    <span>{formatCurrency(selectedCustObj.totalPurchased)}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Payment Amount Received (GH₵) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amount || ''}
                  onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-black text-emerald-700 focus:bg-white focus:outline-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Payment Channel *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['cash', 'momo', 'bank'] as const).map(method => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`py-2 px-1 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer ${
                        paymentMethod === method
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {method === 'momo' ? 'MoMo' : method}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Transaction Reference (MoMo ID / Bank Slip)
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={e => setReferenceNumber(e.target.value)}
                  placeholder="e.g. TXN-1092837 or Cheque #004"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:outline-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Remarks / Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Cleared 50 bags cement outstanding invoice"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:outline-emerald-600"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    if (onClearPreselectedCustomer) onClearPreselectedCustomer();
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  Save Payment Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
