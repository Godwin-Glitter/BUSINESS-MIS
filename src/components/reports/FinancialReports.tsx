import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import {
  type BusinessId,
  type FinancialSummary,
  type Sale,
  type Product,
  type Customer,
  type Supplier,
  type Expense,
  type ContainerType
} from '../../types';
import { db, getFinancialSummary } from '../../db';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import {
  FileBarChart,
  Download,
  Printer,
  Calendar,
  Filter,
  TrendingUp,
  DollarSign,
  Package,
  Users,
  Boxes,
  AlertTriangle
} from 'lucide-react';

export const FinancialReports: React.FC = () => {
  const { activeBusiness } = useAuth();
  const { showToast } = useNotification();

  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [reportType, setReportType] = useState<
    'pnl' | 'sales' | 'inventory' | 'debts' | 'suppliers' | 'expenses' | 'containers'
  >('pnl');

  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [containers, setContainers] = useState<ContainerType[]>([]);
  const [loading, setLoading] = useState(true);

  const isDrinks = activeBusiness === 'drinks';

  // Compute start/end dates
  const getDateBounds = () => {
    const now = new Date();
    let start: string | undefined;
    let end: string | undefined;

    if (dateRange === 'today') {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      start = d.toISOString();
    } else if (dateRange === 'week') {
      const d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      start = d.toISOString();
    } else if (dateRange === 'month') {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      start = d.toISOString();
    } else if (dateRange === 'year') {
      const d = new Date(now.getFullYear(), 0, 1);
      start = d.toISOString();
    } else if (dateRange === 'custom') {
      if (customStart) start = new Date(customStart).toISOString();
      if (customEnd) end = new Date(customEnd + 'T23:59:59').toISOString();
    }

    return { start, end };
  };

  const loadReportData = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateBounds();
      const sum = await getFinancialSummary(activeBusiness, start, end);
      setSummary(sum);

      const allSales = await db.sales
        .where('businessId')
        .equals(activeBusiness)
        .toArray();
      const validSales = allSales.filter(s => {
        if (s.isReversed) return false;
        if (start && s.createdAt < start) return false;
        if (end && s.createdAt > end) return false;
        return true;
      });
      setSales(validSales);

      const prods = await db.products.where('businessId').equals(activeBusiness).toArray();
      setProducts(prods);

      const custs = await db.customers.where('businessId').equals(activeBusiness).toArray();
      setCustomers(custs);

      const sups = await db.suppliers.where('businessId').equals(activeBusiness).toArray();
      setSuppliers(sups);

      const exps = await db.expenses.where('businessId').equals(activeBusiness).toArray();
      const validExps = exps.filter(e => {
        if (start && e.date < start.split('T')[0]) return false;
        if (end && e.date > end.split('T')[0]) return false;
        return true;
      });
      setExpenses(validExps);

      if (isDrinks) {
        const conts = await db.containerTypes.where('businessId').equals('drinks').toArray();
        setContainers(conts);
      }
    } catch (err) {
      console.error('Error loading reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [activeBusiness, dateRange, customStart, customEnd]);

  // CSV Export Function
  const exportToCSV = () => {
    let rows: string[][] = [];
    let filename = `Report-${activeBusiness}-${reportType}-${Date.now()}.csv`;

    if (reportType === 'pnl') {
      rows = [
        ['PROFIT & LOSS STATEMENT', activeBusiness.toUpperCase(), new Date().toLocaleDateString('en-GB')],
        ['Item', 'Amount (GH₵)'],
        ['Gross Invoiced Sales Revenue', (summary?.totalSales || 0).toFixed(2)],
        ['Cost of Goods Sold (COGS)', (summary?.costOfGoodsSold || 0).toFixed(2)],
        ['Gross Trading Profit', (summary?.grossProfit || 0).toFixed(2)],
        ['Total Operating Expenses', (summary?.totalExpenses || 0).toFixed(2)],
        ['Net Operating Profit / (Loss)', (summary?.netProfit || 0).toFixed(2)],
        ['', ''],
        ['Cash Receipts Breakdown', ''],
        ['Cash Received', (summary?.cashReceived || 0).toFixed(2)],
        ['Mobile Money Received', (summary?.momoReceived || 0).toFixed(2)],
        ['Bank Received', (summary?.bankReceived || 0).toFixed(2)],
        ['Credit Sales (Debts Added)', (summary?.creditSales || 0).toFixed(2)]
      ];
    } else if (reportType === 'sales') {
      rows = [
        ['Receipt #', 'Date', 'Customer', 'Payment Method', 'Subtotal', 'Discount', 'Total Amount', 'Amount Paid', 'Outstanding Debt'],
        ...sales.map(s => [
          s.receiptNumber,
          s.createdAt,
          s.customerName,
          s.paymentMethod,
          s.subtotal.toFixed(2),
          s.discount.toFixed(2),
          s.totalAmount.toFixed(2),
          s.amountPaid.toFixed(2),
          s.outstandingBalance.toFixed(2)
        ])
      ];
    } else if (reportType === 'debts') {
      rows = [
        ['Customer Name', 'Phone', 'Address', 'Credit Limit', 'Total Invoiced', 'Total Paid', 'Current Outstanding Debt'],
        ...customers.filter(c => c.outstandingDebt > 0).map(c => [
          c.name,
          c.phone,
          c.address || '',
          c.creditLimit.toFixed(2),
          c.totalPurchased.toFixed(2),
          c.totalPaid.toFixed(2),
          c.outstandingDebt.toFixed(2)
        ])
      ];
    } else if (reportType === 'inventory') {
      rows = [
        ['SKU', 'Product Name', 'Category', 'Unit', 'Purchase Cost', 'Selling Price', 'Current Stock', 'Stock Valuation'],
        ...products.map(p => [
          p.codeSku,
          p.name,
          p.categoryName,
          p.unit,
          p.purchasePrice.toFixed(2),
          p.sellingPrice.toFixed(2),
          p.currentStock.toString(),
          (p.currentStock * p.purchasePrice).toFixed(2)
        ])
      ];
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.map(cell => `"${cell}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Report downloaded as CSV file.', 'success');
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Top Banner & Date Controls */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 print:hidden">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
            Financial & Operational Intelligence Reports
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Independent business reporting with weighted average cost calculations and audit trails.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Period selector */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            {(['today', 'week', 'month', 'year', 'custom'] as const).map(p => (
              <button
                key={p}
                onClick={() => setDateRange(p)}
                className={`px-3 py-1.5 rounded-lg capitalize transition-all cursor-pointer ${
                  dateRange === p
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : p === 'year' ? 'This Year' : 'Custom'}
              </button>
            ))}
          </div>

          {/* Action buttons */}
          <button
            onClick={exportToCSV}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Export CSV / Excel</span>
          </button>

          <button
            onClick={handlePrintReport}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Custom Date Filters */}
      {dateRange === 'custom' && (
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center gap-3 text-xs print:hidden animate-fade-in">
          <span className="font-bold text-slate-700">Custom Date Range:</span>
          <div className="flex items-center gap-2">
            <span>From:</span>
            <input
              type="date"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <span>To:</span>
            <input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
            />
          </div>
        </div>
      )}

      {/* Report Type Selector Tabs */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap gap-1 print:hidden">
        <button
          onClick={() => setReportType('pnl')}
          className={`flex-1 min-w-[140px] py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
            reportType === 'pnl' ? 'bg-[#142D4E] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Profit & Loss Statement
        </button>
        <button
          onClick={() => setReportType('sales')}
          className={`flex-1 min-w-[140px] py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
            reportType === 'sales' ? 'bg-[#142D4E] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Sales & Revenue Report
        </button>
        <button
          onClick={() => setReportType('debts')}
          className={`flex-1 min-w-[140px] py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
            reportType === 'debts' ? 'bg-[#142D4E] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Customer Debts & Aging
        </button>
        <button
          onClick={() => setReportType('inventory')}
          className={`flex-1 min-w-[140px] py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
            reportType === 'inventory' ? 'bg-[#142D4E] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Inventory Valuation
        </button>
        {isDrinks && (
          <button
            onClick={() => setReportType('containers')}
            className={`flex-1 min-w-[140px] py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
              reportType === 'containers' ? 'bg-[#0D9488] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Container & Crate Audit
          </button>
        )}
      </div>

      {/* Printable Report Paper Layout */}
      <div id="printable-report" className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
        {/* Printable Business Header */}
        <div className="border-b border-slate-200 pb-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              {isDrinks ? 'Oasis Soft Drinks & Minerals Depot' : 'Akwaaba Building Materials Supply'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Official Management Accounts Report • Ghana Division
            </p>
          </div>
          <div className="sm:text-right text-xs text-slate-500">
            <span className="font-bold text-slate-800 uppercase block">
              Reporting Scope: {dateRange.toUpperCase()}
            </span>
            <span>Generated: {formatDateTime(new Date().toISOString())}</span>
          </div>
        </div>

        {/* REPORT CONTENT 1: PROFIT & LOSS STATEMENT */}
        {reportType === 'pnl' && (
          <div className="space-y-6">
            <h3 className="text-base font-extrabold text-slate-900 border-b pb-2">
              Trading, Profit & Loss Statement (Ghana Cedis)
            </h3>

            <div className="max-w-2xl mx-auto space-y-3 font-mono text-xs">
              <div className="flex justify-between py-2 border-b border-slate-200 font-bold text-slate-900">
                <span>1. Invoiced Gross Sales Revenue:</span>
                <span className="text-sm font-black">{formatCurrency(summary?.totalSales || 0)}</span>
              </div>

              <div className="flex justify-between py-1.5 text-slate-600 pl-4">
                <span>Less: Weighted Cost of Goods Sold (COGS):</span>
                <span className="text-rose-700 font-bold">-{formatCurrency(summary?.costOfGoodsSold || 0)}</span>
              </div>

              <div className="flex justify-between py-2 border-t border-b border-slate-300 font-bold text-slate-900 bg-slate-50 px-2 rounded">
                <span>GROSS TRADING PROFIT:</span>
                <span className="text-sm font-black text-emerald-700">{formatCurrency(summary?.grossProfit || 0)}</span>
              </div>

              <div className="pt-2">
                <span className="font-bold text-slate-800 block mb-1">Operating Expenses (Shop & Depot Overheads):</span>
                <div className="flex justify-between py-1.5 text-slate-600 pl-4">
                  <span>Operating Expenses Total:</span>
                  <span className="text-rose-700 font-bold">-{formatCurrency(summary?.totalExpenses || 0)}</span>
                </div>
              </div>

              <div className="flex justify-between py-3 border-t-2 border-b-2 border-slate-900 font-bold text-sm bg-blue-50/50 px-3 rounded-lg">
                <span className="uppercase tracking-wider font-sans font-black">NET OPERATING PROFIT / (LOSS):</span>
                <span className={`text-base font-black ${
                  (summary?.netProfit || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}>
                  {formatCurrency(summary?.netProfit || 0)}
                </span>
              </div>
            </div>

            {/* Cash Flow vs Credit Verification Section */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 text-xs">
              <h4 className="font-bold text-slate-900 mb-2">Cash Flow Collection & Debt Integrity Check</h4>
              <p className="text-slate-600 leading-relaxed mb-3">
                In strict compliance with statutory accounting rules, credit sales increase revenue and customer debts but are not recognized as cash received until payments are settled.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase block">Cash Collections:</span>
                  <span className="font-bold text-slate-900 text-sm">{formatCurrency(summary?.cashReceived || 0)}</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase block">MoMo Collections:</span>
                  <span className="font-bold text-amber-800 text-sm">{formatCurrency(summary?.momoReceived || 0)}</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase block">Bank Payments:</span>
                  <span className="font-bold text-blue-900 text-sm">{formatCurrency(summary?.bankReceived || 0)}</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase block">New Credit Debts:</span>
                  <span className="font-bold text-rose-800 text-sm">{formatCurrency(summary?.creditSales || 0)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* REPORT CONTENT 2: SALES REPORT */}
        {reportType === 'sales' && (
          <div className="space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 border-b pb-2">
              Sales Ledger ({sales.length} Transactions)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left divide-y divide-slate-200">
                <thead className="bg-slate-100 font-bold text-slate-700 uppercase">
                  <tr>
                    <th className="py-2 px-3">Receipt</th>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Customer</th>
                    <th className="py-2 px-3">Method</th>
                    <th className="py-2 px-3 text-right">Invoiced</th>
                    <th className="py-2 px-3 text-right">Paid</th>
                    <th className="py-2 px-3 text-right">Debt Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sales.map(s => (
                    <tr key={s.id}>
                      <td className="py-2 px-3 font-mono font-bold text-slate-900">{s.receiptNumber}</td>
                      <td className="py-2 px-3 text-slate-600">{formatDate(s.createdAt)}</td>
                      <td className="py-2 px-3 font-semibold text-slate-800">{s.customerName}</td>
                      <td className="py-2 px-3 uppercase text-slate-600">{s.paymentMethod}</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">{formatCurrency(s.totalAmount)}</td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-600">{formatCurrency(s.amountPaid)}</td>
                      <td className="py-2 px-3 text-right font-bold text-amber-700">
                        {s.outstandingBalance > 0 ? formatCurrency(s.outstandingBalance) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* REPORT CONTENT 3: DEBTS REPORT */}
        {reportType === 'debts' && (
          <div className="space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 border-b pb-2">
              Customer Accounts Receivable & Outstanding Debts
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left divide-y divide-slate-200">
                <thead className="bg-slate-100 font-bold text-slate-700 uppercase">
                  <tr>
                    <th className="py-2 px-3">Customer</th>
                    <th className="py-2 px-3">Phone</th>
                    <th className="py-2 px-3 text-right">Credit Limit</th>
                    <th className="py-2 px-3 text-right">Total Invoiced</th>
                    <th className="py-2 px-3 text-right">Total Paid</th>
                    <th className="py-2 px-3 text-right">Outstanding Debt Owed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customers.filter(c => c.outstandingDebt > 0).map(c => (
                    <tr key={c.id}>
                      <td className="py-2 px-3 font-bold text-slate-900">{c.name}</td>
                      <td className="py-2 px-3 font-mono text-slate-600">{c.phone}</td>
                      <td className="py-2 px-3 text-right text-slate-600">{formatCurrency(c.creditLimit)}</td>
                      <td className="py-2 px-3 text-right text-slate-800 font-semibold">{formatCurrency(c.totalPurchased)}</td>
                      <td className="py-2 px-3 text-right text-emerald-600 font-semibold">{formatCurrency(c.totalPaid)}</td>
                      <td className="py-2 px-3 text-right font-black text-amber-700">{formatCurrency(c.outstandingDebt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* REPORT CONTENT 4: INVENTORY REPORT */}
        {reportType === 'inventory' && (
          <div className="space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 border-b pb-2">
              Inventory Physical Valuation Report
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left divide-y divide-slate-200">
                <thead className="bg-slate-100 font-bold text-slate-700 uppercase">
                  <tr>
                    <th className="py-2 px-3">SKU</th>
                    <th className="py-2 px-3">Product Name</th>
                    <th className="py-2 px-3">Category</th>
                    <th className="py-2 px-3 text-center">Unit</th>
                    <th className="py-2 px-3 text-right">Weighted Cost</th>
                    <th className="py-2 px-3 text-center">Stock</th>
                    <th className="py-2 px-3 text-right">Valuation (GH₵)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map(p => (
                    <tr key={p.id}>
                      <td className="py-2 px-3 font-mono font-bold text-slate-800">{p.codeSku}</td>
                      <td className="py-2 px-3 font-bold text-slate-900">{p.name}</td>
                      <td className="py-2 px-3 text-slate-600">{p.categoryName}</td>
                      <td className="py-2 px-3 text-center text-slate-600">{p.unit}</td>
                      <td className="py-2 px-3 text-right text-slate-700">{formatCurrency(p.purchasePrice)}</td>
                      <td className="py-2 px-3 text-center font-bold">{p.currentStock}</td>
                      <td className="py-2 px-3 text-right font-black text-slate-900">
                        {formatCurrency(p.currentStock * p.purchasePrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* REPORT CONTENT 5: CONTAINER AUDIT (SOFT DRINKS) */}
        {isDrinks && reportType === 'containers' && (
          <div className="space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 border-b pb-2">
              Soft Drinks Crate & Bottle Inventory Audit
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {containers.map(c => (
                <div key={c.id} className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-xs space-y-1">
                  <span className="font-bold text-teal-900 block">{c.containerName}</span>
                  <div className="flex justify-between text-teal-800">
                    <span>Full Crates in Depot:</span>
                    <span className="font-black">{c.fullCrates} ({c.fullBottles} btls)</span>
                  </div>
                  <div className="flex justify-between text-teal-800">
                    <span>Empty Crates in Depot:</span>
                    <span className="font-black text-amber-800">{c.emptyCrates} ({c.emptyBottles} btls)</span>
                  </div>
                  <div className="flex justify-between text-teal-800 pt-1 border-t border-teal-200">
                    <span>Deposit Rate / Crate:</span>
                    <span className="font-bold">{formatCurrency(c.depositPerCrate)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
