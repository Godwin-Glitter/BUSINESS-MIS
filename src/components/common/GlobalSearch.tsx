import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../db';
import { type Product, type Customer, type Sale } from '../../types';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import {
  Search,
  X,
  Package,
  Users,
  Receipt,
  ArrowRight,
  AlertTriangle,
  CreditCard,
  ChevronRight,
  Sparkles,
  Command
} from 'lucide-react';

interface GlobalSearchProps {
  onNavigate?: (tab: string) => void;
  onOpenReceipt?: (sale: Sale) => void;
  onOpenStatement?: (customer: Customer) => void;
  onRecordPaymentForCustomer?: (customer: Customer) => void;
  className?: string;
}

type SearchCategory = 'all' | 'products' | 'customers' | 'sales';

export const GlobalSearch: React.FC<GlobalSearchProps> = ({
  onNavigate,
  onOpenReceipt,
  onOpenStatement,
  onRecordPaymentForCustomer,
  className = ''
}) => {
  const { activeBusiness } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<SearchCategory>('all');
  const [isLoading, setIsLoading] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);

  // For empty query quick-picks
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [debtorCustomers, setDebtorCustomers] = useState<Customer[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut Ctrl+K / Cmd+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Pre-load quick suggestions when opened with empty query
  useEffect(() => {
    if (!isOpen) return;

    async function loadQuickSuggestions() {
      try {
        const [recentSalesList, prods, custs] = await Promise.all([
          db.sales
            .where('businessId')
            .equals(activeBusiness)
            .reverse()
            .limit(3)
            .toArray(),
          db.products
            .where('businessId')
            .equals(activeBusiness)
            .filter(p => p.isActive && p.currentStock <= p.minStockLevel)
            .limit(3)
            .toArray(),
          db.customers
            .where('businessId')
            .equals(activeBusiness)
            .filter(c => c.outstandingDebt > 0)
            .limit(3)
            .toArray()
        ]);

        setRecentSales(recentSalesList);
        setLowStockProducts(prods);
        setDebtorCustomers(custs);
      } catch (err) {
        console.error('Error loading search quick suggestions:', err);
      }
    }

    loadQuickSuggestions();
  }, [isOpen, activeBusiness]);

  // Execute Search query across Products, Customers, and Sales
  useEffect(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      setProducts([]);
      setCustomers([]);
      setSales([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const [matchedProducts, matchedCustomers, matchedSales] = await Promise.all([
          // 1. Search Products
          db.products
            .where('businessId')
            .equals(activeBusiness)
            .filter(
              p =>
                Boolean(
                  p.isActive &&
                    (p.name.toLowerCase().includes(trimmed) ||
                      p.codeSku.toLowerCase().includes(trimmed) ||
                      (p.brand && p.brand.toLowerCase().includes(trimmed)) ||
                      (p.categoryName && p.categoryName.toLowerCase().includes(trimmed)))
                )
            )
            .limit(6)
            .toArray(),

          // 2. Search Customers
          db.customers
            .where('businessId')
            .equals(activeBusiness)
            .filter(
              c =>
                Boolean(
                  c.name.toLowerCase().includes(trimmed) ||
                    c.phone.toLowerCase().includes(trimmed) ||
                    (c.address && c.address.toLowerCase().includes(trimmed)) ||
                    (c.notes && c.notes.toLowerCase().includes(trimmed))
                )
            )
            .limit(6)
            .toArray(),

          // 3. Search Sales
          db.sales
            .where('businessId')
            .equals(activeBusiness)
            .filter(
              s =>
                Boolean(
                  s.receiptNumber.toLowerCase().includes(trimmed) ||
                    s.customerName.toLowerCase().includes(trimmed) ||
                    (s.customerPhone && s.customerPhone.toLowerCase().includes(trimmed)) ||
                    s.paymentMethod.toLowerCase().includes(trimmed) ||
                    (s.notes && s.notes.toLowerCase().includes(trimmed))
                )
            )
            .reverse()
            .limit(6)
            .toArray()
        ]);

        setProducts(matchedProducts);
        setCustomers(matchedCustomers);
        setSales(matchedSales);
      } catch (err) {
        console.error('Global search query error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 150);

    return () => clearTimeout(timeout);
  }, [query, activeBusiness]);

  const totalResultsCount = products.length + customers.length + sales.length;
  const hasQuery = query.trim().length > 0;

  // Actions when an item is clicked
  const handleSelectProduct = (product: Product) => {
    setIsOpen(false);
    setQuery('');
    if (onNavigate) {
      onNavigate('products');
    }
  };

  const handleSelectCustomer = (customer: Customer) => {
    setIsOpen(false);
    setQuery('');
    if (customer.outstandingDebt > 0 && onRecordPaymentForCustomer) {
      onRecordPaymentForCustomer(customer);
    } else if (onOpenStatement) {
      onOpenStatement(customer);
    } else if (onNavigate) {
      onNavigate('customers');
    }
  };

  const handleSelectSale = (sale: Sale) => {
    setIsOpen(false);
    setQuery('');
    if (onOpenReceipt) {
      onOpenReceipt(sale);
    } else if (onNavigate) {
      onNavigate('sales');
    }
  };

  const handleClear = () => {
    setQuery('');
    setProducts([]);
    setCustomers([]);
    setSales([]);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Search Input Bar */}
      <div className="relative flex items-center">
        <Search className="w-4 h-4 text-white/70 absolute left-3 pointer-events-none transition-colors group-focus-within:text-blue-600" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              setIsOpen(false);
              inputRef.current?.blur();
            } else if (e.key === 'Enter') {
              if (products.length > 0 && (activeCategory === 'all' || activeCategory === 'products')) {
                handleSelectProduct(products[0]);
              } else if (customers.length > 0 && (activeCategory === 'all' || activeCategory === 'customers')) {
                handleSelectCustomer(customers[0]);
              } else if (sales.length > 0 && (activeCategory === 'all' || activeCategory === 'sales')) {
                handleSelectSale(sales[0]);
              }
            }
          }}
          placeholder="Search products, customers, sales... (Ctrl+K)"
          className="w-full pl-9 pr-14 sm:pr-20 py-1.5 sm:py-2 text-xs font-medium rounded-xl bg-white/15 hover:bg-white/20 focus:bg-white text-white focus:text-slate-900 placeholder:text-white/70 focus:placeholder:text-slate-400 border border-white/20 focus:border-blue-500 focus:outline-hidden transition-all shadow-inner focus:shadow-lg"
        />

        <div className="absolute right-2 flex items-center gap-1">
          {query ? (
            <button
              onClick={handleClear}
              className="p-1 rounded-md text-white/70 hover:text-white focus:text-slate-600 hover:bg-white/20 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-medium text-white/70 bg-black/20 rounded border border-white/20">
              <Command className="w-2.5 h-2.5" />K
            </kbd>
          )}
        </div>
      </div>

      {/* Dropdown Results Card */}
      {isOpen && (
        <div className="absolute left-0 right-0 sm:w-[540px] mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 text-slate-900 overflow-hidden z-50 animate-fade-in max-h-[80vh] flex flex-col">
          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1 p-2 bg-slate-50 border-b border-slate-200 overflow-x-auto text-xs">
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                activeCategory === 'all'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              All {hasQuery && `(${totalResultsCount})`}
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('products')}
              className={`px-3 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeCategory === 'products'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Products {hasQuery && `(${products.length})`}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('customers')}
              className={`px-3 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeCategory === 'customers'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Customers {hasQuery && `(${customers.length})`}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('sales')}
              className={`px-3 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeCategory === 'sales'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Sales {hasQuery && `(${sales.length})`}</span>
            </button>
          </div>

          {/* Results List */}
          <div className="overflow-y-auto p-2 space-y-4 divide-y divide-slate-100 flex-1">
            {isLoading && (
              <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span>Searching application database...</span>
              </div>
            )}

            {/* Empty Query: Show Quick Shortcuts & Recent Activity */}
            {!hasQuery && !isLoading && (
              <div className="space-y-4 pt-1">
                <div className="text-[11px] font-bold uppercase text-slate-400 tracking-wider px-2">
                  Quick Access & Recent Activity
                </div>

                {/* Recent Sales Quick Access */}
                {recentSales.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-500 px-2 flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5 text-blue-600" />
                      Recent Sales
                    </span>
                    {recentSales.map(sale => (
                      <div
                        key={sale.id}
                        onClick={() => handleSelectSale(sale)}
                        className="p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 flex items-center justify-between cursor-pointer transition-all group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                            <Receipt className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-xs text-slate-900 group-hover:text-blue-600 block">
                              {sale.receiptNumber}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {sale.customerName} • {formatDateTime(sale.createdAt)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-xs text-slate-900 block">
                            {formatCurrency(sale.totalAmount)}
                          </span>
                          <span className="text-[10px] uppercase font-bold text-slate-400">
                            {sale.paymentMethod}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Low Stock Alerts */}
                {lowStockProducts.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <span className="text-[11px] font-bold text-amber-700 px-2 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      Low Stock Alerts
                    </span>
                    {lowStockProducts.map(p => (
                      <div
                        key={p.id}
                        onClick={() => handleSelectProduct(p)}
                        className="p-2.5 rounded-xl hover:bg-amber-50/60 border border-transparent hover:border-amber-200 flex items-center justify-between cursor-pointer transition-all group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                            <Package className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-xs text-slate-900 group-hover:text-amber-800 block">
                              {p.name}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              SKU: {p.codeSku} • {p.categoryName}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-xs text-amber-700 block">
                            {p.currentStock} {p.unit} remaining
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {formatCurrency(p.sellingPrice)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Debtors Quick Access */}
                {debtorCustomers.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <span className="text-[11px] font-bold text-rose-700 px-2 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-rose-600" />
                      Customers with Outstanding Debt
                    </span>
                    {debtorCustomers.map(c => (
                      <div
                        key={c.id}
                        onClick={() => handleSelectCustomer(c)}
                        className="p-2.5 rounded-xl hover:bg-rose-50/60 border border-transparent hover:border-rose-200 flex items-center justify-between cursor-pointer transition-all group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                            <Users className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-xs text-slate-900 group-hover:text-rose-800 block">
                              {c.name}
                            </span>
                            <span className="text-[11px] text-slate-500">{c.phone}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-xs text-rose-700 block">
                            Owes {formatCurrency(c.outstandingDebt)}
                          </span>
                          <span className="text-[10px] text-blue-600 font-semibold group-hover:underline">
                            Record Payment →
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Query Has Results */}
            {hasQuery && !isLoading && totalResultsCount > 0 && (
              <div className="space-y-4 pt-1">
                {/* Products Section */}
                {(activeCategory === 'all' || activeCategory === 'products') && products.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider px-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-blue-600" />
                        Products ({products.length})
                      </span>
                      <button
                        onClick={() => {
                          setIsOpen(false);
                          if (onNavigate) onNavigate('products');
                        }}
                        className="text-blue-600 hover:underline normal-case font-semibold cursor-pointer"
                      >
                        View All
                      </button>
                    </span>

                    {products.map(p => {
                      const isLow = p.currentStock <= p.minStockLevel;
                      const isOut = p.currentStock <= 0;
                      return (
                        <div
                          key={p.id}
                          onClick={() => handleSelectProduct(p)}
                          className="p-2.5 rounded-xl hover:bg-blue-50/60 border border-transparent hover:border-blue-200 flex items-center justify-between cursor-pointer transition-all group"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                              <Package className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="font-bold text-xs text-slate-900 group-hover:text-blue-600 block">
                                {p.name}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                {p.codeSku} • {p.categoryName} {p.brand ? `• ${p.brand}` : ''}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-xs text-slate-900 block">
                              {formatCurrency(p.sellingPrice)}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                isOut
                                  ? 'bg-rose-100 text-rose-800'
                                  : isLow
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {p.currentStock} {p.unit} in stock
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Customers Section */}
                {(activeCategory === 'all' || activeCategory === 'customers') && customers.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider px-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-teal-600" />
                        Customers ({customers.length})
                      </span>
                      <button
                        onClick={() => {
                          setIsOpen(false);
                          if (onNavigate) onNavigate('customers');
                        }}
                        className="text-teal-700 hover:underline normal-case font-semibold cursor-pointer"
                      >
                        View All
                      </button>
                    </span>

                    {customers.map(c => (
                      <div
                        key={c.id}
                        onClick={() => handleSelectCustomer(c)}
                        className="p-2.5 rounded-xl hover:bg-teal-50/60 border border-transparent hover:border-teal-200 flex items-center justify-between cursor-pointer transition-all group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                            <Users className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-xs text-slate-900 group-hover:text-teal-800 block">
                              {c.name}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {c.phone} {c.address ? `• ${c.address}` : ''}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          {c.outstandingDebt > 0 ? (
                            <span className="text-xs font-bold text-rose-700 block">
                              Debt: {formatCurrency(c.outstandingDebt)}
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-emerald-700 block">
                              Settled (No Debt)
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400">
                            Total: {formatCurrency(c.totalPurchased)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Recent Sales Section */}
                {(activeCategory === 'all' || activeCategory === 'sales') && sales.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider px-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Receipt className="w-3.5 h-3.5 text-blue-600" />
                        Recent Sales ({sales.length})
                      </span>
                      <button
                        onClick={() => {
                          setIsOpen(false);
                          if (onNavigate) onNavigate('sales');
                        }}
                        className="text-blue-600 hover:underline normal-case font-semibold cursor-pointer"
                      >
                        View All
                      </button>
                    </span>

                    {sales.map(s => (
                      <div
                        key={s.id}
                        onClick={() => handleSelectSale(s)}
                        className="p-2.5 rounded-xl hover:bg-blue-50/60 border border-transparent hover:border-blue-200 flex items-center justify-between cursor-pointer transition-all group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                            <Receipt className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-xs text-slate-900 group-hover:text-blue-600 block">
                              {s.receiptNumber}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {s.customerName} • {formatDateTime(s.createdAt)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-xs text-slate-900 block">
                            {formatCurrency(s.totalAmount)}
                          </span>
                          <span className="text-[10px] uppercase font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                            {s.paymentMethod} • Click to View Receipt
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* No Results Found */}
            {hasQuery && !isLoading && totalResultsCount === 0 && (
              <div className="p-8 text-center text-slate-500 text-xs space-y-2">
                <Search className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-bold text-slate-700 text-sm">No matches found for "{query}"</p>
                <p className="text-slate-400">
                  Try searching by product SKU, product name, customer phone number, or receipt number.
                </p>
              </div>
            )}
          </div>

          {/* Footer Shortcuts hint */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white rounded border border-slate-300 shadow-2xs">ESC</kbd> to close
            </span>
            <span className="flex items-center gap-1">
              Click any result to view details or print receipt
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
