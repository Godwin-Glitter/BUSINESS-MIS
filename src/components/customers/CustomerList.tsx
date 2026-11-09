import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { type Customer, type BusinessProfile } from '../../types';
import { db, logAuditEvent } from '../../db';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import {
  Users,
  Plus,
  Search,
  FileText,
  CreditCard,
  Edit2,
  X,
  Phone,
  MapPin,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

interface CustomerListProps {
  onOpenStatement: (customer: Customer) => void;
  onRecordPaymentForCustomer: (customer: Customer) => void;
}

export const CustomerList: React.FC<CustomerListProps> = ({
  onOpenStatement,
  onRecordPaymentForCustomer
}) => {
  const { activeBusiness, currentUser } = useAuth();
  const { showToast } = useNotification();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [creditLimit, setCreditLimit] = useState<number>(5000);
  const [notes, setNotes] = useState('');

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const records = await db.customers
        .where('businessId')
        .equals(activeBusiness)
        .toArray();
      setCustomers(records);
    } catch (err) {
      console.error('Error loading customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [activeBusiness]);

  const openCreateModal = () => {
    setEditingCustomer(null);
    setName('');
    setPhone('');
    setAddress('');
    setCreditLimit(10000);
    setNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setName(c.name);
    setPhone(c.phone);
    setAddress(c.address || '');
    setCreditLimit(c.creditLimit || 5000);
    setNotes(c.notes || '');
    setIsModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !currentUser) {
      showToast('Please enter customer full name and telephone number.', 'warning');
      return;
    }

    try {
      const now = new Date().toISOString();

      if (editingCustomer) {
        await db.customers.update(editingCustomer.id, {
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          creditLimit: Number(creditLimit),
          notes: notes.trim(),
          updatedAt: now
        });

        await logAuditEvent(
          activeBusiness,
          'CUSTOMER_UPDATED',
          name,
          `Customer ${name} profile updated`,
          currentUser
        );
        showToast(`Customer ${name} updated successfully!`, 'success');
      } else {
        const newCustomer: Customer = {
          id: 'cust_' + Date.now(),
          businessId: activeBusiness,
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          creditLimit: Number(creditLimit),
          notes: notes.trim(),
          totalPurchased: 0,
          totalPaid: 0,
          outstandingDebt: 0,
          createdAt: now,
          updatedAt: now
        };

        await db.customers.add(newCustomer);

        await logAuditEvent(
          activeBusiness,
          'CUSTOMER_REGISTERED',
          name,
          `New customer account ${name} registered`,
          currentUser
        );
        showToast(`Customer ${name} registered successfully!`, 'success');
      }

      setIsModalOpen(false);
      loadCustomers();
    } catch (err: any) {
      showToast(`Error saving customer: ${err.message}`, 'error');
    }
  };

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  const totalOutstanding = customers.reduce((sum, c) => sum + c.outstandingDebt, 0);

  return (
    <div className="space-y-5 pb-12 animate-fade-in">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Customer Directory & Credit Management</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage credit limits, outstanding debts, and customer account statements.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Register New Customer</span>
        </button>
      </div>

      {/* Debt Summary Banner */}
      <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-amber-900 block">Total Customer Debt Balance</span>
            <span className="text-xs text-amber-700">Accumulated across all credit accounts in this business</span>
          </div>
        </div>
        <span className="text-2xl font-black text-amber-800 tracking-tight">
          {formatCurrency(totalOutstanding)}
        </span>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search customers by name or Ghana telephone number (e.g. 024)..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-blue-600"
          />
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left divide-y divide-slate-200">
            <thead className="bg-slate-50 font-bold text-slate-600 uppercase">
              <tr>
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-4">Contact Phone</th>
                <th className="py-3 px-4">Location / Address</th>
                <th className="py-3 px-4 text-right">Credit Limit</th>
                <th className="py-3 px-4 text-right">Total Purchased</th>
                <th className="py-3 px-4 text-right">Total Paid</th>
                <th className="py-3 px-4 text-right">Debt Balance</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">Loading customers...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">No customers found.</td>
                </tr>
              ) : (
                filtered.map(cust => (
                  <tr key={cust.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 block">{cust.name}</span>
                      {cust.notes && <span className="text-[11px] text-slate-500 italic block">{cust.notes}</span>}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-700">{cust.phone}</td>
                    <td className="py-3 px-4 text-slate-600">{cust.address || '-'}</td>
                    <td className="py-3 px-4 text-right text-slate-600 font-medium">
                      {formatCurrency(cust.creditLimit)}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-900">
                      {formatCurrency(cust.totalPurchased)}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-emerald-600">
                      {formatCurrency(cust.totalPaid)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`font-black text-sm ${
                        cust.outstandingDebt > 0 ? 'text-amber-700' : 'text-slate-400'
                      }`}>
                        {formatCurrency(cust.outstandingDebt)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onOpenStatement(cust)}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg text-[11px] transition-colors cursor-pointer"
                        >
                          Statement
                        </button>
                        <button
                          onClick={() => onRecordPaymentForCustomer(cust)}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg text-[11px] transition-colors cursor-pointer"
                        >
                          Pay Debt
                        </button>
                        <button
                          onClick={() => openEditModal(cust)}
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-fade-in">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-base">
                  {editingCustomer ? 'Edit Customer Information' : 'Register New Customer Account'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Customer / Business Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Kofi Mensah Construction Ltd"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:outline-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Ghana Phone Number *
                </label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="e.g. 024 123 4567"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:outline-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Address / Site Location
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="e.g. East Legon Hills, Accra"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:outline-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Credit Limit (GH₵)
                </label>
                <input
                  type="number"
                  min="0"
                  value={creditLimit}
                  onChange={e => setCreditLimit(parseFloat(e.target.value) || 0)}
                  placeholder="e.g. 10000"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Special Notes / Project Reference
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Major residential contractor; weekly billing agreed..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:outline-blue-600"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  {editingCustomer ? 'Save Changes' : 'Register Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
