import React, { useState, useEffect } from 'react';
import { type Customer, type Sale, type CustomerPayment, type BusinessProfile } from '../../types';
import { db } from '../../db';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import { Printer, X, Download, FileText, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

interface CustomerStatementModalProps {
  customer: Customer | null;
  profile?: BusinessProfile | null;
  onClose: () => void;
}

export const CustomerStatementModal: React.FC<CustomerStatementModalProps> = ({
  customer,
  profile,
  onClose
}) => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<CustomerPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customer) return;
    const targetCustomerId = customer.id;

    async function loadLedger() {
      setLoading(true);
      try {
        const custSales = await db.sales
          .where('customerId')
          .equals(targetCustomerId)
          .filter(s => !s.isReversed)
          .toArray();

        const custPayments = await db.customerPayments
          .where('customerId')
          .equals(targetCustomerId)
          .toArray();

        setSales(custSales);
        setPayments(custPayments);
      } catch (err) {
        console.error('Error loading customer ledger:', err);
      } finally {
        setLoading(false);
      }
    }

    loadLedger();
  }, [customer]);

  if (!customer) return null;

  // Combine sales and payments into a unified sorted transaction ledger
  type LedgerEntry = {
    date: string;
    type: 'Sale' | 'Payment';
    reference: string;
    description: string;
    debit: number; // increases debt
    credit: number; // decreases debt
  };

  const ledger: LedgerEntry[] = [
    ...sales.map(s => ({
      date: s.createdAt,
      type: 'Sale' as const,
      reference: s.receiptNumber,
      description: `Sale of ${s.items.map(i => `${i.quantity}x ${i.productName}`).slice(0, 2).join(', ')}${s.items.length > 2 ? '...' : ''}`,
      debit: s.totalAmount,
      credit: 0
    })),
    ...payments.map(p => ({
      date: p.createdAt,
      type: 'Payment' as const,
      reference: p.receiptNumber,
      description: `Customer Payment via ${p.paymentMethod.toUpperCase()}${p.referenceNumber ? ` (Ref: ${p.referenceNumber})` : ''}`,
      debit: 0,
      credit: p.amountPaid
    }))
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Running balance calculation
  let running = 0;
  const ledgerWithBalance = ledger.map(entry => {
    running += entry.debit - entry.credit;
    return {
      ...entry,
      balance: running
    };
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full my-8 overflow-hidden">
        {/* Modal Controls - hidden in print */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-sm">Customer Account Statement</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Statement
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Statement */}
        <div className="p-8 bg-white text-slate-900">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start border-b border-slate-200 pb-6 mb-6 gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                {profile?.name || 'IBMS Business Management System'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">{profile?.address || 'Accra, Ghana'}</p>
              <p className="text-xs text-slate-500">Tel: {profile?.phone || '024 456 7890'}</p>
            </div>
            <div className="sm:text-right">
              <span className="inline-block px-3 py-1 bg-slate-100 text-slate-800 text-xs font-bold uppercase rounded-md tracking-wider">
                Statement of Account
              </span>
              <p className="text-xs text-slate-500 mt-2">
                Date Generated: {formatDateTime(new Date().toISOString())}
              </p>
            </div>
          </div>

          {/* Customer Details & Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Statement For:
              </span>
              <h4 className="text-base font-bold text-slate-900">{customer.name}</h4>
              <p className="text-xs text-slate-600 mt-0.5">Phone: {customer.phone}</p>
              {customer.address && <p className="text-xs text-slate-600">Address: {customer.address}</p>}
              {customer.notes && <p className="text-xs text-slate-500 italic mt-1">"{customer.notes}"</p>}
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex justify-between items-center text-xs text-slate-600 mb-1">
                <span>Total Purchased (Invoiced):</span>
                <span className="font-semibold text-slate-900">{formatCurrency(customer.totalPurchased)}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-600 mb-2">
                <span>Total Payments Received:</span>
                <span className="font-semibold text-emerald-600">{formatCurrency(customer.totalPaid)}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-700 uppercase">Net Outstanding Debt:</span>
                <span className={`text-base font-extrabold ${customer.outstandingDebt > 0 ? 'text-amber-600' : 'text-emerald-700'}`}>
                  {formatCurrency(customer.outstandingDebt)}
                </span>
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl mb-6">
            <table className="w-full text-left text-xs divide-y divide-slate-200">
              <thead className="bg-slate-100 font-semibold text-slate-700">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Ref / Invoice</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3 text-right">Debit (Inv)</th>
                  <th className="py-2.5 px-3 text-right">Credit (Paid)</th>
                  <th className="py-2.5 px-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-400">Loading customer ledger...</td>
                  </tr>
                ) : ledgerWithBalance.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-400">No transactions recorded for this customer yet.</td>
                  </tr>
                ) : (
                  ledgerWithBalance.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{formatDate(item.date)}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                          item.type === 'Sale' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {item.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">{item.reference}</td>
                      <td className="py-2.5 px-3 text-slate-600 truncate max-w-xs">{item.description}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-slate-900">
                        {item.debit > 0 ? formatCurrency(item.debit) : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-emerald-600">
                        {item.credit > 0 ? formatCurrency(item.credit) : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                        {formatCurrency(item.balance)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="text-center text-xs text-slate-500 border-t border-slate-200 pt-4">
            <p>Please review your statement. For inquiries or payment confirmation via Mobile Money / Bank, contact management.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end gap-2.5 print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm flex items-center gap-2 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Print Statement
          </button>
        </div>
      </div>
    </div>
  );
};
