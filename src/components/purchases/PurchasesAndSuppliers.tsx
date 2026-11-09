import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { type Supplier, type Purchase, type Product, type PurchaseItem, type PaymentMethod } from '../../types';
import { db, executePurchaseTransaction, logAuditEvent } from '../../db';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import {
  Truck,
  Plus,
  Search,
  Building,
  CreditCard,
  Package,
  X,
  PlusCircle,
  Trash2,
  CheckCircle2,
  Layers
} from 'lucide-react';

export const PurchasesAndSuppliers: React.FC = () => {
  const { activeBusiness, currentUser } = useAuth();
  const { showToast } = useNotification();

  const [activeTab, setActiveTab] = useState<'purchases' | 'suppliers'>('purchases');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // New Purchase Modal
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [purchaseItems, setPurchaseItems] = useState<
    { productId: string; quantity: number; unitCost: number; packagingUnit?: string }[]
  >([]);
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Supplier Modal
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [supplierAddress, setSupplierAddress] = useState('');
  const [supplierContactPerson, setSupplierContactPerson] = useState('');

  // Supplier Payment Modal
  const [isSupplierPayModalOpen, setIsSupplierPayModalOpen] = useState(false);
  const [paySupplierTarget, setPaySupplierTarget] = useState<Supplier | null>(null);
  const [supplierPayAmount, setSupplierPayAmount] = useState<number>(0);
  const [supplierPayMethod, setSupplierPayMethod] = useState<'cash' | 'momo' | 'bank'>('bank');
  const [supplierPayRef, setSupplierPayRef] = useState('');

  const isDrinks = activeBusiness === 'drinks';

  const loadData = async () => {
    setLoading(true);
    try {
      const sups = await db.suppliers.where('businessId').equals(activeBusiness).toArray();
      setSuppliers(sups);

      const purs = await db.purchases
        .where('businessId')
        .equals(activeBusiness)
        .reverse()
        .toArray();
      setPurchases(purs);

      const prods = await db.products
        .where('businessId')
        .equals(activeBusiness)
        .filter(p => p.isActive)
        .toArray();
      setProducts(prods);
    } catch (err) {
      console.error('Error loading purchases & suppliers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeBusiness]);

  const openNewPurchaseModal = () => {
    setSelectedSupplierId(suppliers[0]?.id || '');
    setInvoiceNumber(`INV-${Date.now().toString().slice(-6)}`);
    setPurchaseItems(
      products.length > 0
        ? [{ productId: products[0].id, quantity: 10, unitCost: products[0].purchasePrice }]
        : []
    );
    setAmountPaid(0);
    setPaymentMethod('cash');
    setNotes('');
    setIsPurchaseModalOpen(true);
  };

  const addPurchaseRow = () => {
    if (products.length === 0) return;
    setPurchaseItems(prev => [
      ...prev,
      { productId: products[0].id, quantity: 10, unitCost: products[0].purchasePrice }
    ]);
  };

  const removePurchaseRow = (idx: number) => {
    setPurchaseItems(prev => prev.filter((_, i) => i !== idx));
  };

  const calculatePurchaseTotal = () => {
    return purchaseItems.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  };

  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId || !currentUser) {
      showToast('Please select a supplier.', 'warning');
      return;
    }

    if (purchaseItems.length === 0) {
      showToast('Please add at least one product item.', 'warning');
      return;
    }

    const supplier = suppliers.find(s => s.id === selectedSupplierId);
    if (!supplier) return;

    const subtotal = calculatePurchaseTotal();
    const balance = Math.max(0, subtotal - amountPaid);
    let status: 'completed' | 'credit' | 'partially_paid' = 'completed';
    if (balance > 0) {
      status = amountPaid > 0 ? 'partially_paid' : 'credit';
    }

    setIsSubmitting(true);
    try {
      const itemsPayload: PurchaseItem[] = purchaseItems.map(row => {
        const p = products.find(prod => prod.id === row.productId);
        return {
          productId: row.productId,
          productName: p?.name || 'Item',
          quantity: Number(row.quantity),
          unitCost: Number(row.unitCost),
          totalCost: Number(row.quantity) * Number(row.unitCost),
          packagingUnit: row.packagingUnit
        };
      });

      await executePurchaseTransaction(
        {
          businessId: activeBusiness,
          purchaseInvoiceNumber: invoiceNumber,
          supplierId: supplier.id,
          supplierName: supplier.name,
          subtotal,
          totalAmount: subtotal,
          amountPaid: Number(amountPaid),
          outstandingBalance: balance,
          paymentMethod,
          status,
          items: itemsPayload,
          notes,
          recordedByUserId: currentUser.id,
          recordedByUserName: currentUser.fullName
        },
        currentUser
      );

      showToast(`Purchase invoice ${invoiceNumber} recorded! Stock and costs updated.`, 'success');
      setIsPurchaseModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast(`Purchase error: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim() || !supplierPhone.trim() || !currentUser) {
      showToast('Please provide supplier name and phone number.', 'warning');
      return;
    }

    try {
      const newSup: Supplier = {
        id: 'sup_' + Date.now(),
        businessId: activeBusiness,
        name: supplierName.trim(),
        phone: supplierPhone.trim(),
        email: supplierEmail.trim() || undefined,
        address: supplierAddress.trim() || undefined,
        contactPerson: supplierContactPerson.trim() || undefined,
        totalPurchased: 0,
        totalPaid: 0,
        outstandingBalance: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await db.suppliers.add(newSup);
      await logAuditEvent(
        activeBusiness,
        'SUPPLIER_REGISTERED',
        supplierName,
        `Supplier ${supplierName} added`,
        currentUser
      );

      showToast(`Supplier ${supplierName} registered successfully!`, 'success');
      setIsSupplierModalOpen(false);
      setSupplierName('');
      setSupplierPhone('');
      setSupplierEmail('');
      setSupplierAddress('');
      setSupplierContactPerson('');
      loadData();
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    }
  };

  const handleSaveSupplierPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paySupplierTarget || !currentUser) return;

    if (supplierPayAmount <= 0) {
      showToast('Payment amount must be greater than zero.', 'warning');
      return;
    }

    try {
      const now = new Date().toISOString();
      await db.transaction('rw', [db.suppliers, db.supplierPayments, db.auditLogs], async () => {
        const newPaid = paySupplierTarget.totalPaid + supplierPayAmount;
        const newBalance = Math.max(0, paySupplierTarget.outstandingBalance - supplierPayAmount);

        await db.suppliers.update(paySupplierTarget.id, {
          totalPaid: newPaid,
          outstandingBalance: newBalance,
          updatedAt: now
        });

        await db.supplierPayments.add({
          id: 'spay_' + Date.now(),
          businessId: activeBusiness,
          supplierId: paySupplierTarget.id,
          supplierName: paySupplierTarget.name,
          amountPaid: supplierPayAmount,
          paymentMethod: supplierPayMethod,
          referenceNumber: supplierPayRef || undefined,
          notes: `Debt settlement to ${paySupplierTarget.name}`,
          recordedByUserId: currentUser.id,
          recordedByUserName: currentUser.fullName,
          createdAt: now
        });

        await logAuditEvent(
          activeBusiness,
          'SUPPLIER_PAYMENT_MADE',
          paySupplierTarget.name,
          `Supplier payment of GH₵ ${supplierPayAmount.toFixed(2)} recorded to ${paySupplierTarget.name}`,
          currentUser
        );
      });

      showToast(`Payment to ${paySupplierTarget.name} recorded!`, 'success');
      setIsSupplierPayModalOpen(false);
      setPaySupplierTarget(null);
      setSupplierPayAmount(0);
      loadData();
    } catch (err: any) {
      showToast(`Payment failed: ${err.message}`, 'error');
    }
  };

  const totalSupplierDebt = suppliers.reduce((sum, s) => sum + s.outstandingBalance, 0);

  return (
    <div className="space-y-5 pb-12 animate-fade-in">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Suppliers & Stock Consignments</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Record incoming wholesale supplies, weighted average inventory costs, and supplier liabilities.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setIsSupplierModalOpen(true)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Building className="w-4 h-4 text-slate-600" />
            <span>New Supplier</span>
          </button>
          <button
            onClick={openNewPurchaseModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Truck className="w-4 h-4" />
            <span>Record Consignment / Purchase</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs flex gap-1">
        <button
          onClick={() => setActiveTab('purchases')}
          className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
            activeTab === 'purchases'
              ? 'bg-[#142D4E] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Purchase Invoices & Consignments ({purchases.length})
        </button>
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
            activeTab === 'suppliers'
              ? 'bg-[#142D4E] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Supplier Accounts & Balances ({suppliers.length})
        </button>
      </div>

      {/* TAB 1: Purchases Table */}
      {activeTab === 'purchases' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left divide-y divide-slate-200">
              <thead className="bg-slate-50 font-bold text-slate-600 uppercase">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Stock Received</th>
                  <th className="py-3 px-4 text-right">Invoice Cost</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Supplier Debt</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      No purchase consignments recorded yet.
                    </td>
                  </tr>
                ) : (
                  purchases.map(pur => (
                    <tr key={pur.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{pur.purchaseInvoiceNumber}</td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{formatDateTime(pur.createdAt)}</td>
                      <td className="py-3 px-4 font-bold text-slate-800">{pur.supplierName}</td>
                      <td className="py-3 px-4 text-slate-600 truncate max-w-xs">
                        {pur.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-900">
                        {formatCurrency(pur.totalAmount)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600">
                        {formatCurrency(pur.amountPaid)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-rose-700">
                        {pur.outstandingBalance > 0 ? formatCurrency(pur.outstandingBalance) : '-'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            pur.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : pur.status === 'partially_paid'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {pur.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-medium">{pur.recordedByUserName}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* TAB 2: Suppliers Table */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left divide-y divide-slate-200">
              <thead className="bg-slate-50 font-bold text-slate-600 uppercase">
                <tr>
                  <th className="py-3 px-4">Supplier Company</th>
                  <th className="py-3 px-4">Contact Phone</th>
                  <th className="py-3 px-4">Contact Person</th>
                  <th className="py-3 px-4">Address</th>
                  <th className="py-3 px-4 text-right">Total Purchased</th>
                  <th className="py-3 px-4 text-right">Total Paid</th>
                  <th className="py-3 px-4 text-right">Outstanding Balance Owed</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">No suppliers registered.</td>
                  </tr>
                ) : (
                  suppliers.map(sup => (
                    <tr key={sup.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{sup.name}</td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-700">{sup.phone}</td>
                      <td className="py-3 px-4 text-slate-600">{sup.contactPerson || '-'}</td>
                      <td className="py-3 px-4 text-slate-600">{sup.address || '-'}</td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900">
                        {formatCurrency(sup.totalPurchased)}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-600">
                        {formatCurrency(sup.totalPaid)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`font-black text-sm ${
                          sup.outstandingBalance > 0 ? 'text-rose-700' : 'text-slate-400'
                        }`}>
                          {formatCurrency(sup.outstandingBalance)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {sup.outstandingBalance > 0 && (
                          <button
                            onClick={() => {
                              setPaySupplierTarget(sup);
                              setSupplierPayAmount(sup.outstandingBalance);
                              setIsSupplierPayModalOpen(true);
                            }}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold rounded-lg text-[11px] transition-colors cursor-pointer"
                          >
                            Pay Balance
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Purchase Consignment Modal */}
      {isPurchaseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full my-8 overflow-hidden animate-fade-in">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-base">Record Inward Stock Consignment</h3>
              </div>
              <button
                onClick={() => setIsPurchaseModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePurchase} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Supplier Company *
                  </label>
                  <select
                    required
                    value={selectedSupplierId}
                    onChange={e => setSelectedSupplierId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:outline-blue-600"
                  >
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Supplier Invoice / Waybill # *
                  </label>
                  <input
                    type="text"
                    required
                    value={invoiceNumber}
                    onChange={e => setInvoiceNumber(e.target.value)}
                    placeholder="e.g. INV-90214"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-medium focus:bg-white focus:outline-blue-600"
                  />
                </div>
              </div>

              {/* Items Row Builder */}
              <div className="space-y-2 border-t border-b border-slate-200 py-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Consignment Items
                  </span>
                  <button
                    type="button"
                    onClick={addPurchaseRow}
                    className="text-xs text-blue-600 font-bold hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                {purchaseItems.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <select
                      value={row.productId}
                      onChange={e => {
                        const newId = e.target.value;
                        const p = products.find(prod => prod.id === newId);
                        setPurchaseItems(prev => {
                          const copy = [...prev];
                          copy[idx].productId = newId;
                          copy[idx].unitCost = p?.purchasePrice || 0;
                          return copy;
                        });
                      }}
                      className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                    >
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.unit})
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min="1"
                      value={row.quantity}
                      onChange={e => {
                        const q = parseInt(e.target.value) || 0;
                        setPurchaseItems(prev => {
                          const copy = [...prev];
                          copy[idx].quantity = q;
                          return copy;
                        });
                      }}
                      placeholder="Qty"
                      className="w-20 px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-center"
                    />

                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.unitCost}
                      onChange={e => {
                        const c = parseFloat(e.target.value) || 0;
                        setPurchaseItems(prev => {
                          const copy = [...prev];
                          copy[idx].unitCost = c;
                          return copy;
                        });
                      }}
                      placeholder="Cost (GH₵)"
                      className="w-24 px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-right"
                    />

                    <span className="w-24 text-right font-bold text-slate-900">
                      {formatCurrency(row.quantity * row.unitCost)}
                    </span>

                    <button
                      type="button"
                      onClick={() => removePurchaseRow(idx)}
                      className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Total & Payment */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between text-sm font-bold text-slate-900">
                  <span>Total Consignment Cost:</span>
                  <span className="text-base font-black">{formatCurrency(calculatePurchaseTotal())}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Amount Paid Now to Supplier:
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={calculatePurchaseTotal()}
                      value={amountPaid}
                      onChange={e => setAmountPaid(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-emerald-700 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Supplier Credit Balance:
                    </label>
                    <div className="px-3 py-1.5 bg-rose-50 border border-rose-200 rounded-lg font-bold text-rose-800 text-xs">
                      {formatCurrency(Math.max(0, calculatePurchaseTotal() - amountPaid))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsPurchaseModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  Receive Stock & Update Inventory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Supplier Modal */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-fade-in">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-base">Register Supplier Company</h3>
              </div>
              <button
                onClick={() => setIsSupplierModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Supplier / Factory Name *
                </label>
                <input
                  type="text"
                  required
                  value={supplierName}
                  onChange={e => setSupplierName(e.target.value)}
                  placeholder="e.g. Ghacem Ghana or Coca-Cola Bottling"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:outline-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Telephone Contact *
                </label>
                <input
                  type="text"
                  required
                  value={supplierPhone}
                  onChange={e => setSupplierPhone(e.target.value)}
                  placeholder="e.g. 030 222 1100"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:outline-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Contact Person / Representative
                </label>
                <input
                  type="text"
                  value={supplierContactPerson}
                  onChange={e => setSupplierContactPerson(e.target.value)}
                  placeholder="e.g. Mr. Emmanuel Tetteh (Key Accounts)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:outline-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Factory / Depot Address
                </label>
                <input
                  type="text"
                  value={supplierAddress}
                  onChange={e => setSupplierAddress(e.target.value)}
                  placeholder="e.g. Harbour Area, Tema"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:outline-blue-600"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Supplier Balance Modal */}
      {isSupplierPayModalOpen && paySupplierTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-fade-in">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-rose-400" />
                <h3 className="font-bold text-base">Settle Supplier Balance</h3>
              </div>
              <button
                onClick={() => setIsSupplierPayModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplierPayment} className="p-6 space-y-4">
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-900 space-y-1">
                <span className="font-bold block">{paySupplierTarget.name}</span>
                <span>
                  Current Liability Owed: <strong>{formatCurrency(paySupplierTarget.outstandingBalance)}</strong>
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Payment Amount to Disburse (GH₵) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={paySupplierTarget.outstandingBalance}
                  required
                  value={supplierPayAmount}
                  onChange={e => setSupplierPayAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-emerald-700 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Payment Method
                </label>
                <select
                  value={supplierPayMethod}
                  onChange={e => setSupplierPayMethod(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium"
                >
                  <option value="bank">Bank Transfer / Cheque</option>
                  <option value="momo">Mobile Money (Business MoMo)</option>
                  <option value="cash">Counter Cash Disbursement</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Cheque # / Transfer Reference
                </label>
                <input
                  type="text"
                  value={supplierPayRef}
                  onChange={e => setSupplierPayRef(e.target.value)}
                  placeholder="e.g. GCB-CHQ-99120"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsSupplierPayModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  Record Supplier Disbursement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
