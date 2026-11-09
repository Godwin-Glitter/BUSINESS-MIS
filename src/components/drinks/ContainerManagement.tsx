import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import {
  type ContainerType,
  type ContainerMovement,
  type CustomerContainerBalance,
  type Customer
} from '../../types';
import { db, logAuditEvent } from '../../db';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import {
  Boxes,
  RotateCcw,
  PlusCircle,
  AlertTriangle,
  Users,
  Search,
  CheckCircle2,
  X,
  History,
  ShieldCheck
} from 'lucide-react';

export const ContainerManagement: React.FC = () => {
  const { currentUser } = useAuth();
  const { showToast } = useNotification();

  const [containers, setContainers] = useState<ContainerType[]>([]);
  const [customerBalances, setCustomerBalances] = useState<CustomerContainerBalance[]>([]);
  const [movements, setMovements] = useState<ContainerMovement[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activeTab, setActiveTab] = useState<'inventory' | 'customers' | 'history'>('inventory');
  const [loading, setLoading] = useState(true);

  // Return Modal State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedCustomerBalance, setSelectedCustomerBalance] = useState<CustomerContainerBalance | null>(null);
  const [returnedCratesCount, setReturnedCratesCount] = useState<number>(1);
  const [depositRefundAmount, setDepositRefundAmount] = useState<number>(0);
  const [returnNotes, setReturnNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Damaged Write-off Modal
  const [isDamageModalOpen, setIsDamageModalOpen] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState<ContainerType | null>(null);
  const [damageCount, setDamageCount] = useState<number>(1);
  const [damageType, setDamageType] = useState<'empty_crate' | 'empty_bottle'>('empty_crate');
  const [damageReason, setDamageReason] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const conts = await db.containerTypes.where('businessId').equals('drinks').toArray();
      setContainers(conts);

      const balances = await db.customerContainerBalances.where('businessId').equals('drinks').toArray();
      setCustomerBalances(balances);

      const movs = await db.containerMovements
        .where('businessId')
        .equals('drinks')
        .reverse()
        .limit(100)
        .toArray();
      setMovements(movs);

      const custs = await db.customers.where('businessId').equals('drinks').toArray();
      setCustomers(custs);
    } catch (err) {
      console.error('Error loading container logistics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openReturnModal = (bal: CustomerContainerBalance) => {
    setSelectedCustomerBalance(bal);
    const cont = containers.find(c => c.id === bal.containerId);
    setReturnedCratesCount(Math.min(1, bal.cratesOwed));
    setDepositRefundAmount((cont?.depositPerCrate || 25) * Math.min(1, bal.cratesOwed));
    setReturnNotes('Customer returned empty crates to depot counter');
    setIsReturnModalOpen(true);
  };

  const handleProcessReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerBalance || !currentUser) return;

    if (returnedCratesCount <= 0) {
      showToast('Returned crates quantity must be at least 1.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date().toISOString();
      const cont = containers.find(c => c.id === selectedCustomerBalance.containerId);
      if (!cont) throw new Error('Container type not found.');

      await db.transaction('rw', [db.containerTypes, db.customerContainerBalances, db.containerMovements, db.auditLogs], async () => {
        // 1. Increase empty crates in warehouse inventory
        const newEmptyCrates = cont.emptyCrates + returnedCratesCount;
        const newEmptyBottles = cont.emptyBottles + returnedCratesCount * cont.bottlesPerCrate;
        await db.containerTypes.update(cont.id, {
          emptyCrates: newEmptyCrates,
          emptyBottles: newEmptyBottles,
          updatedAt: now
        });

        // 2. Reduce customer container balance
        const newOwed = Math.max(0, selectedCustomerBalance.cratesOwed - returnedCratesCount);
        const newDeposits = Math.max(0, selectedCustomerBalance.totalDepositsHeld - depositRefundAmount);
        await db.customerContainerBalances.update(selectedCustomerBalance.id, {
          cratesOwed: newOwed,
          totalDepositsHeld: newDeposits,
          updatedAt: now
        });

        // 3. Record movement
        await db.containerMovements.add({
          id: 'cm_ret_' + Date.now(),
          businessId: 'drinks',
          containerId: cont.id,
          containerName: cont.containerName,
          customerId: selectedCustomerBalance.customerId,
          customerName: selectedCustomerBalance.customerName,
          movementType: 'returned_by_customer',
          cratesCount: returnedCratesCount,
          bottlesCount: returnedCratesCount * cont.bottlesPerCrate,
          depositAmount: depositRefundAmount,
          recordedByUserId: currentUser.id,
          recordedByUserName: currentUser.fullName,
          reason: returnNotes || 'Customer returned empty containers',
          createdAt: now
        });

        // 4. Audit
        await db.auditLogs.add({
          id: 'log_crate_' + Date.now(),
          businessId: 'drinks',
          action: 'CONTAINER_RETURN_RECORDED',
          recordReference: cont.containerName,
          description: `${returnedCratesCount} empty crate(s) returned by ${selectedCustomerBalance.customerName}. Deposit refunded: GH₵ ${depositRefundAmount.toFixed(2)}`,
          userId: currentUser.id,
          userName: currentUser.fullName,
          userRole: currentUser.role,
          timestamp: now
        });
      });

      showToast(`Recorded return of ${returnedCratesCount} crates from ${selectedCustomerBalance.customerName}!`, 'success');
      setIsReturnModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast(`Failed: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProcessDamageWriteOff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContainer || !currentUser) return;

    if (damageCount <= 0) {
      showToast('Quantity must be at least 1.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date().toISOString();
      await db.transaction('rw', [db.containerTypes, db.containerMovements, db.auditLogs], async () => {
        let updatedEmptyCrates = selectedContainer.emptyCrates;
        let updatedEmptyBottles = selectedContainer.emptyBottles;

        if (damageType === 'empty_crate') {
          updatedEmptyCrates = Math.max(0, selectedContainer.emptyCrates - damageCount);
        } else {
          updatedEmptyBottles = Math.max(0, selectedContainer.emptyBottles - damageCount);
        }

        await db.containerTypes.update(selectedContainer.id, {
          emptyCrates: updatedEmptyCrates,
          emptyBottles: updatedEmptyBottles,
          updatedAt: now
        });

        await db.containerMovements.add({
          id: 'cm_dmg_' + Date.now(),
          businessId: 'drinks',
          containerId: selectedContainer.id,
          containerName: selectedContainer.containerName,
          movementType: 'damaged',
          cratesCount: damageType === 'empty_crate' ? damageCount : 0,
          bottlesCount: damageType === 'empty_bottle' ? damageCount : damageCount * selectedContainer.bottlesPerCrate,
          depositAmount: 0,
          recordedByUserId: currentUser.id,
          recordedByUserName: currentUser.fullName,
          reason: damageReason || 'Cracked/broken in depot',
          createdAt: now
        });

        await db.auditLogs.add({
          id: 'log_crate_dmg_' + Date.now(),
          businessId: 'drinks',
          action: 'CONTAINER_DAMAGED_WRITE_OFF',
          recordReference: selectedContainer.containerName,
          description: `Written off ${damageCount} damaged ${damageType === 'empty_crate' ? 'crates' : 'bottles'}. Reason: ${damageReason}`,
          userId: currentUser.id,
          userName: currentUser.fullName,
          userRole: currentUser.role,
          timestamp: now
        });
      });

      showToast(`Damaged containers written off successfully.`, 'info');
      setIsDamageModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast(`Failed: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalOwedCrates = customerBalances.reduce((sum, b) => sum + b.cratesOwed, 0);
  const totalDepositsHeld = customerBalances.reduce((sum, b) => sum + b.totalDepositsHeld, 0);

  return (
    <div className="space-y-5 pb-12 animate-fade-in">
      {/* Banner */}
      <div className="bg-gradient-to-r from-teal-800 to-emerald-900 text-white p-5 rounded-2xl shadow-md border border-teal-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Boxes className="w-6 h-6 text-emerald-300" />
            <h2 className="text-xl font-extrabold tracking-tight">Full & Empty Container Logistics Depot</h2>
          </div>
          <p className="text-xs text-emerald-200 mt-1">
            Independent tracking for Glass Bottle Crates, PET crates, Dispenser bottles, customer owed containers, and return deposits.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="bg-white/10 backdrop-blur-xs px-3.5 py-2 rounded-xl border border-white/20 text-center">
            <span className="text-[10px] text-white/70 block">Total Crates with Customers:</span>
            <span className="text-base font-black text-amber-300">{totalOwedCrates} Crates</span>
          </div>
          <div className="bg-white/10 backdrop-blur-xs px-3.5 py-2 rounded-xl border border-white/20 text-center">
            <span className="text-[10px] text-white/70 block">Customer Deposits Held:</span>
            <span className="text-base font-black text-emerald-200">{formatCurrency(totalDepositsHeld)}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs flex gap-1">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
            activeTab === 'inventory'
              ? 'bg-[#0D9488] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Depot Physical Container Inventory
        </button>
        <button
          onClick={() => setActiveTab('customers')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
            activeTab === 'customers'
              ? 'bg-[#0D9488] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Customer Crates Owed & Deposits ({customerBalances.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
            activeTab === 'history'
              ? 'bg-[#0D9488] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Container Movement History
        </button>
      </div>

      {/* TAB 1: Depot Physical Container Inventory */}
      {activeTab === 'inventory' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {containers.map(c => (
            <div key={c.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">{c.containerName}</h3>
                  <span className="text-[11px] text-slate-500">{c.bottlesPerCrate} bottles per crate unit</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 text-[10px] font-bold border border-teal-200">
                  Depot Asset
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Full Crates:</span>
                  <span className="text-xl font-black text-slate-900">{c.fullCrates}</span>
                  <span className="text-[10px] text-slate-400 block">({c.fullBottles} full btls)</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-amber-700 uppercase block">Empty Crates:</span>
                  <span className="text-xl font-black text-amber-700">{c.emptyCrates}</span>
                  <span className="text-[10px] text-slate-400 block">({c.emptyBottles} empty btls)</span>
                </div>
              </div>

              <div className="flex justify-between items-center text-xs text-slate-600 pt-1">
                <span>Deposit Rate / Crate:</span>
                <span className="font-bold text-slate-900">{formatCurrency(c.depositPerCrate)}</span>
              </div>

              <div className="pt-2 border-t border-slate-100 flex gap-2">
                <button
                  onClick={() => {
                    setSelectedContainer(c);
                    setDamageCount(1);
                    setDamageType('empty_crate');
                    setDamageReason('Cracked crate discarded');
                    setIsDamageModalOpen(true);
                  }}
                  className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold rounded-xl text-xs transition-colors cursor-pointer border border-rose-200"
                >
                  Write-off Damaged
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: Customer Crates Owed & Balances */}
      {activeTab === 'customers' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-bold text-sm text-slate-900">Pubs, Restaurants & Retail Customer Crate Accounts</h3>
            <p className="text-xs text-slate-500">Track which customer is holding empty crates and deposits</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left divide-y divide-slate-200">
              <thead className="bg-slate-50 font-bold text-slate-600 uppercase">
                <tr>
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-4">Container Specification</th>
                  <th className="py-3 px-4 text-center">Empty Crates Owed</th>
                  <th className="py-3 px-4 text-right">Deposits Held</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customerBalances.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No active customer container debts recorded.
                    </td>
                  </tr>
                ) : (
                  customerBalances.map(bal => (
                    <tr key={bal.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{bal.customerName}</td>
                      <td className="py-3 px-4 text-slate-600">{bal.containerName}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-extrabold text-[11px]">
                          {bal.cratesOwed} Crates
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-900">
                        {formatCurrency(bal.totalDepositsHeld)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          bal.cratesOwed > 0 ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'
                        }`}>
                          {bal.cratesOwed > 0 ? 'OWES CRATES' : 'SETTLED'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => openReturnModal(bal)}
                          className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg text-[11px] transition-colors cursor-pointer"
                        >
                          Record Return
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Movement History */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left divide-y divide-slate-200">
              <thead className="bg-slate-50 font-bold text-slate-600 uppercase">
                <tr>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Container Type</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Movement Type</th>
                  <th className="py-3 px-4 text-center">Crates</th>
                  <th className="py-3 px-4 text-right">Deposit Delta</th>
                  <th className="py-3 px-4">Reason / Ref</th>
                  <th className="py-3 px-4">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No container movements recorded yet.
                    </td>
                  </tr>
                ) : (
                  movements.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {formatDateTime(m.createdAt)}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">{m.containerName}</td>
                      <td className="py-3 px-4 text-slate-800 font-medium">
                        {m.customerName || 'Depot Direct'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            m.movementType === 'returned_by_customer'
                              ? 'bg-emerald-100 text-emerald-800'
                              : m.movementType === 'issued_to_customer'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {m.movementType.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-900">
                        {m.cratesCount}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-700">
                        {m.depositAmount !== 0 ? formatCurrency(m.depositAmount) : '-'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 truncate max-w-xs">{m.reason}</td>
                      <td className="py-3 px-4 text-slate-500 font-medium">{m.recordedByUserName}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {isReturnModalOpen && selectedCustomerBalance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-fade-in">
            <div className="bg-[#0D9488] text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-emerald-200" />
                <h3 className="font-bold text-base">Record Container Return</h3>
              </div>
              <button
                onClick={() => setIsReturnModalOpen(false)}
                className="p-1.5 text-white/70 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProcessReturn} className="p-6 space-y-4">
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-3.5 text-xs text-teal-900 space-y-1">
                <span className="font-bold block">{selectedCustomerBalance.customerName}</span>
                <span className="block text-teal-800">
                  Currently Owes: <strong>{selectedCustomerBalance.cratesOwed} empty crates</strong>
                </span>
                <span className="block text-teal-800">
                  Deposit Held: <strong>{formatCurrency(selectedCustomerBalance.totalDepositsHeld)}</strong>
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Quantity of Empty Crates Returned *
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedCustomerBalance.cratesOwed + 100}
                  required
                  value={returnedCratesCount}
                  onChange={e => {
                    const count = parseInt(e.target.value) || 0;
                    setReturnedCratesCount(count);
                    const cont = containers.find(c => c.id === selectedCustomerBalance.containerId);
                    setDepositRefundAmount((cont?.depositPerCrate || 25) * count);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold focus:bg-white focus:outline-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Deposit Refund to Customer (GH₵)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={depositRefundAmount}
                  onChange={e => setDepositRefundAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-emerald-700 focus:bg-white focus:outline-teal-600"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Refund paid back to customer, or enter 0 if customer exchanged directly for full crates.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={returnNotes}
                  onChange={e => setReturnNotes(e.target.value)}
                  placeholder="e.g. Returned intact by driver"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:outline-teal-600"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsReturnModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  Accept Returned Containers
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Damage Modal */}
      {isDamageModalOpen && selectedContainer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-fade-in">
            <div className="bg-rose-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-300" />
                <h3 className="font-bold text-base">Write-off Broken / Damaged Container</h3>
              </div>
              <button
                onClick={() => setIsDamageModalOpen(false)}
                className="p-1.5 text-white/70 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProcessDamageWriteOff} className="p-6 space-y-4">
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-900">
                Writing off damaged items reduces empty depot container assets and logs an audit entry.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Item Damaged
                </label>
                <select
                  value={damageType}
                  onChange={e => setDamageType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white"
                >
                  <option value="empty_crate">Empty Plastic Crate (Broken/Cracked)</option>
                  <option value="empty_bottle">Empty Glass Bottles (Chipped/Shattered)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Quantity Broken *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={damageCount}
                  onChange={e => setDamageCount(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Reason / Circumstance *
                </label>
                <input
                  type="text"
                  required
                  value={damageReason}
                  onChange={e => setDamageReason(e.target.value)}
                  placeholder="e.g. Fell from stack during forklift transit"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsDamageModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  Confirm Write-off
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
