import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { type BusinessId, type FinancialSummary, type Sale, type Customer, type Product, type ContainerType } from '../../types';
import { db, getFinancialSummary } from '../../db';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import {
  TrendingUp,
  CreditCard,
  AlertCircle,
  Package,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ShoppingCart,
  PlusCircle,
  Truck,
  Users,
  Receipt,
  FileBarChart,
  Boxes,
  Clock,
  Database,
  Building2,
  Wine,
  CheckCircle2,
  Smartphone,
  Banknote,
  Building
} from 'lucide-react';

interface BusinessDashboardProps {
  onNavigate: (tab: string) => void;
  onOpenReceipt: (sale: Sale) => void;
}

export const BusinessDashboard: React.FC<BusinessDashboardProps> = ({ onNavigate, onOpenReceipt }) => {
  const { activeBusiness, currentUser } = useAuth();
  const { triggerBackupNow } = useNotification();
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all'>('month');
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [debtorCustomers, setDebtorCustomers] = useState<Customer[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [containers, setContainers] = useState<ContainerType[]>([]);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isBuilding = activeBusiness === 'building';

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      try {
        // Calculate date filters
        const now = new Date();
        let startDate: string | undefined;

        if (period === 'today') {
          const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          startDate = start.toISOString();
        } else if (period === 'week') {
          const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          startDate = start.toISOString();
        } else if (period === 'month') {
          const start = new Date(now.getFullYear(), now.getMonth(), 1);
          startDate = start.toISOString();
        }

        const finSummary = await getFinancialSummary(activeBusiness, startDate);
        setSummary(finSummary);

        // Recent sales
        const sales = await db.sales
          .where('businessId')
          .equals(activeBusiness)
          .reverse()
          .limit(8)
          .toArray();
        setRecentSales(sales);

        // Debtors
        const debtors = await db.customers
          .where('businessId')
          .equals(activeBusiness)
          .filter(c => c.outstandingDebt > 0)
          .toArray();
        setDebtorCustomers(debtors);

        // Low stock products
        const products = await db.products
          .where('businessId')
          .equals(activeBusiness)
          .filter(p => p.isActive && p.currentStock <= p.minStockLevel)
          .toArray();
        setLowStockProducts(products);

        // If drinks, fetch containers
        if (activeBusiness === 'drinks') {
          const conts = await db.containerTypes.where('businessId').equals('drinks').toArray();
          setContainers(conts);
        }

        // App settings last backup
        const settings = await db.appSettings.get('global_settings');
        if (settings?.lastBackupAt) {
          setLastBackup(settings.lastBackupAt);
        }
      } catch (err) {
        console.error('Error loading dashboard:', err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, [activeBusiness, period]);

  // Accent styling
  const accentCardBg = isBuilding ? 'bg-[#142D4E] text-white' : 'bg-[#0D9488] text-white';
  const accentText = isBuilding ? 'text-blue-600' : 'text-teal-600';

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Top Banner & Quick Shortcuts */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-extrabold text-slate-900 tracking-tight">
              {isBuilding ? 'Building Materials Command Center' : 'Soft Drinks & Beverage Depot Dashboard'}
            </span>
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                isBuilding ? 'bg-blue-100 text-blue-900' : 'bg-teal-100 text-teal-900'
              }`}
            >
              Ghana Division
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time financial figures calculated directly from saved local records.
          </p>
        </div>

        {/* Period Filter Tabs */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
          {(['today', 'week', 'month', 'all'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg capitalize transition-all cursor-pointer ${
                period === p
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
        <button
          onClick={() => onNavigate('pos')}
          className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer font-bold text-xs group"
        >
          <ShoppingCart className="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span>New Sale (POS)</span>
        </button>

        <button
          onClick={() => onNavigate('products')}
          className="p-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer font-semibold text-xs group"
        >
          <PlusCircle className="w-5 h-5 text-emerald-600 group-hover:scale-110 transition-transform" />
          <span>Add Product</span>
        </button>

        <button
          onClick={() => onNavigate('purchases')}
          className="p-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer font-semibold text-xs group"
        >
          <Truck className="w-5 h-5 text-indigo-600 group-hover:scale-110 transition-transform" />
          <span>Record Purchase</span>
        </button>

        <button
          onClick={() => onNavigate('customers')}
          className="p-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer font-semibold text-xs group"
        >
          <Users className="w-5 h-5 text-blue-600 group-hover:scale-110 transition-transform" />
          <span>Add Customer</span>
        </button>

        <button
          onClick={() => onNavigate('payments')}
          className="p-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer font-semibold text-xs group"
        >
          <CreditCard className="w-5 h-5 text-amber-600 group-hover:scale-110 transition-transform" />
          <span>Customer Payment</span>
        </button>

        <button
          onClick={() => onNavigate('expenses')}
          className="p-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer font-semibold text-xs group"
        >
          <Receipt className="w-5 h-5 text-rose-600 group-hover:scale-110 transition-transform" />
          <span>Add Expense</span>
        </button>

        <button
          onClick={() => onNavigate('reports')}
          className="p-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer font-semibold text-xs group col-span-2 sm:col-span-1"
        >
          <FileBarChart className="w-5 h-5 text-purple-600 group-hover:scale-110 transition-transform" />
          <span>View Reports</span>
        </button>
      </div>

      {/* 8.3 Four Prominent Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Sales */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Sales</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {formatCurrency(summary?.totalSales || 0)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span>Invoiced sales for {period}</span>
          </p>
        </div>

        {/* Card 2: Amount Received */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Amount Received</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Banknote className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 tracking-tight">
            {formatCurrency(summary?.totalReceived || 0)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Cash, MoMo & Bank payments collected
          </p>
        </div>

        {/* Card 3: Credit Sales (Owed by Customers) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Credit Sales</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 tracking-tight">
            {formatCurrency(summary?.creditSales || 0)}
          </div>
          <p className="text-[11px] text-amber-700 font-medium mt-1">
            Pending customer collections
          </p>
        </div>

        {/* Card 4: Estimated Profit */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Estimated Net Profit</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
          <div className={`text-2xl font-black tracking-tight ${
            (summary?.netProfit || 0) >= 0 ? 'text-indigo-600' : 'text-rose-600'
          }`}>
            {formatCurrency(summary?.netProfit || 0)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Revenue - COGS - Expenses ({formatCurrency(summary?.totalExpenses || 0)})
          </p>
        </div>
      </div>

      {/* 8.4 Inventory Overview & Daily Cash Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Inventory Overview Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-sm text-slate-900">Inventory Overview</h3>
            </div>
            <button
              onClick={() => onNavigate('inventory')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
            >
              View Stock →
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              <span className="text-[11px] font-semibold text-slate-500 block">Total Active SKUs</span>
              <span className="text-xl font-bold text-slate-900">{summary?.totalProductsCount || 0}</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              <span className="text-[11px] font-semibold text-slate-500 block">Inventory Valuation</span>
              <span className="text-base font-bold text-slate-900 truncate block">
                {formatCurrency(summary?.inventoryValue || 0)}
              </span>
            </div>
            <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200/80">
              <span className="text-[11px] font-semibold text-amber-700 block">Low Stock Alerts</span>
              <span className="text-xl font-bold text-amber-800">{summary?.lowStockCount || 0}</span>
            </div>
            <div className="bg-rose-50/70 p-3 rounded-xl border border-rose-200/80">
              <span className="text-[11px] font-semibold text-rose-700 block">Out of Stock</span>
              <span className="text-xl font-bold text-rose-800">{summary?.outOfStockCount || 0}</span>
            </div>
          </div>

          {lowStockProducts.length > 0 ? (
            <div className="border-t border-slate-100 pt-3">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                Needs Reordering:
              </span>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {lowStockProducts.slice(0, 4).map(p => (
                  <div key={p.id} className="flex justify-between items-center text-xs py-1 px-2 rounded-lg bg-amber-50/40 border border-amber-100">
                    <span className="font-medium text-slate-800 truncate max-w-[170px]">{p.name}</span>
                    <span className="font-bold text-amber-800 shrink-0">
                      {p.currentStock} {p.unit} (Min: {p.minStockLevel})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-xs text-slate-400">All inventory levels healthy.</div>
          )}
        </div>

        {/* 8.9 Daily Payment Summary */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-sm text-slate-900">Collections by Channel</h3>
            </div>
            <span className="text-[11px] font-semibold text-slate-400">Real-time</span>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Banknote className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Cash Payments</span>
                  <span className="text-[10px] text-slate-500">Shop Counter Drawer</span>
                </div>
              </div>
              <span className="text-sm font-black text-slate-900">
                {formatCurrency(summary?.cashReceived || 0)}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50/50 border border-amber-200/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Mobile Money (MoMo)</span>
                  <span className="text-[10px] text-slate-500">MTN, Telecel & AirtelTigo</span>
                </div>
              </div>
              <span className="text-sm font-black text-amber-800">
                {formatCurrency(summary?.momoReceived || 0)}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/50 border border-blue-200/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
                  <Building className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Bank Direct / Transfers</span>
                  <span className="text-[10px] text-slate-500">Commercial Bank Accounts</span>
                </div>
              </div>
              <span className="text-sm font-black text-blue-900">
                {formatCurrency(summary?.bankReceived || 0)}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-between text-xs text-slate-600">
              <span>Supplier Purchases Total:</span>
              <span className="font-bold text-slate-900">{formatCurrency(summary?.totalPurchases || 0)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-600">
              <span>Supplier Debt Balance:</span>
              <span className="font-bold text-rose-700">{formatCurrency(summary?.totalSupplierDebt || 0)}</span>
            </div>
          </div>
        </div>

        {/* 8.5 Customer Debts & Debtors Shortcut */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-sm text-slate-900">Outstanding Customer Debts</h3>
              </div>
              <button
                onClick={() => onNavigate('customers')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
              >
                All Debtors →
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-center">
              <span className="text-xs font-semibold text-amber-800 uppercase block mb-1">
                Total Debt Owed by Customers
              </span>
              <span className="text-2xl font-black text-amber-800 tracking-tight">
                {formatCurrency(summary?.totalCustomerDebt || 0)}
              </span>
              <span className="text-[11px] text-amber-700 block mt-1">
                Across {debtorCustomers.length} active credit customer{debtorCustomers.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {debtorCustomers.slice(0, 4).map(c => (
                <div
                  key={c.id}
                  onClick={() => onNavigate('customers')}
                  className="flex justify-between items-center p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-900 block truncate max-w-[140px]">{c.name}</span>
                    <span className="text-[10px] text-slate-500">{c.phone}</span>
                  </div>
                  <span className="font-black text-amber-700">{formatCurrency(c.outstandingDebt)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Last Backup:</span>
            <span className="font-medium text-slate-700">
              {lastBackup ? formatDateTime(lastBackup) : 'None today'}
            </span>
          </div>
        </div>
      </div>

      {/* SPECIAL FOR SOFT DRINKS: Dedicated Container Overview */}
      {activeBusiness === 'drinks' && (
        <div className="bg-gradient-to-r from-teal-900 to-emerald-900 text-white p-5 rounded-2xl shadow-md border border-teal-800">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <Boxes className="w-6 h-6 text-emerald-300" />
              <div>
                <h3 className="font-bold text-base text-white">Full & Empty Crate / Container Depot Status</h3>
                <p className="text-xs text-emerald-200">
                  Track full beverages, empty crates in warehouse, and customer container deposits
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('containers')}
              className="px-3.5 py-1.5 rounded-xl bg-white text-teal-900 hover:bg-teal-50 text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              Open Container Logistics →
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {containers.map(c => (
              <div key={c.id} className="bg-white/10 backdrop-blur-xs border border-white/15 p-3.5 rounded-xl">
                <span className="text-xs font-bold text-emerald-100 block truncate mb-1">{c.containerName}</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-white/70 block">Full Crates:</span>
                    <span className="text-base font-black text-white">{c.fullCrates}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/70 block">Empty Crates:</span>
                    <span className="text-base font-black text-amber-300">{c.emptyCrates}</span>
                  </div>
                </div>
                <div className="text-[10px] text-emerald-200 mt-2 pt-1 border-t border-white/10 flex justify-between">
                  <span>Deposit: {formatCurrency(c.depositPerCrate)}</span>
                  <span>{c.bottlesPerCrate} btls/crt</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 8.7 Recent Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-900">Recent Sales Transactions</h3>
            <p className="text-xs text-slate-500">Live operational ledger recorded on this machine</p>
          </div>
          <button
            onClick={() => onNavigate('sales')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
          >
            View Full Sales History →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left divide-y divide-slate-200">
            <thead className="bg-slate-50 font-bold text-slate-600 uppercase">
              <tr>
                <th className="py-3 px-4">Receipt #</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Payment Channel</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4 text-right">Amount Paid</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentSales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No sales recorded yet. Click "New Sale (POS)" to create your first transaction.
                  </td>
                </tr>
              ) : (
                recentSales.map(sale => (
                  <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {sale.receiptNumber}
                      {sale.isReversed && (
                        <span className="ml-1.5 px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 text-[10px] font-sans font-bold">
                          REVERSED
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {formatDateTime(sale.createdAt)}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {sale.customerName}
                    </td>
                    <td className="py-3 px-4">
                      <span className="capitalize font-medium text-slate-700">
                        {sale.paymentMethod === 'momo'
                          ? `MoMo (${sale.momoDetails?.network || 'Ghana'})`
                          : sale.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {formatCurrency(sale.totalAmount)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600">
                      {formatCurrency(sale.amountPaid)}
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
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => onOpenReceipt(sale)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg text-[11px] transition-colors cursor-pointer"
                      >
                        Receipt
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
