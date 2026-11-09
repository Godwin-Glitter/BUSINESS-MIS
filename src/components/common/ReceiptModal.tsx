import React from 'react';
import { type Sale, type BusinessProfile } from '../../types';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { Printer, Download, X, CheckCircle2, AlertCircle } from 'lucide-react';

interface ReceiptModalProps {
  sale: Sale | null;
  profile?: BusinessProfile | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ sale, profile, onClose }) => {
  if (!sale) return null;

  const handlePrint = () => {
    // Specifically target the #receipt-print-area ID and invoke the browser's print dialog
    const printArea = document.getElementById('receipt-print-area');
    if (!printArea) {
      console.warn('Target #receipt-print-area element was not found in the DOM.');
    }
    window.print();
  };

  const isDrinks = sale.businessId === 'drinks';
  const primaryColor = isDrinks ? 'text-teal-700' : 'text-slate-900';
  const badgeBg = isDrinks ? 'bg-teal-50 text-teal-800 border-teal-200' : 'bg-blue-50 text-blue-800 border-blue-200';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full my-8 overflow-hidden">
        {/* Action Header - hidden in print */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">POS Sales Summary & Receipt</span>
            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${badgeBg}`}>
              {isDrinks ? 'Soft Drinks & Minerals' : 'Building Materials'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              aria-label="Print receipt"
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Print receipt targeting #receipt-print-area"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div id="receipt-print-area" className="p-6 sm:p-8 bg-white text-slate-900 font-mono text-sm leading-relaxed">
          {/* Business Header */}
          <div className="text-center border-b border-dashed border-slate-300 pb-5 mb-5">
            <h2 className="text-xl font-bold tracking-tight uppercase text-slate-900 font-sans">
              {profile?.name || (isDrinks ? 'Oasis Soft Drinks & Minerals Depot' : 'Akwaaba Building Materials Supply')}
            </h2>
            <p className="text-xs text-slate-500 font-sans mt-0.5">
              {profile?.tagline || (isDrinks ? 'Wholesale & Retail Beverage Depot & Empty Crate Logistics' : 'Quality Construction Products & Hardware')}
            </p>
            <p className="text-xs text-slate-600 font-sans mt-1">
              {profile?.address || 'Accra, Greater Accra Region, Ghana'}
            </p>
            <p className="text-xs text-slate-600 font-sans">
              Tel: {profile?.phone || '024 456 7890'} {profile?.tinNumber ? `| TIN: ${profile.tinNumber}` : ''}
            </p>
          </div>

          {/* Meta details */}
          <div className="grid grid-cols-2 text-xs mb-4 gap-2">
            <div>
              <span className="text-slate-500 block">Receipt No:</span>
              <span className="font-bold text-slate-900">{sale.receiptNumber}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block">Date & Time:</span>
              <span className="font-medium text-slate-800">{formatDateTime(sale.createdAt)}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Customer:</span>
              <span className="font-bold text-slate-900">{sale.customerName}</span>
              {sale.customerPhone && <span className="block text-slate-500">{sale.customerPhone}</span>}
            </div>
            <div className="text-right">
              <span className="text-slate-500 block">Cashier / User:</span>
              <span className="font-medium text-slate-800">{sale.recordedByUserName}</span>
            </div>
          </div>

          {sale.isReversed && (
            <div className="p-2.5 bg-rose-50 border border-rose-300 text-rose-800 rounded-lg text-xs font-bold text-center mb-4">
              *** TRANSACTION REVERSED / CANCELLED ***
              <span className="block font-normal text-[11px] text-rose-600">Reason: {sale.reverseReason || 'Voided by supervisor'}</span>
            </div>
          )}

          {/* Items Table */}
          <div className="border-t border-b border-dashed border-slate-300 py-3 my-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 uppercase border-b border-slate-200">
                  <th className="text-left py-1.5 font-semibold">Item & Unit</th>
                  <th className="text-center py-1.5 font-semibold">Qty</th>
                  <th className="text-right py-1.5 font-semibold">Price</th>
                  <th className="text-right py-1.5 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sale.items.map((it, idx) => (
                  <tr key={idx} className="py-1.5">
                    <td className="py-2 pr-2 text-left">
                      <span className="font-medium text-slate-900 block">{it.productName}</span>
                      <span className="text-[11px] text-slate-500">
                        ({it.unitType ? it.unitType.toUpperCase() : it.unit})
                      </span>
                    </td>
                    <td className="py-2 text-center font-semibold text-slate-800">{it.quantity}</td>
                    <td className="py-2 text-right text-slate-600">{formatCurrency(it.unitPrice)}</td>
                    <td className="py-2 text-right font-bold text-slate-900">{formatCurrency(it.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Container Logistics Summary if Soft Drinks */}
          {sale.containerTransactions && sale.containerTransactions.length > 0 && (
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs mb-3">
              <span className="font-bold text-slate-800 block mb-1">Crate & Bottle Tracking:</span>
              {sale.containerTransactions.map((ct, idx) => (
                <div key={idx} className="flex justify-between text-slate-600 py-0.5">
                  <span>{ct.containerName}:</span>
                  <span className="font-medium">
                    {ct.issuedCrates} Issued / {ct.returnedCrates} Returned
                    {ct.netDepositCharge !== 0 && ` (Deposit: ${formatCurrency(ct.netDepositCharge)})`}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Financial Breakdown */}
          <div className="space-y-1.5 text-xs text-right border-b border-dashed border-slate-300 pb-3 mb-3">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-semibold text-slate-900">{formatCurrency(sale.subtotal)}</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Discount Applied:</span>
                <span className="font-semibold">-{formatCurrency(sale.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold text-slate-900 pt-1 border-t border-slate-200">
              <span>Total Payable:</span>
              <span>{formatCurrency(sale.totalAmount)}</span>
            </div>
            <div className="flex justify-between text-slate-800 pt-1">
              <span>Amount Paid:</span>
              <span className="font-bold text-emerald-700">{formatCurrency(sale.amountPaid)}</span>
            </div>
            {sale.outstandingBalance > 0 ? (
              <div className="flex justify-between text-amber-700 font-bold bg-amber-50 p-1.5 rounded">
                <span>Outstanding Balance (Credit):</span>
                <span>{formatCurrency(sale.outstandingBalance)}</span>
              </div>
            ) : (
              <div className="flex justify-between text-emerald-700 text-[11px] font-semibold">
                <span>Payment Status:</span>
                <span>FULLY SETTLED (PAID IN FULL)</span>
              </div>
            )}
          </div>

          {/* Payment Method Details */}
          <div className="text-xs text-slate-600 mb-4">
            <p>
              <strong className="text-slate-800">Payment Method:</strong> {sale.paymentMethod.toUpperCase()}
              {sale.momoDetails && ` (${sale.momoDetails.network} - Ref: ${sale.momoDetails.reference})`}
            </p>
            {sale.dueDate && (
              <p className="text-amber-800 mt-0.5 font-semibold">
                Credit Payment Due Date: {formatDateTime(sale.dueDate)}
              </p>
            )}
            {sale.notes && <p className="mt-1 text-slate-500 italic">Notes: {sale.notes}</p>}
          </div>

          {/* Receipt Footer */}
          <div className="text-center text-[11px] text-slate-500 font-sans border-t border-slate-200 pt-3">
            <p className="font-medium text-slate-700">
              {profile?.receiptNotes || 'Thank you for your business! Goods sold in good condition.'}
            </p>
            <p className="mt-1 text-[10px] text-slate-400">
              Powered by IBMS Ghana • Offline Local Business Management System
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end gap-2.5 print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            aria-label="Print receipt"
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm flex items-center gap-2 transition-all cursor-pointer"
            title="Print receipt targeting #receipt-print-area"
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </button>
        </div>
      </div>
    </div>
  );
};
