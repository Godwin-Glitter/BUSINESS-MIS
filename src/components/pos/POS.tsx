import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { type Product, type Customer, type SaleItem, type PaymentMethod, type Sale, type ContainerType, type ContainerTransaction, type BusinessProfile } from '../../types';
import { db, executeSaleTransaction } from '../../db';
import { formatCurrency, formatDateTime, generateReceiptNumber } from '../../utils/formatters';
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  User,
  CreditCard,
  Banknote,
  Smartphone,
  Building,
  CheckCircle2,
  Boxes,
  Sparkles,
  AlertCircle,
  Printer
} from 'lucide-react';

interface POSProps {
  onSaleComplete: (sale: Sale) => void;
  isReceiptOpen?: boolean;
}

export const POS: React.FC<POSProps> = ({ onSaleComplete, isReceiptOpen = false }) => {
  const { activeBusiness, currentUser } = useAuth();
  const { showToast } = useNotification();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [walkInName, setWalkInName] = useState('Walk-in Customer');
  const [lastCompletedSale, setLastCompletedSale] = useState<Sale | null>(null);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);

  // Containers (for Soft Drinks)
  const [containers, setContainers] = useState<ContainerType[]>([]);

  // Cart
  interface CartItem extends SaleItem {
    stockAvailable: number;
    packagingConversionQty?: number;
    tracksCrate?: boolean;
    containerTypeId?: string;
  }
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState<number>(0);

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [momoNetwork, setMomoNetwork] = useState<'MTN MoMo' | 'Telecel Cash' | 'AirtelTigo Money'>('MTN MoMo');
  const [momoReference, setMomoReference] = useState('');
  const [amountPaidInput, setAmountPaidInput] = useState<string>('');
  const [creditDueDate, setCreditDueDate] = useState<string>('');
  const [notes, setNotes] = useState('');

  // Soft Drinks empty crate return handling in cart
  const [cratesReturnedInput, setCratesReturnedInput] = useState<{ [containerId: string]: number }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDrinks = activeBusiness === 'drinks';
  const isBuilding = activeBusiness === 'building';

  // Load products, categories, customers
  useEffect(() => {
    async function loadPOSData() {
      try {
        const prods = await db.products
          .where('businessId')
          .equals(activeBusiness)
          .filter(p => p.isActive)
          .toArray();
        setProducts(prods);

        const cats = await db.categories.where('businessId').equals(activeBusiness).toArray();
        setCategories(cats);

        const custs = await db.customers.where('businessId').equals(activeBusiness).toArray();
        setCustomers(custs);

        const prof = await db.businessProfiles.get(activeBusiness);
        if (prof) setProfile(prof);

        if (isDrinks) {
          const conts = await db.containerTypes.where('businessId').equals('drinks').toArray();
          setContainers(conts);
        }
      } catch (err) {
        console.error('POS data loading error:', err);
      }
    }
    loadPOSData();
  }, [activeBusiness, isDrinks]);

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCategory === 'all' || p.categoryId === selectedCategory;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.codeSku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.brand && p.brand.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  // Add to cart helper
  const addToCart = (product: Product, unitType: 'crate' | 'bottle' | 'pack' | 'standard' = 'standard') => {
    setCart(prev => {
      const cartKey = `${product.id}_${unitType}`;
      const existingIndex = prev.findIndex(item => `${item.productId}_${item.unitType || 'standard'}` === cartKey);

      let price = product.sellingPrice;
      let unitLabel = product.unit;
      let cost = product.purchasePrice;

      if (isDrinks) {
        if (unitType === 'crate') {
          price = product.cratePrice || product.sellingPrice * (product.packagingConversionQty || 24);
          cost = product.purchasePrice * (product.packagingConversionQty || 24);
          unitLabel = 'Crate (24 btls)';
        } else if (unitType === 'pack') {
          price = product.packPrice || product.sellingPrice;
          unitLabel = `Pack (${product.packagingConversionQty || 12})`;
        } else if (unitType === 'bottle') {
          price = product.sellingPrice;
          unitLabel = 'Single Bottle';
        }
      }

      if (existingIndex > -1) {
        const copy = [...prev];
        const newQty = copy[existingIndex].quantity + 1;
        copy[existingIndex].quantity = newQty;
        copy[existingIndex].total = newQty * copy[existingIndex].unitPrice;
        return copy;
      } else {
        return [
          ...prev,
          {
            productId: product.id,
            productName: product.name,
            unit: unitLabel,
            unitType,
            quantity: 1,
            unitPrice: price,
            costPrice: cost,
            total: price,
            stockAvailable: product.currentStock,
            packagingConversionQty: product.packagingConversionQty,
            tracksCrate: product.tracksCrate,
            containerTypeId: product.containerTypeId
          }
        ];
      }
    });
  };

  const updateCartQuantity = (index: number, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(index);
      return;
    }
    setCart(prev => {
      const copy = [...prev];
      copy[index].quantity = newQty;
      copy[index].total = newQty * copy[index].unitPrice;
      return copy;
    });
  };

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountAmount(0);
    setAmountPaidInput('');
    setNotes('');
    setCratesReturnedInput({});
  };

  // Subtotal & Totals
  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);

  // Soft Drinks Crate logistics in cart
  let totalCratesIssued = 0;
  let containerTransactions: ContainerTransaction[] = [];

  if (isDrinks) {
    const crateCountsByContainer: { [contId: string]: number } = {};

    cart.forEach(item => {
      if (item.unitType === 'crate' && item.containerTypeId) {
        crateCountsByContainer[item.containerTypeId] =
          (crateCountsByContainer[item.containerTypeId] || 0) + item.quantity;
        totalCratesIssued += item.quantity;
      }
    });

    for (const [contId, issued] of Object.entries(crateCountsByContainer)) {
      const cont = containers.find(c => c.id === contId);
      if (cont) {
        const returned = cratesReturnedInput[contId] || 0;
        const netOwed = Math.max(0, issued - returned);
        const netCharge = netOwed * cont.depositPerCrate;

        containerTransactions.push({
          containerId: cont.id,
          containerName: cont.containerName,
          issuedCrates: issued,
          returnedCrates: returned,
          depositPerCrate: cont.depositPerCrate,
          netDepositCharge: netCharge
        });
      }
    }
  }

  const containerDepositsTotal = containerTransactions.reduce(
    (sum, ct) => sum + ct.netDepositCharge,
    0
  );
  const totalPayable = Math.max(0, subtotal - discountAmount + containerDepositsTotal);

  // Amount paid computation
  const parsedPaid = amountPaidInput !== '' ? Number(amountPaidInput) : (paymentMethod === 'credit' ? 0 : totalPayable);
  const outstandingBalance = Math.max(0, totalPayable - parsedPaid);

  // Submit sale transaction
  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      showToast('Cannot complete sale: Cart is empty.', 'warning');
      return;
    }

    if (!currentUser) return;

    if (paymentMethod === 'credit' && !selectedCustomerId) {
      showToast('Please select a registered customer for credit sales to track debts.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
      const customerName = selectedCustomer ? selectedCustomer.name : walkInName;
      const receiptNumber = generateReceiptNumber(isBuilding ? 'BLD' : 'DRK');

      let status: 'completed' | 'credit' | 'partially_paid' = 'completed';
      if (outstandingBalance > 0) {
        status = parsedPaid > 0 ? 'partially_paid' : 'credit';
      }

      const saleRecord = await executeSaleTransaction(
        {
          businessId: activeBusiness,
          receiptNumber,
          customerId: selectedCustomerId || undefined,
          customerName,
          customerPhone: selectedCustomer?.phone,
          subtotal,
          discount: discountAmount,
          totalAmount: totalPayable,
          amountPaid: parsedPaid,
          outstandingBalance,
          paymentMethod,
          momoDetails:
            paymentMethod === 'momo'
              ? {
                  network: momoNetwork,
                  reference: momoReference || `REF-${Date.now().toString().slice(-6)}`
                }
              : undefined,
          status,
          dueDate: paymentMethod === 'credit' || outstandingBalance > 0 ? creditDueDate : undefined,
          items: cart.map(i => ({
            productId: i.productId,
            productName: i.productName,
            unit: i.unit,
            unitType: i.unitType,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            costPrice: i.costPrice,
            total: i.total,
            bottlesCount:
              isDrinks && i.unitType === 'crate' && i.packagingConversionQty
                ? i.quantity * i.packagingConversionQty
                : undefined
          })),
          containerTransactions: isDrinks ? containerTransactions : undefined,
          notes,
          recordedByUserId: currentUser.id,
          recordedByUserName: currentUser.fullName
        },
        currentUser
      );

      showToast(`Sale #${receiptNumber} completed successfully for ${customerName}!`, 'success');
      setLastCompletedSale(saleRecord);
      clearCart();
      onSaleComplete(saleRecord);
    } catch (err: any) {
      console.error('Error completing sale:', err);
      showToast(`Transaction failed: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Dedicated Print handler that specifically targets #receipt-print-area and invokes window.print()
  const handlePrint = () => {
    const printArea = document.getElementById('receipt-print-area');
    if (!printArea) {
      console.warn('Target #receipt-print-area element was not found in the DOM.');
    }
    window.print();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12 animate-fade-in">
      {/* Left 7 Columns: Product Selection Catalog */}
      <div className="lg:col-span-7 space-y-4">
        {/* Search & Category Filter */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={isBuilding ? "Search cement, iron rods, roofing, nails, paints..." : "Search Coca-Cola, Fanta, Malta, bottled water..."}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-blue-600"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === 'all'
                  ? isBuilding
                    ? 'bg-[#142D4E] text-white shadow-xs'
                    : 'bg-[#0D9488] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Categories
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? isBuilding
                      ? 'bg-[#142D4E] text-white shadow-xs'
                      : 'bg-[#0D9488] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {filteredProducts.map(product => {
            const isLow = product.currentStock <= product.minStockLevel;
            const isOut = product.currentStock <= 0;

            return (
              <div
                key={product.id}
                className="bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-xs transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start gap-1 mb-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {product.codeSku}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        isOut
                          ? 'bg-rose-100 text-rose-800'
                          : isLow
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {product.currentStock} {product.unit}
                    </span>
                  </div>
                  <h4 className="font-bold text-xs text-slate-900 line-clamp-2 mb-1">{product.name}</h4>
                  {product.brand && (
                    <span className="text-[11px] text-slate-500 block mb-2">{product.brand}</span>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100">
                  {/* For Soft Drinks with Crate / Pack Options */}
                  {isDrinks && product.tracksCrate ? (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold text-slate-900">
                        <span>Crate: {formatCurrency(product.cratePrice || product.sellingPrice * 24)}</span>
                        <span>Btl: {formatCurrency(product.sellingPrice)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          onClick={() => addToCart(product, 'crate')}
                          className="py-1 px-2 bg-teal-50 hover:bg-teal-600 hover:text-white border border-teal-200 text-teal-800 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          + 1 Crate
                        </button>
                        <button
                          onClick={() => addToCart(product, 'bottle')}
                          className="py-1 px-2 bg-slate-50 hover:bg-slate-800 hover:text-white border border-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer"
                        >
                          + Bottle
                        </button>
                      </div>
                    </div>
                  ) : isDrinks && product.packagingConversionQty ? (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold text-slate-900">
                        <span>Pack: {formatCurrency(product.packPrice || product.sellingPrice)}</span>
                      </div>
                      <button
                        onClick={() => addToCart(product, 'pack')}
                        className="w-full py-1.5 px-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        Add Pack ({product.packagingConversionQty} pcs)
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="font-black text-sm text-slate-900">
                        {formatCurrency(product.sellingPrice)}
                        <span className="text-[10px] font-normal text-slate-500 block">per {product.unit}</span>
                      </span>
                      <button
                        onClick={() => addToCart(product, 'standard')}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right 5 Columns: Active POS Cart, Customer & Checkout */}
      <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        {/* Cart Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-sm text-slate-900">Active Sale Order</h3>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
              {cart.length} item{cart.length !== 1 ? 's' : ''}
            </span>
          </div>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
            >
              Clear Cart
            </button>
          )}
        </div>

        {/* Recent Completed Sale Quick Actions */}
        {lastCompletedSale && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs animate-fade-in print:hidden">
            <div>
              <span className="font-bold text-emerald-900 block">
                Recent Sale: #{lastCompletedSale.receiptNumber}
              </span>
              <span className="text-emerald-700 text-[11px]">
                {lastCompletedSale.customerName} • {formatCurrency(lastCompletedSale.totalAmount)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onSaleComplete(lastCompletedSale)}
                className="px-2.5 py-1 text-emerald-800 hover:bg-emerald-100 rounded-lg text-xs font-semibold cursor-pointer"
              >
                View
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs cursor-pointer"
                title="Print receipt targeting #receipt-print-area"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
            </div>
          </div>
        )}

        {/* Customer Select */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            Customer
          </label>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={selectedCustomerId}
              onChange={e => setSelectedCustomerId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-blue-600"
            >
              <option value="">Walk-in Cash Counter</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.outstandingDebt > 0 ? `(Owes ${formatCurrency(c.outstandingDebt)})` : ''}
                </option>
              ))}
            </select>

            {!selectedCustomerId ? (
              <input
                type="text"
                value={walkInName}
                onChange={e => setWalkInName(e.target.value)}
                placeholder="Walk-in name / Phone"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-blue-600"
              />
            ) : (
              <div className="px-3 py-2 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 font-semibold flex items-center justify-between">
                <span>Account Verified</span>
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
              </div>
            )}
          </div>
        </div>

        {/* Cart Items List */}
        <div className="max-h-60 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
          {cart.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <span>Cart is currently empty. Click products on the left to add items.</span>
            </div>
          ) : (
            cart.map((item, index) => (
              <div key={index} className="pt-2 flex items-center justify-between gap-2 text-xs">
                <div className="flex-1 truncate">
                  <span className="font-bold text-slate-900 block truncate">{item.productName}</span>
                  <span className="text-[11px] text-slate-500">
                    {formatCurrency(item.unitPrice)} • {item.unit}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => updateCartQuantity(index, item.quantity - 1)}
                    className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold cursor-pointer"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-8 text-center font-bold text-slate-900">{item.quantity}</span>
                  <button
                    onClick={() => updateCartQuantity(index, item.quantity + 1)}
                    className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                <div className="text-right shrink-0 w-20">
                  <span className="font-bold text-slate-900 block">{formatCurrency(item.total)}</span>
                  <button
                    onClick={() => removeFromCart(index)}
                    className="text-[10px] text-rose-500 hover:text-rose-700 cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Soft Drinks Container Deposit Check */}
        {isDrinks && totalCratesIssued > 0 && (
          <div className="bg-teal-50 border border-teal-200 p-3 rounded-xl space-y-2 text-xs">
            <div className="flex items-center justify-between text-teal-900 font-bold">
              <div className="flex items-center gap-1.5">
                <Boxes className="w-4 h-4 text-teal-700" />
                <span>Empty Crate Exchange Logistics</span>
              </div>
              <span>{totalCratesIssued} Crates Issued</span>
            </div>
            <p className="text-[11px] text-teal-800">
              Did customer bring back empty crates right now? Enter returned crates to waive deposit:
            </p>
            {containerTransactions.map(ct => (
              <div key={ct.containerId} className="flex items-center justify-between gap-2 pt-1">
                <span className="truncate text-teal-900 font-medium">{ct.containerName}:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max={ct.issuedCrates + 50}
                    value={cratesReturnedInput[ct.containerId] ?? ct.issuedCrates}
                    onChange={e =>
                      setCratesReturnedInput(prev => ({
                        ...prev,
                        [ct.containerId]: Math.max(0, parseInt(e.target.value) || 0)
                      }))
                    }
                    className="w-16 px-2 py-1 bg-white border border-teal-300 rounded text-center font-bold text-xs"
                  />
                  <span className="text-[11px] text-teal-700">returned</span>
                </div>
              </div>
            ))}
            {containerDepositsTotal > 0 && (
              <div className="pt-1 border-t border-teal-200 text-right text-teal-900 font-bold">
                Net Crate Deposit Charged: {formatCurrency(containerDepositsTotal)}
              </div>
            )}
          </div>
        )}

        {/* Subtotal, Discount & Total Calculation - Dedicated POS Sales Summary View */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs">
          <div className="flex justify-between items-center pb-2 border-b border-slate-200">
            <span className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <span>Sales Summary</span>
            </span>
            {/* Dedicated Print button that invokes window.print() targeting #receipt-print-area */}
            <button
              type="button"
              onClick={handlePrint}
              disabled={cart.length === 0 && !lastCompletedSale}
              aria-label="Print sales summary"
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer disabled:cursor-not-allowed print:hidden"
              title="Print sales summary / receipt (targets #receipt-print-area)"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
          </div>

          <div className="flex justify-between text-slate-600">
            <span>Subtotal:</span>
            <span className="font-bold text-slate-900">{formatCurrency(subtotal)}</span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-600">Special Discount (GH₵):</span>
            <input
              type="number"
              min="0"
              value={discountAmount || ''}
              onChange={e => setDiscountAmount(Math.max(0, parseFloat(e.target.value) || 0))}
              placeholder="0.00"
              className="w-24 px-2 py-1 bg-white border border-slate-300 rounded-lg text-right font-bold text-emerald-600 text-xs focus:outline-blue-600"
            />
          </div>

          {containerDepositsTotal > 0 && (
            <div className="flex justify-between text-teal-800">
              <span>Crate Container Deposits:</span>
              <span className="font-bold">+{formatCurrency(containerDepositsTotal)}</span>
            </div>
          )}

          <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm">
            <span className="font-extrabold text-slate-900 uppercase">Final Total Payable:</span>
            <span className="text-lg font-black text-slate-900">{formatCurrency(totalPayable)}</span>
          </div>
        </div>

        {/* Payment Channel Selector */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            Payment Method
          </label>
          <div className="grid grid-cols-4 gap-1.5 text-xs">
            {(['cash', 'momo', 'bank', 'credit'] as const).map(method => (
              <button
                key={method}
                type="button"
                onClick={() => {
                  setPaymentMethod(method);
                  if (method === 'credit') setAmountPaidInput('0');
                  else if (method === 'cash') setAmountPaidInput(totalPayable.toString());
                }}
                className={`py-2 px-1 rounded-xl font-bold uppercase transition-all cursor-pointer text-center ${
                  paymentMethod === method
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {method === 'momo' ? 'MoMo' : method}
              </button>
            ))}
          </div>

          {/* MoMo Network & Reference */}
          {paymentMethod === 'momo' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-xs animate-fade-in">
              <span className="font-bold text-amber-900 block">Ghana Mobile Money Details</span>
              <div className="grid grid-cols-3 gap-1.5">
                {(['MTN MoMo', 'Telecel Cash', 'AirtelTigo Money'] as const).map(net => (
                  <button
                    key={net}
                    type="button"
                    onClick={() => setMomoNetwork(net)}
                    className={`py-1.5 px-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      momoNetwork === net
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-white border border-amber-200 text-amber-900'
                    }`}
                  >
                    {net.split(' ')[0]}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={momoReference}
                onChange={e => setMomoReference(e.target.value)}
                placeholder="MoMo Transaction ID / Reference (optional)"
                className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs"
              />
            </div>
          )}

          {/* Credit Sale Due Date */}
          {paymentMethod === 'credit' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2 text-xs animate-fade-in">
              <span className="font-bold text-blue-900 block">Credit Terms & Due Date</span>
              <input
                type="date"
                value={creditDueDate}
                onChange={e => setCreditDueDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-xs"
              />
              <span className="text-[11px] text-blue-700 block">
                Full sale amount will be recorded as revenue and added to customer's outstanding debt balance.
              </span>
            </div>
          )}

          {/* Amount Paid input (Supports partial payments) */}
          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Amount Paid Now (GH₵):
              </label>
              <input
                type="number"
                min="0"
                max={totalPayable}
                value={amountPaidInput}
                onChange={e => setAmountPaidInput(e.target.value)}
                placeholder={paymentMethod === 'credit' ? '0.00' : totalPayable.toString()}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-emerald-700 focus:bg-white focus:outline-blue-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Remaining Balance (Debt):
              </label>
              <div className={`px-3 py-2 rounded-xl font-extrabold border ${
                outstandingBalance > 0
                  ? 'bg-amber-50 border-amber-300 text-amber-800'
                  : 'bg-slate-100 border-slate-200 text-slate-800'
              }`}>
                {formatCurrency(outstandingBalance)}
              </div>
            </div>
          </div>
        </div>

        {/* Checkout Button */}
        <button
          onClick={handleCompleteSale}
          disabled={isSubmitting || cart.length === 0}
          className={`w-full py-3.5 rounded-xl font-bold text-white shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
            isDrinks
              ? 'bg-teal-600 hover:bg-teal-700'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isSubmitting ? (
            <span>Processing Order...</span>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              <span>Complete Sale ({formatCurrency(totalPayable)})</span>
            </>
          )}
        </button>
      </div>

      {/* Dedicated Printable Area for POS Sales Summary specifically targeting #receipt-print-area ID */}
      {!isReceiptOpen && (
        <div
          id="receipt-print-area"
          className="hidden print:block p-6 sm:p-8 bg-white text-slate-900 font-mono text-sm leading-relaxed"
        >
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
              <span className="text-slate-500 block">Receipt / Order No:</span>
              <span className="font-bold text-slate-900">
                {lastCompletedSale?.receiptNumber || 'POS-SALES-SUMMARY'}
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block">Date & Time:</span>
              <span className="font-medium text-slate-800">
                {formatDateTime(lastCompletedSale?.createdAt || new Date().toISOString())}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Customer:</span>
              <span className="font-bold text-slate-900">
                {lastCompletedSale?.customerName || (selectedCustomerId ? customers.find(c => c.id === selectedCustomerId)?.name : walkInName) || 'Walk-in Customer'}
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block">Cashier / User:</span>
              <span className="font-medium text-slate-800">
                {lastCompletedSale?.recordedByUserName || currentUser?.fullName || 'Cashier'}
              </span>
            </div>
          </div>

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
                {(lastCompletedSale ? lastCompletedSale.items : cart).map((it, idx) => (
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

          {/* Financial Breakdown */}
          <div className="space-y-1.5 text-xs text-right border-b border-dashed border-slate-300 pb-3 mb-3">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-semibold text-slate-900">
                {formatCurrency(lastCompletedSale ? lastCompletedSale.subtotal : subtotal)}
              </span>
            </div>
            {(lastCompletedSale ? lastCompletedSale.discount : discountAmount) > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Discount Applied:</span>
                <span className="font-semibold">
                  -{formatCurrency(lastCompletedSale ? lastCompletedSale.discount : discountAmount)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold text-slate-900 pt-1 border-t border-slate-200">
              <span>Total Payable:</span>
              <span>
                {formatCurrency(lastCompletedSale ? lastCompletedSale.totalAmount : totalPayable)}
              </span>
            </div>
            <div className="flex justify-between text-slate-800 pt-1">
              <span>Amount Paid:</span>
              <span className="font-bold text-emerald-700">
                {formatCurrency(lastCompletedSale ? lastCompletedSale.amountPaid : (parseFloat(amountPaidInput) || (paymentMethod === 'credit' ? 0 : totalPayable)))}
              </span>
            </div>
            {((lastCompletedSale ? lastCompletedSale.outstandingBalance : outstandingBalance) > 0) && (
              <div className="flex justify-between text-amber-700 font-bold bg-amber-50 p-1.5 rounded">
                <span>Outstanding Balance (Credit):</span>
                <span>{formatCurrency(lastCompletedSale ? lastCompletedSale.outstandingBalance : outstandingBalance)}</span>
              </div>
            )}
          </div>

          {/* Payment Method Details */}
          <div className="text-xs text-slate-600 mb-4">
            <p>
              <strong className="text-slate-800">Payment Method:</strong> {(lastCompletedSale?.paymentMethod || paymentMethod).toUpperCase()}
              {lastCompletedSale?.momoDetails && ` (${lastCompletedSale.momoDetails.network} - Ref: ${lastCompletedSale.momoDetails.reference})`}
            </p>
          </div>

          {/* Footer */}
          <div className="text-center text-[11px] text-slate-500 font-sans border-t border-slate-200 pt-3">
            <p className="font-medium text-slate-700">
              {profile?.receiptNotes || 'Thank you for your business! Goods sold in good condition.'}
            </p>
            <p className="mt-1 text-[10px] text-slate-400">
              Powered by IBMS Ghana • Offline Local Business Management System
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
