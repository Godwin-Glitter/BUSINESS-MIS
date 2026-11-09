import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { type Product, type ProductCategory, type ContainerType } from '../../types';
import { db, logAuditEvent } from '../../db';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  X,
  CheckCircle2,
  Boxes,
  Calendar,
  Layers
} from 'lucide-react';

export const ProductList: React.FC = () => {
  const { activeBusiness, currentUser } = useAuth();
  const { showToast } = useNotification();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [containers, setContainers] = useState<ContainerType[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('all');
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [codeSku, setCodeSku] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unit, setUnit] = useState('Pieces');
  const [purchasePrice, setPurchasePrice] = useState<number>(0);
  const [sellingPrice, setSellingPrice] = useState<number>(0);
  const [currentStock, setCurrentStock] = useState<number>(0);
  const [minStockLevel, setMinStockLevel] = useState<number>(10);
  // Drinks specific
  const [packagingConversionQty, setPackagingConversionQty] = useState<number>(24);
  const [cratePrice, setCratePrice] = useState<number>(0);
  const [packPrice, setPackPrice] = useState<number>(0);
  const [tracksCrate, setTracksCrate] = useState<boolean>(false);
  const [containerTypeId, setContainerTypeId] = useState<string>('');
  const [expiryDate, setExpiryDate] = useState<string>('');

  const isDrinks = activeBusiness === 'drinks';

  const loadData = async () => {
    setLoading(true);
    try {
      const prods = await db.products.where('businessId').equals(activeBusiness).toArray();
      setProducts(prods);

      const cats = await db.categories.where('businessId').equals(activeBusiness).toArray();
      setCategories(cats);

      if (isDrinks) {
        const conts = await db.containerTypes.where('businessId').equals('drinks').toArray();
        setContainers(conts);
      }
    } catch (err) {
      console.error('Error loading products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeBusiness]);

  const openCreateModal = () => {
    setEditingProduct(null);
    setName('');
    setBrand('');
    setCodeSku(`${isDrinks ? 'BEV' : 'BLD'}-${Date.now().toString().slice(-4)}`);
    setCategoryId(categories[0]?.id || '');
    setUnit(isDrinks ? 'Bottle' : 'Pieces');
    setPurchasePrice(0);
    setSellingPrice(0);
    setCurrentStock(0);
    setMinStockLevel(10);
    setPackagingConversionQty(24);
    setCratePrice(0);
    setPackPrice(0);
    setTracksCrate(isDrinks);
    setContainerTypeId(containers[0]?.id || '');
    setExpiryDate('');
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setBrand(p.brand || '');
    setCodeSku(p.codeSku);
    setCategoryId(p.categoryId);
    setUnit(p.unit);
    setPurchasePrice(p.purchasePrice);
    setSellingPrice(p.sellingPrice);
    setCurrentStock(p.currentStock);
    setMinStockLevel(p.minStockLevel);
    setPackagingConversionQty(p.packagingConversionQty || 24);
    setCratePrice(p.cratePrice || 0);
    setPackPrice(p.packPrice || 0);
    setTracksCrate(p.tracksCrate || false);
    setContainerTypeId(p.containerTypeId || '');
    setExpiryDate(p.expiryDate || '');
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !codeSku.trim() || !currentUser) {
      showToast('Please fill in product name and SKU.', 'warning');
      return;
    }

    try {
      const selectedCategoryObj = categories.find(c => c.id === categoryId);
      const catName = selectedCategoryObj ? selectedCategoryObj.name : 'General';
      const now = new Date().toISOString();

      if (editingProduct) {
        // Update
        await db.products.update(editingProduct.id, {
          name: name.trim(),
          brand: brand.trim(),
          codeSku: codeSku.trim(),
          categoryId,
          categoryName: catName,
          unit,
          purchasePrice: Number(purchasePrice),
          sellingPrice: Number(sellingPrice),
          minStockLevel: Number(minStockLevel),
          packagingConversionQty: isDrinks ? Number(packagingConversionQty) : undefined,
          cratePrice: isDrinks ? Number(cratePrice) : undefined,
          packPrice: isDrinks ? Number(packPrice) : undefined,
          tracksCrate: isDrinks ? tracksCrate : undefined,
          containerTypeId: isDrinks && tracksCrate ? containerTypeId : undefined,
          expiryDate: isDrinks ? expiryDate : undefined,
          updatedAt: now
        });

        await logAuditEvent(
          activeBusiness,
          'PRODUCT_EDITED',
          codeSku,
          `Product ${name} updated by ${currentUser.fullName}`,
          currentUser
        );
        showToast(`Product "${name}" updated successfully!`, 'success');
      } else {
        // Create new
        const newProduct: Product = {
          id: 'prod_' + Date.now(),
          businessId: activeBusiness,
          name: name.trim(),
          brand: brand.trim(),
          codeSku: codeSku.trim(),
          categoryId,
          categoryName: catName,
          unit,
          purchasePrice: Number(purchasePrice),
          sellingPrice: Number(sellingPrice),
          currentStock: Number(currentStock),
          minStockLevel: Number(minStockLevel),
          openingStock: Number(currentStock),
          packagingConversionQty: isDrinks ? Number(packagingConversionQty) : undefined,
          cratePrice: isDrinks ? Number(cratePrice) : undefined,
          packPrice: isDrinks ? Number(packPrice) : undefined,
          tracksCrate: isDrinks ? tracksCrate : undefined,
          containerTypeId: isDrinks && tracksCrate ? containerTypeId : undefined,
          expiryDate: isDrinks ? expiryDate : undefined,
          isActive: true,
          createdAt: now,
          updatedAt: now
        };

        await db.products.add(newProduct);

        await logAuditEvent(
          activeBusiness,
          'PRODUCT_CREATED',
          codeSku,
          `New product "${name}" added to catalog by ${currentUser.fullName}`,
          currentUser
        );
        showToast(`Product "${name}" created successfully!`, 'success');
      }

      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast(`Error saving product: ${err.message}`, 'error');
    }
  };

  const toggleProductStatus = async (product: Product) => {
    if (!currentUser) return;
    const newStatus = !product.isActive;
    await db.products.update(product.id, { isActive: newStatus });
    await logAuditEvent(
      activeBusiness,
      newStatus ? 'PRODUCT_ACTIVATED' : 'PRODUCT_DEACTIVATED',
      product.codeSku,
      `Product ${product.name} ${newStatus ? 'activated' : 'deactivated'}`,
      currentUser
    );
    showToast(`Product ${product.name} is now ${newStatus ? 'active' : 'inactive'}.`, 'info');
    loadData();
  };

  const filtered = products.filter(p => {
    const matchesCat = selectedCat === 'all' || p.categoryId === selectedCat;
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.codeSku.toLowerCase().includes(search.toLowerCase()) ||
      (p.brand && p.brand.toLowerCase().includes(search.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-5 pb-12 animate-fade-in">
      {/* Header & Controls */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
            {isDrinks ? 'Beverages & Soft Drinks Catalog' : 'Building Materials Product Registry'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage SKUs, wholesale/retail prices, packaging units, and stock thresholds.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Product</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by product name, brand, or SKU code..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-blue-600"
          />
        </div>

        <select
          value={selectedCat}
          onChange={e => setSelectedCat(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-blue-600"
        >
          <option value="all">All Categories ({products.length})</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left divide-y divide-slate-200">
            <thead className="bg-slate-50 font-bold text-slate-600 uppercase">
              <tr>
                <th className="py-3 px-4">SKU / Code</th>
                <th className="py-3 px-4">Product Name & Brand</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Cost Price</th>
                <th className="py-3 px-4 text-right">Selling Price</th>
                <th className="py-3 px-4 text-center">Current Stock</th>
                {isDrinks && <th className="py-3 px-4 text-center">Packaging / Crate</th>}
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">Loading catalog...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No products found matching filters.
                  </td>
                </tr>
              ) : (
                filtered.map(product => {
                  const isLow = product.currentStock <= product.minStockLevel;
                  const isOut = product.currentStock <= 0;

                  return (
                    <tr key={product.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        {product.codeSku}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block">{product.name}</span>
                        {product.brand && (
                          <span className="text-[11px] text-slate-500">{product.brand}</span>
                        )}
                        {product.expiryDate && (
                          <span className="text-[10px] text-amber-700 block font-medium">
                            Exp: {formatDate(product.expiryDate)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {product.categoryName}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600 font-medium">
                        {formatCurrency(product.purchasePrice)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatCurrency(product.sellingPrice)}
                        <span className="text-[10px] font-normal text-slate-500 block">
                          /{product.unit}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isOut
                              ? 'bg-rose-100 text-rose-800'
                              : isLow
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {product.currentStock} {product.unit}
                        </span>
                      </td>
                      {isDrinks && (
                        <td className="py-3 px-4 text-center text-slate-600">
                          {product.tracksCrate ? (
                            <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-800 font-semibold text-[11px]">
                              Crate ({product.packagingConversionQty} btls)
                            </span>
                          ) : product.packagingConversionQty ? (
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                              Pack ({product.packagingConversionQty} pcs)
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                      )}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => toggleProductStatus(product)}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition-colors ${
                            product.isActive
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {product.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => openEditModal(product)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-xl w-full my-8 overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Package className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-base">
                  {editingProduct ? 'Edit Product Details' : 'Add New Product to Catalog'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={isDrinks ? "e.g. Coca-Cola 300ml RGB" : "e.g. Ghacem Extra 42.5N Cement"}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:outline-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Brand / Manufacturer
                  </label>
                  <input
                    type="text"
                    value={brand}
                    onChange={e => setBrand(e.target.value)}
                    placeholder="e.g. Ghacem, Coca-Cola, Sentuo"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:outline-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Product SKU Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={codeSku}
                    onChange={e => setCodeSku(e.target.value)}
                    placeholder="e.g. CEM-001"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-medium focus:bg-white focus:outline-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Category *
                  </label>
                  <select
                    value={categoryId}
                    onChange={e => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:outline-blue-600"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Base Unit *
                  </label>
                  {isDrinks ? (
                    <select
                      value={unit}
                      onChange={e => setUnit(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:outline-blue-600"
                    >
                      <option value="Bottle">Bottle</option>
                      <option value="Can">Can</option>
                      <option value="Pack">Pack</option>
                      <option value="Crate">Crate</option>
                    </select>
                  ) : (
                    <select
                      value={unit}
                      onChange={e => setUnit(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:outline-blue-600"
                    >
                      <option value="Bags">Bags</option>
                      <option value="Pieces">Pieces</option>
                      <option value="Bundles">Bundles</option>
                      <option value="Lengths">Lengths</option>
                      <option value="Rolls">Rolls</option>
                      <option value="Boxes">Boxes</option>
                      <option value="Tonnes">Tonnes</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Pricing & Stock */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Cost Price (GH₵)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={purchasePrice}
                    onChange={e => setPurchasePrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Selling Price (GH₵)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={sellingPrice}
                    onChange={e => setSellingPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-emerald-700"
                  />
                </div>

                {!editingProduct && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Opening Stock
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={currentStock}
                      onChange={e => setCurrentStock(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Min Stock Alert
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={minStockLevel}
                    onChange={e => setMinStockLevel(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-amber-700"
                  />
                </div>
              </div>

              {/* Specific Drinks Packaging Conversions & Crate Management */}
              {isDrinks && (
                <div className="bg-teal-50 border border-teal-200 p-4 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                      <Boxes className="w-4 h-4 text-teal-700" />
                      Packaging Conversion & Crate Settings
                    </span>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-teal-900">
                      <input
                        type="checkbox"
                        checked={tracksCrate}
                        onChange={e => setTracksCrate(e.target.checked)}
                        className="rounded border-teal-300 text-teal-600"
                      />
                      <span>Tracks Glass Bottle Crate</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block font-medium text-teal-800 mb-1">
                        Bottles/Pcs per Crate/Pack:
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={packagingConversionQty}
                        onChange={e => setPackagingConversionQty(parseInt(e.target.value) || 24)}
                        className="w-full px-3 py-1.5 bg-white border border-teal-300 rounded-lg font-bold"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-teal-800 mb-1">
                        Wholesale Crate Price (GH₵):
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={cratePrice}
                        onChange={e => setCratePrice(parseFloat(e.target.value) || 0)}
                        placeholder="e.g. 110.00"
                        className="w-full px-3 py-1.5 bg-white border border-teal-300 rounded-lg font-bold text-teal-900"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-teal-800 mb-1">
                        Expiry Date (if applicable):
                      </label>
                      <input
                        type="date"
                        value={expiryDate}
                        onChange={e => setExpiryDate(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-teal-300 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Buttons */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
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
                  {editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
