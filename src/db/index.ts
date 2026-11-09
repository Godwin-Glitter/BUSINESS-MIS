import Dexie, { type Table } from 'dexie';
import {
  type User,
  type BusinessProfile,
  type ProductCategory,
  type Product,
  type InventoryMovement,
  type Customer,
  type Supplier,
  type Sale,
  type CustomerPayment,
  type Purchase,
  type SupplierPayment,
  type Expense,
  type ContainerType,
  type ContainerMovement,
  type CustomerContainerBalance,
  type AuditLog,
  type AppSettings,
  type BackupRecord,
  type BusinessId,
  type FinancialSummary
} from '../types';

export class IBMSDatabase extends Dexie {
  users!: Table<User, string>;
  businessProfiles!: Table<BusinessProfile, string>;
  categories!: Table<ProductCategory, string>;
  products!: Table<Product, string>;
  inventoryMovements!: Table<InventoryMovement, string>;
  customers!: Table<Customer, string>;
  suppliers!: Table<Supplier, string>;
  sales!: Table<Sale, string>;
  customerPayments!: Table<CustomerPayment, string>;
  purchases!: Table<Purchase, string>;
  supplierPayments!: Table<SupplierPayment, string>;
  expenses!: Table<Expense, string>;
  containerTypes!: Table<ContainerType, string>;
  containerMovements!: Table<ContainerMovement, string>;
  customerContainerBalances!: Table<CustomerContainerBalance, string>;
  auditLogs!: Table<AuditLog, string>;
  appSettings!: Table<AppSettings, string>;
  backupHistory!: Table<BackupRecord, string>;

  constructor() {
    super('IBMS_Ghana_DB');
    this.version(1).stores({
      users: 'id, username, assignedBusiness, role, status, createdAt',
      businessProfiles: 'id, updatedAt',
      categories: 'id, businessId, name',
      products: 'id, businessId, codeSku, categoryId, isActive, currentStock, minStockLevel, [businessId+isActive]',
      inventoryMovements: 'id, businessId, productId, type, referenceId, createdAt, [businessId+productId]',
      customers: 'id, businessId, name, phone, outstandingDebt, [businessId+outstandingDebt]',
      suppliers: 'id, businessId, name, phone, outstandingBalance',
      sales: 'id, businessId, receiptNumber, customerId, status, paymentMethod, isReversed, createdAt, [businessId+createdAt], [businessId+status]',
      customerPayments: 'id, businessId, receiptNumber, customerId, saleId, createdAt, [businessId+createdAt]',
      purchases: 'id, businessId, purchaseInvoiceNumber, supplierId, status, isReversed, createdAt, [businessId+createdAt]',
      supplierPayments: 'id, businessId, supplierId, purchaseId, createdAt, [businessId+createdAt]',
      expenses: 'id, businessId, category, date, createdAt, [businessId+date]',
      containerTypes: 'id, businessId',
      containerMovements: 'id, businessId, containerId, customerId, movementType, createdAt',
      customerContainerBalances: 'id, businessId, customerId, containerId, [customerId+containerId]',
      auditLogs: 'id, businessId, action, userId, timestamp, [businessId+timestamp]',
      appSettings: 'id',
      backupHistory: 'id, date, status'
    });
  }
}

export const db = new IBMSDatabase();

// --------------------------------------------------------------------------------
// AUDIT LOG HELPER
// --------------------------------------------------------------------------------
export async function logAuditEvent(
  businessId: BusinessId | 'system',
  action: string,
  recordReference: string,
  description: string,
  user: { id: string; fullName: string; role: any },
  details?: Record<string, unknown>
) {
  try {
    await db.auditLogs.add({
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      businessId,
      action,
      recordReference,
      description,
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      timestamp: new Date().toISOString(),
      details
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

// --------------------------------------------------------------------------------
// INITIAL SEEDING & SETUP
// --------------------------------------------------------------------------------
export async function isSystemInitialized(): Promise<boolean> {
  const usersCount = await db.users.count();
  return usersCount > 0;
}

export async function initializeAppSettings(): Promise<AppSettings> {
  let settings = await db.appSettings.get('global_settings');
  if (!settings) {
    settings = {
      id: 'global_settings',
      backupReminderTime: '17:00', // 5:00 PM Africa/Accra
      backupReminderEnabled: true,
      currencySymbol: 'GH₵',
      timezone: 'Africa/Accra',
      buildingBusinessName: 'Akwaaba Building Materials Supply',
      drinksBusinessName: 'Oasis Soft Drinks & Minerals Depot'
    };
    await db.appSettings.put(settings);
  }
  return settings;
}

export async function seedDefaultProfiles(): Promise<void> {
  const buildingProfile: BusinessProfile = {
    id: 'building',
    name: 'Akwaaba Building Materials Supply',
    tagline: 'Quality Construction, Cement, Iron Rods & Hardware',
    address: 'Plot 42, Spintex Road, Near Papaye, Accra, Ghana',
    phone: '024 456 7890 / 055 311 2233',
    email: 'info@akwaababuilding.com.gh',
    tinNumber: 'P002345678X',
    currency: 'GH₵',
    receiptNotes: 'Goods once sold and delivered in good condition are not returnable after 48 hours.',
    updatedAt: new Date().toISOString()
  };

  const drinksProfile: BusinessProfile = {
    id: 'drinks',
    name: 'Oasis Soft Drinks & Minerals Depot',
    tagline: 'Wholesale & Retail Beverage Depot & Container Logistics',
    address: 'Kaneshie High Street, Opposite Market Gate 3, Accra, Ghana',
    phone: '020 844 5566 / 024 399 8877',
    email: 'sales@oasisdrinks.com.gh',
    tinNumber: 'P009876543Y',
    currency: 'GH₵',
    receiptNotes: 'Empty crates & bottles remain depot property until returned or deposit forfeited.',
    updatedAt: new Date().toISOString()
  };

  await db.businessProfiles.put(buildingProfile);
  await db.businessProfiles.put(drinksProfile);
}

export async function seedSampleOperationalData(adminUser: { id: string; fullName: string; role: any }) {
  // Categories
  const bldCategories = [
    { id: 'cat_bld_1', businessId: 'building' as BusinessId, name: 'Cement & Bonding', description: 'Portland & bagged cements' },
    { id: 'cat_bld_2', businessId: 'building' as BusinessId, name: 'Iron Rods & Steel', description: 'High tensile reinforcement rods' },
    { id: 'cat_bld_3', businessId: 'building' as BusinessId, name: 'Roofing & Sheets', description: 'Corrugated aluminum & zinc sheets' },
    { id: 'cat_bld_4', businessId: 'building' as BusinessId, name: 'Nails & Fasteners', description: 'Wire nails, roofing nails, screws' },
    { id: 'cat_bld_5', businessId: 'building' as BusinessId, name: 'Paints & Finishes', description: 'Emulsion, gloss, textured paints' },
    { id: 'cat_bld_6', businessId: 'building' as BusinessId, name: 'Plumbing & Pipes', description: 'PVC pipes, fittings, valves' },
    { id: 'cat_bld_7', businessId: 'building' as BusinessId, name: 'Electricals', description: 'Cables, breakers, switches, conduit' },
    { id: 'cat_bld_8', businessId: 'building' as BusinessId, name: 'Blocks & Sand', description: 'Hollow blocks, solid blocks' },
    { id: 'cat_bld_9', businessId: 'building' as BusinessId, name: 'Tiles & Adhesives', description: 'Floor tiles, wall tiles, tile cement' }
  ];

  const drkCategories = [
    { id: 'cat_drk_1', businessId: 'drinks' as BusinessId, name: 'Carbonated Soft Drinks', description: 'Coca-Cola, Fanta, Sprite bottles and cans' },
    { id: 'cat_drk_2', businessId: 'drinks' as BusinessId, name: 'Malt & Energy Drinks', description: 'Malta Guinness, Lucozade, Rush, Storm' },
    { id: 'cat_drk_3', businessId: 'drinks' as BusinessId, name: 'Bottled & Sachet Water', description: 'Bel-Aqua, Awake, Voltic pure natural water' },
    { id: 'cat_drk_4', businessId: 'drinks' as BusinessId, name: 'Fruit Juices & Nectars', description: 'Don Simon, Ceres, Happy Delight' },
    { id: 'cat_drk_5', businessId: 'drinks' as BusinessId, name: 'Beer & Stout Beverages', description: 'Guinness, Star, Club beer' }
  ];

  await db.categories.bulkPut([...bldCategories, ...drkCategories]);

  // Soft Drinks Containers
  const containers: ContainerType[] = [
    {
      id: 'cont_1',
      businessId: 'drinks',
      containerName: 'Glass Bottle Crate (24 x 300ml RGB)',
      fullCrates: 120,
      emptyCrates: 45,
      fullBottles: 2880,
      emptyBottles: 1080,
      bottlesPerCrate: 24,
      depositPerCrate: 25.0,
      updatedAt: new Date().toISOString()
    },
    {
      id: 'cont_2',
      businessId: 'drinks',
      containerName: 'Large Glass Bottle Crate (24 x 625ml RGB)',
      fullCrates: 60,
      emptyCrates: 20,
      fullBottles: 1440,
      emptyBottles: 480,
      bottlesPerCrate: 24,
      depositPerCrate: 35.0,
      updatedAt: new Date().toISOString()
    },
    {
      id: 'cont_3',
      businessId: 'drinks',
      containerName: '20L Water Dispenser Bottle (Refillable)',
      fullCrates: 40,
      emptyCrates: 15,
      fullBottles: 40,
      emptyBottles: 15,
      bottlesPerCrate: 1,
      depositPerCrate: 50.0,
      updatedAt: new Date().toISOString()
    }
  ];

  await db.containerTypes.bulkPut(containers);

  // Products Building Materials
  const bldProducts: Product[] = [
    {
      id: 'prod_bld_1',
      businessId: 'building',
      name: 'Ghacem Extra 42.5N Cement',
      brand: 'Ghacem',
      codeSku: 'CEM-GHA-425',
      categoryId: 'cat_bld_1',
      categoryName: 'Cement & Bonding',
      unit: 'Bags',
      purchasePrice: 92.0,
      sellingPrice: 105.0,
      currentStock: 250,
      minStockLevel: 50,
      openingStock: 250,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'prod_bld_2',
      businessId: 'building',
      name: 'Diamond Cement 32.5R',
      brand: 'Diamond',
      codeSku: 'CEM-DIA-325',
      categoryId: 'cat_bld_1',
      categoryName: 'Cement & Bonding',
      unit: 'Bags',
      purchasePrice: 85.0,
      sellingPrice: 98.0,
      currentStock: 180,
      minStockLevel: 40,
      openingStock: 180,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'prod_bld_3',
      businessId: 'building',
      name: 'High Tensile Iron Rods 16mm (Per Length)',
      brand: 'Sentuo / B5 Plus',
      codeSku: 'ROD-16MM-HT',
      categoryId: 'cat_bld_2',
      categoryName: 'Iron Rods & Steel',
      unit: 'Lengths',
      purchasePrice: 135.0,
      sellingPrice: 155.0,
      currentStock: 120,
      minStockLevel: 25,
      openingStock: 120,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'prod_bld_4',
      businessId: 'building',
      name: 'High Tensile Iron Rods 12mm (Per Length)',
      brand: 'Sentuo / B5 Plus',
      codeSku: 'ROD-12MM-HT',
      categoryId: 'cat_bld_2',
      categoryName: 'Iron Rods & Steel',
      unit: 'Lengths',
      purchasePrice: 78.0,
      sellingPrice: 92.0,
      currentStock: 300,
      minStockLevel: 50,
      openingStock: 300,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'prod_bld_5',
      businessId: 'building',
      name: 'Corrugated Aluminum Roofing Sheets 0.45mm',
      brand: 'Donsin / Domod',
      codeSku: 'ROOF-ALUM-45',
      categoryId: 'cat_bld_3',
      categoryName: 'Roofing & Sheets',
      unit: 'Bundles',
      purchasePrice: 650.0,
      sellingPrice: 760.0,
      currentStock: 35,
      minStockLevel: 10,
      openingStock: 35,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'prod_bld_6',
      businessId: 'building',
      name: 'Wire Nails 3-inch (50kg Bag)',
      brand: 'Standard Fasteners',
      codeSku: 'NAIL-3IN-BAG',
      categoryId: 'cat_bld_4',
      categoryName: 'Nails & Fasteners',
      unit: 'Bags',
      purchasePrice: 420.0,
      sellingPrice: 490.0,
      currentStock: 22,
      minStockLevel: 5,
      openingStock: 22,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'prod_bld_7',
      businessId: 'building',
      name: 'Coral Enamel Gloss Paint White 4L',
      brand: 'Coral',
      codeSku: 'PNT-COR-4L',
      categoryId: 'cat_bld_5',
      categoryName: 'Paints & Finishes',
      unit: 'Pieces',
      purchasePrice: 140.0,
      sellingPrice: 175.0,
      currentStock: 40,
      minStockLevel: 8,
      openingStock: 40,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'prod_bld_8',
      businessId: 'building',
      name: 'Dulux WeatherShield Emulsion Paint 20L',
      brand: 'Dulux',
      codeSku: 'PNT-DUL-20L',
      categoryId: 'cat_bld_5',
      categoryName: 'Paints & Finishes',
      unit: 'Pieces',
      purchasePrice: 580.0,
      sellingPrice: 680.0,
      currentStock: 18,
      minStockLevel: 6,
      openingStock: 18,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'prod_bld_9',
      businessId: 'building',
      name: 'PVC Waste Pipe 4-inch x 6m',
      brand: 'Interplast',
      codeSku: 'PLUMB-PVC-4IN',
      categoryId: 'cat_bld_6',
      categoryName: 'Plumbing & Pipes',
      unit: 'Lengths',
      purchasePrice: 85.0,
      sellingPrice: 110.0,
      currentStock: 60,
      minStockLevel: 15,
      openingStock: 60,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'prod_bld_10',
      businessId: 'building',
      name: 'Solid Concrete Building Blocks 5-inch',
      brand: 'Local Quarry Precast',
      codeSku: 'BLK-SOL-5IN',
      categoryId: 'cat_bld_8',
      categoryName: 'Blocks & Sand',
      unit: 'Pieces',
      purchasePrice: 6.5,
      sellingPrice: 8.5,
      currentStock: 800,
      minStockLevel: 200,
      openingStock: 800,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'prod_bld_11',
      businessId: 'building',
      name: 'Porcelain Floor Tiles 60x60cm (Box of 4)',
      brand: 'Virony',
      codeSku: 'TILE-VIR-60X60',
      categoryId: 'cat_bld_9',
      categoryName: 'Tiles & Adhesives',
      unit: 'Boxes',
      purchasePrice: 115.0,
      sellingPrice: 145.0,
      currentStock: 95,
      minStockLevel: 20,
      openingStock: 95,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'prod_bld_12',
      businessId: 'building',
      name: 'Eastgate Electrical Copper Cable 2.5mm Roll (100m)',
      brand: 'Eastgate',
      codeSku: 'ELEC-CBL-25',
      categoryId: 'cat_bld_7',
      categoryName: 'Electricals',
      unit: 'Rolls',
      purchasePrice: 420.0,
      sellingPrice: 495.0,
      currentStock: 4, // Intentionally low stock
      minStockLevel: 10,
      openingStock: 4,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  // Products Soft Drinks & Minerals
  const drkProducts: Product[] = [
    {
      id: 'prod_drk_1',
      businessId: 'drinks',
      name: 'Coca-Cola 300ml RGB Glass Bottle',
      brand: 'Coca-Cola',
      codeSku: 'BEV-COKE-300',
      categoryId: 'cat_drk_1',
      categoryName: 'Carbonated Soft Drinks',
      unit: 'Bottle',
      purchasePrice: 3.5, // GH₵ 3.5 per bottle
      sellingPrice: 5.0, // GH₵ 5.0 per bottle
      currentStock: 2880, // 120 crates * 24 bottles
      minStockLevel: 480,
      openingStock: 2880,
      packagingConversionQty: 24, // 24 bottles = 1 crate
      cratePrice: 110.0, // 24 bottles at GH₵ 110 wholesale crate price (GH₵ 4.58/btl)
      tracksCrate: true,
      containerTypeId: 'cont_1',
      expiryDate: '2027-08-15',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'prod_drk_2',
      businessId: 'drinks',
      name: 'Fanta Orange 300ml RGB Glass Bottle',
      brand: 'Coca-Cola',
      codeSku: 'BEV-FANTA-300',
      categoryId: 'cat_drk_1',
      categoryName: 'Carbonated Soft Drinks',
      unit: 'Bottle',
      purchasePrice: 3.5,
      sellingPrice: 5.0,
      currentStock: 1920, // 80 crates
      minStockLevel: 360,
      openingStock: 1920,
      packagingConversionQty: 24,
      cratePrice: 110.0,
      tracksCrate: true,
      containerTypeId: 'cont_1',
      expiryDate: '2027-09-01',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'prod_drk_3',
      businessId: 'drinks',
      name: 'Sprite 300ml RGB Glass Bottle',
      brand: 'Coca-Cola',
      codeSku: 'BEV-SPRITE-300',
      categoryId: 'cat_drk_1',
      categoryName: 'Carbonated Soft Drinks',
      unit: 'Bottle',
      purchasePrice: 3.5,
      sellingPrice: 5.0,
      currentStock: 1440, // 60 crates
      minStockLevel: 240,
      openingStock: 1440,
      packagingConversionQty: 24,
      cratePrice: 110.0,
      tracksCrate: true,
      containerTypeId: 'cont_1',
      expiryDate: '2027-07-20',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'prod_drk_4',
      businessId: 'drinks',
      name: 'Malta Guinness 330ml Can (Pack of 24)',
      brand: 'Guinness Ghana',
      codeSku: 'BEV-MALTA-CAN',
      categoryId: 'cat_drk_2',
      categoryName: 'Malt & Energy Drinks',
      unit: 'Pack',
      purchasePrice: 175.0,
      sellingPrice: 205.0,
      currentStock: 45,
      minStockLevel: 10,
      openingStock: 45,
      packagingConversionQty: 24,
      packPrice: 205.0,
      tracksCrate: false,
      expiryDate: '2027-04-10',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'prod_drk_5',
      businessId: 'drinks',
      name: 'Alvaro Pear 330ml RGB Glass Bottle',
      brand: 'Guinness Ghana',
      codeSku: 'BEV-ALVARO-330',
      categoryId: 'cat_drk_2',
      categoryName: 'Malt & Energy Drinks',
      unit: 'Bottle',
      purchasePrice: 4.2,
      sellingPrice: 6.0,
      currentStock: 720, // 30 crates
      minStockLevel: 120,
      openingStock: 720,
      packagingConversionQty: 24,
      cratePrice: 135.0,
      tracksCrate: true,
      containerTypeId: 'cont_1',
      expiryDate: '2026-12-15', // Soon approaching expiry alert!
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'prod_drk_6',
      businessId: 'drinks',
      name: 'Bel-Aqua Mineral Water 500ml (Pack of 16)',
      brand: 'Blow Chem',
      codeSku: 'WAT-BELAQUA-500',
      categoryId: 'cat_drk_3',
      categoryName: 'Bottled & Sachet Water',
      unit: 'Pack',
      purchasePrice: 26.0,
      sellingPrice: 34.0,
      currentStock: 140,
      minStockLevel: 25,
      openingStock: 140,
      packagingConversionQty: 16,
      packPrice: 34.0,
      tracksCrate: false,
      expiryDate: '2028-01-30',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'prod_drk_7',
      businessId: 'drinks',
      name: 'Awake Purified Water 750ml (Pack of 12)',
      brand: 'Kasapreko',
      codeSku: 'WAT-AWAKE-750',
      categoryId: 'cat_drk_3',
      categoryName: 'Bottled & Sachet Water',
      unit: 'Pack',
      purchasePrice: 28.0,
      sellingPrice: 36.0,
      currentStock: 80,
      minStockLevel: 20,
      openingStock: 80,
      packagingConversionQty: 12,
      packPrice: 36.0,
      tracksCrate: false,
      expiryDate: '2027-11-20',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'prod_drk_8',
      businessId: 'drinks',
      name: 'Rush Energy Drink 350ml Can (Pack of 24)',
      brand: 'Twellium',
      codeSku: 'NRG-RUSH-350',
      categoryId: 'cat_drk_2',
      categoryName: 'Malt & Energy Drinks',
      unit: 'Pack',
      purchasePrice: 110.0,
      sellingPrice: 135.0,
      currentStock: 3, // Low stock alert
      minStockLevel: 15,
      openingStock: 3,
      packagingConversionQty: 24,
      packPrice: 135.0,
      tracksCrate: false,
      expiryDate: '2027-06-30',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'prod_drk_9',
      businessId: 'drinks',
      name: 'Don Simon Multifruit Juice 1L (Pack of 12)',
      brand: 'Don Simon',
      codeSku: 'JCE-DONSIMON-1L',
      categoryId: 'cat_drk_4',
      categoryName: 'Fruit Juices & Nectars',
      unit: 'Pack',
      purchasePrice: 190.0,
      sellingPrice: 230.0,
      currentStock: 16,
      minStockLevel: 5,
      openingStock: 16,
      packagingConversionQty: 12,
      packPrice: 230.0,
      tracksCrate: false,
      expiryDate: '2027-05-18',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  await db.products.bulkPut([...bldProducts, ...drkProducts]);

  // Customers
  const bldCustomers: Customer[] = [
    {
      id: 'cust_bld_1',
      businessId: 'building',
      name: 'Kofi Mensah Construction Ltd',
      phone: '024 123 4567',
      address: 'East Legon Hills, Accra',
      notes: 'Major residential contractor; trusted credit customer',
      creditLimit: 50000,
      totalPurchased: 45000,
      totalPaid: 35000,
      outstandingDebt: 10000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'cust_bld_2',
      businessId: 'building',
      name: 'Madam Akosua Boateng',
      phone: '020 987 6543',
      address: 'Sakumono Estates, Tema',
      notes: 'Building 2-storey personal residence',
      creditLimit: 15000,
      totalPurchased: 12500,
      totalPaid: 9500,
      outstandingDebt: 3000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'cust_bld_3',
      businessId: 'building',
      name: 'Walk-in Cash Customer',
      phone: '024 000 0000',
      address: 'Accra',
      notes: 'Default retail counter sales',
      creditLimit: 0,
      totalPurchased: 2400,
      totalPaid: 2400,
      outstandingDebt: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  const drkCustomers: Customer[] = [
    {
      id: 'cust_drk_1',
      businessId: 'drinks',
      name: 'Adjoa Mansah Pub & Restaurant',
      phone: '024 555 1234',
      address: 'Osu Oxford Street, Accra',
      notes: 'High volume weekend bar; takes 25 crates weekly',
      creditLimit: 8000,
      totalPurchased: 6500,
      totalPaid: 5000,
      outstandingDebt: 1500,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'cust_drk_2',
      businessId: 'drinks',
      name: 'Uncle Ben Spot & Grocery',
      phone: '055 888 9900',
      address: 'Dansoman Roundabout, Accra',
      notes: 'Retail drink shop; always returns empty crates',
      creditLimit: 5000,
      totalPurchased: 4200,
      totalPaid: 3400,
      outstandingDebt: 800,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'cust_drk_3',
      businessId: 'drinks',
      name: 'Walk-in Event Customer',
      phone: '024 000 0000',
      address: 'Accra',
      notes: 'Funerals, weddings and parties',
      creditLimit: 0,
      totalPurchased: 1800,
      totalPaid: 1800,
      outstandingDebt: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  await db.customers.bulkPut([...bldCustomers, ...drkCustomers]);

  // Soft drinks customer container balance
  const contBalances: CustomerContainerBalance[] = [
    {
      id: 'bal_1',
      businessId: 'drinks',
      customerId: 'cust_drk_1',
      customerName: 'Adjoa Mansah Pub & Restaurant',
      containerId: 'cont_1',
      containerName: 'Glass Bottle Crate (24 x 300ml RGB)',
      cratesOwed: 8, // Customer currently has 8 unreturned empty crates
      totalDepositsHeld: 200.0,
      updatedAt: new Date().toISOString()
    },
    {
      id: 'bal_2',
      businessId: 'drinks',
      customerId: 'cust_drk_2',
      customerName: 'Uncle Ben Spot & Grocery',
      containerId: 'cont_1',
      containerName: 'Glass Bottle Crate (24 x 300ml RGB)',
      cratesOwed: 4,
      totalDepositsHeld: 100.0,
      updatedAt: new Date().toISOString()
    }
  ];
  await db.customerContainerBalances.bulkPut(contBalances);

  // Suppliers
  const bldSuppliers: Supplier[] = [
    {
      id: 'sup_bld_1',
      businessId: 'building',
      name: 'Ghacem Ghana Cement Depot',
      phone: '030 222 1100',
      email: 'orders@ghacem.com',
      address: 'Harbour Area, Tema',
      contactPerson: 'Mr. Emmanuel Tetteh',
      totalPurchased: 85000,
      totalPaid: 70000,
      outstandingBalance: 15000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'sup_bld_2',
      businessId: 'building',
      name: 'B5 Plus Steel Industry',
      phone: '030 333 4455',
      email: 'sales@b5plus.com',
      address: 'Kpone Industrial Area, Tema',
      contactPerson: 'Pravin Kumar / Nii Laryea',
      totalPurchased: 65000,
      totalPaid: 65000,
      outstandingBalance: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  const drkSuppliers: Supplier[] = [
    {
      id: 'sup_drk_1',
      businessId: 'drinks',
      name: 'Coca-Cola Bottling Company of Ghana',
      phone: '030 281 1234',
      email: 'accra.depot@coca-cola.com',
      address: 'Spintex Road, Accra',
      contactPerson: 'Francis Ofori',
      totalPurchased: 45000,
      totalPaid: 38000,
      outstandingBalance: 7000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'sup_drk_2',
      businessId: 'drinks',
      name: 'Guinness Ghana Breweries PLC',
      phone: '030 282 3456',
      email: 'wholesale@guinness.com.gh',
      address: 'Achimota Brewery, Accra',
      contactPerson: 'Serwaa Bonsu',
      totalPurchased: 30000,
      totalPaid: 30000,
      outstandingBalance: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  await db.suppliers.bulkPut([...bldSuppliers, ...drkSuppliers]);

  // Seed sample real sales to satisfy dashboard & financial figures
  const initialSales: Sale[] = [
    {
      id: 'sale_bld_101',
      businessId: 'building',
      receiptNumber: 'BLD-2611-1001',
      customerId: 'cust_bld_1',
      customerName: 'Kofi Mensah Construction Ltd',
      customerPhone: '024 123 4567',
      subtotal: 5250.0,
      discount: 100.0,
      totalAmount: 5150.0,
      amountPaid: 3150.0,
      outstandingBalance: 2000.0,
      paymentMethod: 'momo',
      momoDetails: {
        network: 'MTN MoMo',
        reference: 'TXN9928174'
      },
      status: 'partially_paid',
      dueDate: '2026-11-20',
      items: [
        {
          productId: 'prod_bld_1',
          productName: 'Ghacem Extra 42.5N Cement',
          unit: 'Bags',
          quantity: 50,
          unitPrice: 105.0,
          costPrice: 92.0,
          total: 5250.0
        }
      ],
      notes: 'Delivered to East Legon Hills site',
      recordedByUserId: adminUser.id,
      recordedByUserName: adminUser.fullName,
      createdAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString()
    },
    {
      id: 'sale_bld_102',
      businessId: 'building',
      receiptNumber: 'BLD-2611-1002',
      customerId: 'cust_bld_3',
      customerName: 'Walk-in Cash Customer',
      customerPhone: '024 000 0000',
      subtotal: 980.0,
      discount: 0,
      totalAmount: 980.0,
      amountPaid: 980.0,
      outstandingBalance: 0,
      paymentMethod: 'cash',
      status: 'completed',
      items: [
        {
          productId: 'prod_bld_2',
          productName: 'Diamond Cement 32.5R',
          unit: 'Bags',
          quantity: 10,
          unitPrice: 98.0,
          costPrice: 85.0,
          total: 980.0
        }
      ],
      recordedByUserId: adminUser.id,
      recordedByUserName: adminUser.fullName,
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
    },
    {
      id: 'sale_drk_201',
      businessId: 'drinks',
      receiptNumber: 'DRK-2611-2001',
      customerId: 'cust_drk_1',
      customerName: 'Adjoa Mansah Pub & Restaurant',
      customerPhone: '024 555 1234',
      subtotal: 1540.0,
      discount: 40.0,
      totalAmount: 1500.0,
      amountPaid: 1000.0,
      outstandingBalance: 500.0,
      paymentMethod: 'momo',
      momoDetails: {
        network: 'MTN MoMo',
        reference: 'MOM8871239'
      },
      status: 'partially_paid',
      dueDate: '2026-11-15',
      items: [
        {
          productId: 'prod_drk_1',
          productName: 'Coca-Cola 300ml RGB Glass Bottle',
          unit: 'Crate',
          unitType: 'crate',
          quantity: 10, // 10 crates = 240 bottles
          unitPrice: 110.0,
          costPrice: 84.0,
          total: 1100.0,
          bottlesCount: 240
        },
        {
          productId: 'prod_drk_2',
          productName: 'Fanta Orange 300ml RGB Glass Bottle',
          unit: 'Crate',
          unitType: 'crate',
          quantity: 4, // 4 crates = 96 bottles
          unitPrice: 110.0,
          costPrice: 84.0,
          total: 440.0,
          bottlesCount: 96
        }
      ],
      containerTransactions: [
        {
          containerId: 'cont_1',
          containerName: 'Glass Bottle Crate (24 x 300ml RGB)',
          issuedCrates: 14,
          returnedCrates: 6, // Returned 6 crates on delivery
          depositPerCrate: 25.0,
          netDepositCharge: 200.0 // 8 crates owed = GH₵ 200 held
        }
      ],
      recordedByUserId: adminUser.id,
      recordedByUserName: adminUser.fullName,
      createdAt: new Date(Date.now() - 3600000 * 18).toISOString()
    },
    {
      id: 'sale_drk_202',
      businessId: 'drinks',
      receiptNumber: 'DRK-2611-2002',
      customerId: 'cust_drk_3',
      customerName: 'Walk-in Event Customer',
      customerPhone: '024 000 0000',
      subtotal: 680.0,
      discount: 0,
      totalAmount: 680.0,
      amountPaid: 680.0,
      outstandingBalance: 0,
      paymentMethod: 'cash',
      status: 'completed',
      items: [
        {
          productId: 'prod_drk_6',
          productName: 'Bel-Aqua Mineral Water 500ml (Pack of 16)',
          unit: 'Pack',
          unitType: 'pack',
          quantity: 20,
          unitPrice: 34.0,
          costPrice: 26.0,
          total: 680.0
        }
      ],
      recordedByUserId: adminUser.id,
      recordedByUserName: adminUser.fullName,
      createdAt: new Date(Date.now() - 3600000 * 3).toISOString()
    }
  ];

  await db.sales.bulkPut(initialSales);

  // Sample Expenses
  const sampleExpenses: Expense[] = [
    {
      id: 'exp_bld_1',
      businessId: 'building',
      category: 'Transport',
      amount: 450.0,
      date: new Date(Date.now() - 3600000 * 24).toISOString().split('T')[0],
      description: 'Offloading cement consignment from Tema factory',
      paymentMethod: 'cash',
      recordedByUserId: adminUser.id,
      recordedByUserName: adminUser.fullName,
      createdAt: new Date().toISOString()
    },
    {
      id: 'exp_bld_2',
      businessId: 'building',
      category: 'Electricity & Utilities',
      amount: 280.0,
      date: new Date().toISOString().split('T')[0],
      description: 'ECG prepaid power card for shop and warehouse lighting',
      paymentMethod: 'momo',
      recordedByUserId: adminUser.id,
      recordedByUserName: adminUser.fullName,
      createdAt: new Date().toISOString()
    },
    {
      id: 'exp_drk_1',
      businessId: 'drinks',
      category: 'Transport',
      amount: 350.0,
      date: new Date(Date.now() - 3600000 * 24).toISOString().split('T')[0],
      description: 'Kia truck delivery to wholesale client locations',
      paymentMethod: 'cash',
      recordedByUserId: adminUser.id,
      recordedByUserName: adminUser.fullName,
      createdAt: new Date().toISOString()
    },
    {
      id: 'exp_drk_2',
      businessId: 'drinks',
      category: 'Salaries & Wages',
      amount: 600.0,
      date: new Date().toISOString().split('T')[0],
      description: 'Weekly loader allowance for crate stacking and handling',
      paymentMethod: 'cash',
      recordedByUserId: adminUser.id,
      recordedByUserName: adminUser.fullName,
      createdAt: new Date().toISOString()
    }
  ];

  await db.expenses.bulkPut(sampleExpenses);

  await logAuditEvent(
    'system',
    'INITIAL_SEED',
    'SEED_DATA',
    'Initial operational test data seeded successfully with realistic Ghanaian items and accounts',
    adminUser
  );
}

// --------------------------------------------------------------------------------
// TRANSACTIONAL OPERATIONS & STRICT BUSINESS ENFORCEMENT
// --------------------------------------------------------------------------------

/**
 * Validates whether the active user has rights to operate on this business.
 * Prevents URL manipulation or cross-business tampering.
 */
export function assertBusinessAccess(user: User, businessId: BusinessId) {
  if (user.role === 'admin') return true;
  if (user.assignedBusiness !== businessId) {
    throw new Error(`ACCESS DENIED: User "${user.username}" is assigned to [${user.assignedBusiness}] and cannot access [${businessId}].`);
  }
  return true;
}

// --------------------------------------------------------------------------------
// SALE TRANSACTION (ACID with stock reduction & customer debt updates)
// --------------------------------------------------------------------------------
export async function executeSaleTransaction(
  sale: Omit<Sale, 'id' | 'createdAt'>,
  user: User
): Promise<Sale> {
  assertBusinessAccess(user, sale.businessId);

  return await db.transaction(
    'rw',
    [
      db.sales,
      db.products,
      db.inventoryMovements,
      db.customers,
      db.customerPayments,
      db.containerTypes,
      db.containerMovements,
      db.customerContainerBalances,
      db.auditLogs
    ],
    async () => {
      const saleId = 'sale_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const now = new Date().toISOString();

      // 1. Process each item: verify & reduce inventory
      for (const item of sale.items) {
        const product = await db.products.get(item.productId);
        if (!product || product.businessId !== sale.businessId) {
          throw new Error(`Product ${item.productName} not found in this business.`);
        }

        // Calculate quantity to deduct in base inventory units
        let deductQty = item.quantity;
        if (sale.businessId === 'drinks') {
          if (item.unitType === 'crate' && product.packagingConversionQty) {
            deductQty = item.quantity * product.packagingConversionQty;
          } else if (item.unitType === 'pack' && product.packagingConversionQty) {
            deductQty = item.quantity * product.packagingConversionQty;
          }
        }

        if (product.currentStock < deductQty) {
          // Check stock
          console.warn(`Selling with negative stock warning: ${product.name} (have ${product.currentStock}, deducting ${deductQty})`);
        }

        const prevStock = product.currentStock;
        const newStock = prevStock - deductQty;

        await db.products.update(product.id, {
          currentStock: newStock,
          updatedAt: now
        });

        // Record stock movement
        await db.inventoryMovements.add({
          id: 'mov_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          businessId: sale.businessId,
          productId: product.id,
          productName: product.name,
          type: 'sale',
          quantity: -deductQty,
          previousStock: prevStock,
          newStock: newStock,
          unitCost: item.costPrice,
          totalValue: deductQty * item.costPrice,
          referenceId: sale.receiptNumber,
          reason: `Sale receipt #${sale.receiptNumber}`,
          recordedByUserId: user.id,
          recordedByUserName: user.fullName,
          createdAt: now
        });
      }

      // 2. Container Tracking (for Soft Drinks & Minerals)
      if (sale.businessId === 'drinks' && sale.containerTransactions && sale.containerTransactions.length > 0) {
        for (const ct of sale.containerTransactions) {
          const container = await db.containerTypes.get(ct.containerId);
          if (container) {
            // Issuing crates reduces full crates in warehouse, customer returning crates increases empty crates in warehouse
            const newFullCrates = Math.max(0, container.fullCrates - ct.issuedCrates);
            const newEmptyCrates = container.emptyCrates + ct.returnedCrates;
            await db.containerTypes.update(container.id, {
              fullCrates: newFullCrates,
              emptyCrates: newEmptyCrates,
              updatedAt: now
            });

            // If a specific customer is attached, update customer container balance
            if (sale.customerId) {
              const netCratesDiff = ct.issuedCrates - ct.returnedCrates;
              const existingBal = await db.customerContainerBalances
                .where({ customerId: sale.customerId, containerId: container.id })
                .first();

              if (existingBal) {
                await db.customerContainerBalances.update(existingBal.id, {
                  cratesOwed: Math.max(0, existingBal.cratesOwed + netCratesDiff),
                  totalDepositsHeld: Math.max(0, existingBal.totalDepositsHeld + ct.netDepositCharge),
                  updatedAt: now
                });
              } else {
                await db.customerContainerBalances.add({
                  id: 'ccb_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                  businessId: 'drinks',
                  customerId: sale.customerId,
                  customerName: sale.customerName,
                  containerId: container.id,
                  containerName: container.containerName,
                  cratesOwed: Math.max(0, netCratesDiff),
                  totalDepositsHeld: Math.max(0, ct.netDepositCharge),
                  updatedAt: now
                });
              }
            }

            // Record movement
            await db.containerMovements.add({
              id: 'cm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
              businessId: 'drinks',
              containerId: container.id,
              containerName: container.containerName,
              customerId: sale.customerId,
              customerName: sale.customerName,
              movementType: 'issued_to_customer',
              cratesCount: ct.issuedCrates,
              bottlesCount: ct.issuedCrates * container.bottlesPerCrate,
              depositAmount: ct.netDepositCharge,
              referenceId: sale.receiptNumber,
              recordedByUserId: user.id,
              recordedByUserName: user.fullName,
              reason: `Sale ${sale.receiptNumber} (${ct.issuedCrates} issued, ${ct.returnedCrates} returned)`,
              createdAt: now
            });
          }
        }
      }

      // 3. Customer debt updates (if customer exists)
      if (sale.customerId) {
        const customer = await db.customers.get(sale.customerId);
        if (customer) {
          const newTotalPurchased = customer.totalPurchased + sale.totalAmount;
          const newTotalPaid = customer.totalPaid + sale.amountPaid;
          const newDebt = Math.max(0, customer.outstandingDebt + sale.outstandingBalance);

          await db.customers.update(customer.id, {
            totalPurchased: newTotalPurchased,
            totalPaid: newTotalPaid,
            outstandingDebt: newDebt,
            updatedAt: now
          });
        }
      }

      // 4. Save sale record
      const fullSale: Sale = {
        ...sale,
        id: saleId,
        createdAt: now
      };
      await db.sales.add(fullSale);

      // 5. If amount paid > 0, record customer payment
      if (sale.amountPaid > 0 && sale.customerId) {
        await db.customerPayments.add({
          id: 'pay_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          businessId: sale.businessId,
          receiptNumber: 'PAY-' + sale.receiptNumber,
          customerId: sale.customerId,
          customerName: sale.customerName,
          saleId: saleId,
          amountPaid: sale.amountPaid,
          paymentMethod: sale.paymentMethod === 'split' ? 'cash' : (sale.paymentMethod === 'credit' ? 'cash' : sale.paymentMethod),
          notes: `Initial payment for sale ${sale.receiptNumber}`,
          recordedByUserId: user.id,
          recordedByUserName: user.fullName,
          createdAt: now
        });
      }

      // 6. Audit Log
      await db.auditLogs.add({
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        businessId: sale.businessId,
        action: 'SALE_COMPLETED',
        recordReference: sale.receiptNumber,
        description: `Sale of GH₵ ${sale.totalAmount.toFixed(2)} completed for ${sale.customerName} (${sale.paymentMethod})`,
        userId: user.id,
        userName: user.fullName,
        userRole: user.role,
        timestamp: now,
        details: { saleId, total: sale.totalAmount, paid: sale.amountPaid, balance: sale.outstandingBalance }
      });

      return fullSale;
    }
  );
}

// --------------------------------------------------------------------------------
// SALE REVERSAL / CANCELLATION (Restores stock, adjusts debt, maintains audit)
// --------------------------------------------------------------------------------
export async function reverseSale(
  saleId: string,
  reason: string,
  user: User
): Promise<void> {
  const sale = await db.sales.get(saleId);
  if (!sale) throw new Error('Sale not found.');
  assertBusinessAccess(user, sale.businessId);

  if (sale.isReversed) {
    throw new Error('This sale has already been reversed.');
  }

  return await db.transaction(
    'rw',
    [
      db.sales,
      db.products,
      db.inventoryMovements,
      db.customers,
      db.auditLogs
    ],
    async () => {
      const now = new Date().toISOString();

      // 1. Restore product inventory
      for (const item of sale.items) {
        const product = await db.products.get(item.productId);
        if (product) {
          let restoreQty = item.quantity;
          if (sale.businessId === 'drinks' && item.unitType === 'crate' && product.packagingConversionQty) {
            restoreQty = item.quantity * product.packagingConversionQty;
          }
          const prevStock = product.currentStock;
          const newStock = prevStock + restoreQty;

          await db.products.update(product.id, {
            currentStock: newStock,
            updatedAt: now
          });

          await db.inventoryMovements.add({
            id: 'mov_rev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            businessId: sale.businessId,
            productId: product.id,
            productName: product.name,
            type: 'cancellation_reverse',
            quantity: restoreQty,
            previousStock: prevStock,
            newStock: newStock,
            unitCost: item.costPrice,
            totalValue: restoreQty * item.costPrice,
            referenceId: sale.receiptNumber,
            reason: `Reversal of sale #${sale.receiptNumber}: ${reason}`,
            recordedByUserId: user.id,
            recordedByUserName: user.fullName,
            createdAt: now
          });
        }
      }

      // 2. Adjust customer debt & totals if attached
      if (sale.customerId) {
        const customer = await db.customers.get(sale.customerId);
        if (customer) {
          const newPurchased = Math.max(0, customer.totalPurchased - sale.totalAmount);
          const newPaid = Math.max(0, customer.totalPaid - sale.amountPaid);
          const newDebt = Math.max(0, customer.outstandingDebt - sale.outstandingBalance);

          await db.customers.update(customer.id, {
            totalPurchased: newPurchased,
            totalPaid: newPaid,
            outstandingDebt: newDebt,
            updatedAt: now
          });
        }
      }

      // 3. Mark sale as reversed
      await db.sales.update(sale.id, {
        isReversed: true,
        reverseReason: reason,
        reversedAt: now,
        reversedBy: user.fullName,
        status: 'cancelled'
      });

      // 4. Log audit
      await db.auditLogs.add({
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        businessId: sale.businessId,
        action: 'SALE_REVERSED',
        recordReference: sale.receiptNumber,
        description: `Sale #${sale.receiptNumber} reversed by ${user.fullName}. Reason: ${reason}`,
        userId: user.id,
        userName: user.fullName,
        userRole: user.role,
        timestamp: now,
        details: { saleId: sale.id, amount: sale.totalAmount, reason }
      });
    }
  );
}

// --------------------------------------------------------------------------------
// CUSTOMER PAYMENT (Reduces debt and increases payment totals)
// --------------------------------------------------------------------------------
export async function recordCustomerPayment(
  paymentData: {
    businessId: BusinessId;
    customerId: string;
    amountPaid: number;
    paymentMethod: 'cash' | 'momo' | 'bank';
    referenceNumber?: string;
    saleId?: string;
    notes?: string;
  },
  user: User
): Promise<CustomerPayment> {
  assertBusinessAccess(user, paymentData.businessId);

  return await db.transaction(
    'rw',
    [db.customers, db.customerPayments, db.sales, db.auditLogs],
    async () => {
      const now = new Date().toISOString();
      const customer = await db.customers.get(paymentData.customerId);
      if (!customer) throw new Error('Customer not found.');

      const receiptNumber = 'PAY-' + Date.now().toString().slice(-6);

      // Reduce customer outstanding debt
      const newDebt = Math.max(0, customer.outstandingDebt - paymentData.amountPaid);
      const newPaid = customer.totalPaid + paymentData.amountPaid;

      await db.customers.update(customer.id, {
        outstandingDebt: newDebt,
        totalPaid: newPaid,
        updatedAt: now
      });

      // If tied to a specific sale, update the sale record
      if (paymentData.saleId) {
        const sale = await db.sales.get(paymentData.saleId);
        if (sale) {
          const updatedPaid = sale.amountPaid + paymentData.amountPaid;
          const updatedBalance = Math.max(0, sale.outstandingBalance - paymentData.amountPaid);
          const updatedStatus = updatedBalance <= 0 ? 'completed' : 'partially_paid';

          await db.sales.update(sale.id, {
            amountPaid: updatedPaid,
            outstandingBalance: updatedBalance,
            status: updatedStatus
          });
        }
      }

      const paymentRecord: CustomerPayment = {
        id: 'cpay_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        businessId: paymentData.businessId,
        receiptNumber,
        customerId: customer.id,
        customerName: customer.name,
        saleId: paymentData.saleId,
        amountPaid: paymentData.amountPaid,
        paymentMethod: paymentData.paymentMethod,
        referenceNumber: paymentData.referenceNumber,
        notes: paymentData.notes,
        recordedByUserId: user.id,
        recordedByUserName: user.fullName,
        createdAt: now
      };

      await db.customerPayments.add(paymentRecord);

      await db.auditLogs.add({
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        businessId: paymentData.businessId,
        action: 'CUSTOMER_PAYMENT',
        recordReference: receiptNumber,
        description: `Customer payment of GH₵ ${paymentData.amountPaid.toFixed(2)} received from ${customer.name} via ${paymentData.paymentMethod.toUpperCase()}`,
        userId: user.id,
        userName: user.fullName,
        userRole: user.role,
        timestamp: now,
        details: { customerId: customer.id, amount: paymentData.amountPaid, remainingDebt: newDebt }
      });

      return paymentRecord;
    }
  );
}

// --------------------------------------------------------------------------------
// PURCHASES & SUPPLIER BALANCES
// --------------------------------------------------------------------------------
export async function executePurchaseTransaction(
  purchaseData: Omit<Purchase, 'id' | 'createdAt'>,
  user: User
): Promise<Purchase> {
  assertBusinessAccess(user, purchaseData.businessId);

  return await db.transaction(
    'rw',
    [
      db.purchases,
      db.products,
      db.inventoryMovements,
      db.suppliers,
      db.supplierPayments,
      db.auditLogs
    ],
    async () => {
      const now = new Date().toISOString();
      const purchaseId = 'pur_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

      // 1. Increase stock for each item & recalculate weighted average cost
      for (const item of purchaseData.items) {
        const product = await db.products.get(item.productId);
        if (product) {
          let addQty = item.quantity;
          if (purchaseData.businessId === 'drinks' && item.packagingUnit === 'crate' && product.packagingConversionQty) {
            addQty = item.quantity * product.packagingConversionQty;
          }

          const prevStock = product.currentStock;
          const newStock = prevStock + addQty;

          // Weighted average cost price
          const oldVal = Math.max(0, prevStock) * product.purchasePrice;
          const newVal = addQty * item.unitCost;
          const newAvgCost = newStock > 0 ? (oldVal + newVal) / newStock : item.unitCost;

          await db.products.update(product.id, {
            currentStock: newStock,
            purchasePrice: Number(newAvgCost.toFixed(2)),
            updatedAt: now
          });

          await db.inventoryMovements.add({
            id: 'mov_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            businessId: purchaseData.businessId,
            productId: product.id,
            productName: product.name,
            type: 'purchase',
            quantity: addQty,
            previousStock: prevStock,
            newStock: newStock,
            unitCost: item.unitCost,
            totalValue: item.totalCost,
            referenceId: purchaseData.purchaseInvoiceNumber,
            reason: `Stock received under invoice #${purchaseData.purchaseInvoiceNumber}`,
            recordedByUserId: user.id,
            recordedByUserName: user.fullName,
            createdAt: now
          });
        }
      }

      // 2. Update Supplier balances
      const supplier = await db.suppliers.get(purchaseData.supplierId);
      if (supplier) {
        const newPurchased = supplier.totalPurchased + purchaseData.totalAmount;
        const newPaid = supplier.totalPaid + purchaseData.amountPaid;
        const newBalance = Math.max(0, supplier.outstandingBalance + purchaseData.outstandingBalance);

        await db.suppliers.update(supplier.id, {
          totalPurchased: newPurchased,
          totalPaid: newPaid,
          outstandingBalance: newBalance,
          updatedAt: now
        });
      }

      const fullPurchase: Purchase = {
        ...purchaseData,
        id: purchaseId,
        createdAt: now
      };
      await db.purchases.add(fullPurchase);

      if (purchaseData.amountPaid > 0) {
        await db.supplierPayments.add({
          id: 'spay_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          businessId: purchaseData.businessId,
          supplierId: purchaseData.supplierId,
          supplierName: purchaseData.supplierName,
          purchaseId: purchaseId,
          amountPaid: purchaseData.amountPaid,
          paymentMethod: purchaseData.paymentMethod === 'credit' ? 'cash' : (purchaseData.paymentMethod === 'split' ? 'cash' : purchaseData.paymentMethod),
          notes: `Initial payment for purchase ${purchaseData.purchaseInvoiceNumber}`,
          recordedByUserId: user.id,
          recordedByUserName: user.fullName,
          createdAt: now
        });
      }

      await db.auditLogs.add({
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        businessId: purchaseData.businessId,
        action: 'PURCHASE_RECORDED',
        recordReference: purchaseData.purchaseInvoiceNumber,
        description: `Purchase of GH₵ ${purchaseData.totalAmount.toFixed(2)} recorded from supplier ${purchaseData.supplierName}`,
        userId: user.id,
        userName: user.fullName,
        userRole: user.role,
        timestamp: now,
        details: { purchaseId, total: purchaseData.totalAmount, paid: purchaseData.amountPaid }
      });

      return fullPurchase;
    }
  );
}

// --------------------------------------------------------------------------------
// STOCK ADJUSTMENT & DAMAGED/EXPIRED WRITE-OFFS
// --------------------------------------------------------------------------------
export async function recordStockAdjustment(
  adjustment: {
    businessId: BusinessId;
    productId: string;
    type: 'adjustment' | 'damaged' | 'expiry' | 'return';
    quantityDelta: number; // positive or negative
    reason: string;
  },
  user: User
): Promise<void> {
  assertBusinessAccess(user, adjustment.businessId);

  return await db.transaction(
    'rw',
    [db.products, db.inventoryMovements, db.auditLogs],
    async () => {
      const now = new Date().toISOString();
      const product = await db.products.get(adjustment.productId);
      if (!product) throw new Error('Product not found.');

      const prevStock = product.currentStock;
      const newStock = prevStock + adjustment.quantityDelta;

      await db.products.update(product.id, {
        currentStock: newStock,
        updatedAt: now
      });

      const movementId = 'adj_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      await db.inventoryMovements.add({
        id: movementId,
        businessId: adjustment.businessId,
        productId: product.id,
        productName: product.name,
        type: adjustment.type,
        quantity: adjustment.quantityDelta,
        previousStock: prevStock,
        newStock: newStock,
        unitCost: product.purchasePrice,
        totalValue: Math.abs(adjustment.quantityDelta) * product.purchasePrice,
        referenceId: `ADJ-${Date.now().toString().slice(-6)}`,
        reason: adjustment.reason,
        recordedByUserId: user.id,
        recordedByUserName: user.fullName,
        createdAt: now
      });

      await db.auditLogs.add({
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        businessId: adjustment.businessId,
        action: `STOCK_${adjustment.type.toUpperCase()}`,
        recordReference: product.codeSku,
        description: `Stock adjusted for ${product.name} (${adjustment.quantityDelta > 0 ? '+' : ''}${adjustment.quantityDelta} ${product.unit}). Reason: ${adjustment.reason}`,
        userId: user.id,
        userName: user.fullName,
        userRole: user.role,
        timestamp: now,
        details: { productId: product.id, prevStock, newStock, delta: adjustment.quantityDelta }
      });
    }
  );
}

// --------------------------------------------------------------------------------
// FINANCIAL SUMMARY CALCULATION (Weighted average cost, real DB records)
// --------------------------------------------------------------------------------
export async function getFinancialSummary(
  businessId: BusinessId,
  startDate?: string,
  endDate?: string
): Promise<FinancialSummary> {
  // Query sales
  let salesQuery = db.sales.where('businessId').equals(businessId);
  const allSales = await salesQuery.toArray();

  const validSales = allSales.filter(s => {
    if (s.isReversed) return false;
    if (startDate && s.createdAt < startDate) return false;
    if (endDate && s.createdAt > endDate) return false;
    return true;
  });

  let totalSales = 0;
  let creditSales = 0;
  let costOfGoodsSold = 0;

  for (const s of validSales) {
    totalSales += s.totalAmount;
    creditSales += s.outstandingBalance;

    for (const item of s.items) {
      let qty = item.quantity;
      if (businessId === 'drinks' && item.unitType === 'crate' && item.bottlesCount) {
        qty = item.quantity; // item.costPrice is crate cost
      }
      costOfGoodsSold += qty * item.costPrice;
    }
  }

  // Payments received
  const paymentsQuery = db.customerPayments.where('businessId').equals(businessId);
  const allPayments = await paymentsQuery.toArray();
  const validPayments = allPayments.filter(p => {
    if (startDate && p.createdAt < startDate) return false;
    if (endDate && p.createdAt > endDate) return false;
    return true;
  });

  let totalReceived = 0;
  let cashReceived = 0;
  let momoReceived = 0;
  let bankReceived = 0;

  for (const p of validPayments) {
    totalReceived += p.amountPaid;
    if (p.paymentMethod === 'cash') cashReceived += p.amountPaid;
    else if (p.paymentMethod === 'momo') momoReceived += p.amountPaid;
    else if (p.paymentMethod === 'bank') bankReceived += p.amountPaid;
  }

  // Purchases
  const purchasesQuery = db.purchases.where('businessId').equals(businessId);
  const allPurchases = await purchasesQuery.toArray();
  const validPurchases = allPurchases.filter(p => {
    if (p.isReversed) return false;
    if (startDate && p.createdAt < startDate) return false;
    if (endDate && p.createdAt > endDate) return false;
    return true;
  });

  let totalPurchases = 0;
  let totalSupplierPaid = 0;
  let totalSupplierDebt = 0;
  for (const pur of validPurchases) {
    totalPurchases += pur.totalAmount;
    totalSupplierPaid += pur.amountPaid;
    totalSupplierDebt += pur.outstandingBalance;
  }

  // Expenses
  const expQuery = db.expenses.where('businessId').equals(businessId);
  const allExpenses = await expQuery.toArray();
  const validExpenses = allExpenses.filter(e => {
    if (startDate && e.createdAt < startDate) return false;
    if (endDate && e.createdAt > endDate) return false;
    return true;
  });

  let totalExpenses = 0;
  for (const e of validExpenses) {
    totalExpenses += e.amount;
  }

  // Customers debt sum
  const customers = await db.customers.where('businessId').equals(businessId).toArray();
  const totalCustomerDebt = customers.reduce((sum, c) => sum + (c.outstandingDebt || 0), 0);

  // Products & Inventory value
  const products = await db.products.where('businessId').equals(businessId).filter(p => p.isActive).toArray();
  let inventoryValue = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  for (const prod of products) {
    const stock = Math.max(0, prod.currentStock);
    inventoryValue += stock * prod.purchasePrice;
    if (stock <= 0) {
      outOfStockCount++;
    } else if (stock <= prod.minStockLevel) {
      lowStockCount++;
    }
  }

  const grossProfit = totalSales - costOfGoodsSold;
  const netProfit = grossProfit - totalExpenses;

  return {
    totalSales,
    totalReceived,
    cashReceived,
    momoReceived,
    bankReceived,
    creditSales,
    totalCustomerDebt,
    totalPurchases,
    totalSupplierPaid,
    totalSupplierDebt,
    totalExpenses,
    costOfGoodsSold,
    grossProfit,
    netProfit,
    inventoryValue,
    totalProductsCount: products.length,
    lowStockCount,
    outOfStockCount
  };
}

// --------------------------------------------------------------------------------
// BACKUP & RESTORE UTILITIES
// --------------------------------------------------------------------------------
export async function createFullBackup(): Promise<{ blob: Blob; filename: string; stats: any }> {
  const exportData: Record<string, any[]> = {};
  let totalRecords = 0;

  for (const table of db.tables) {
    const records = await table.toArray();
    exportData[table.name] = records;
    totalRecords += records.length;
  }

  const backupPayload = {
    app: 'IBMS_GHANA_INTEGRATED_BUSINESS_MANAGEMENT',
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    recordCount: totalRecords,
    data: exportData
  };

  const jsonString = JSON.stringify(backupPayload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const dateFormatted = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `IBMS-Ghana-Backup-${dateFormatted}.json`;

  // Log in backup history
  await db.backupHistory.add({
    id: 'bck_' + Date.now(),
    filename,
    date: new Date().toISOString(),
    recordCount: totalRecords,
    sizeBytes: blob.size,
    backupType: 'manual',
    status: 'success'
  });

  // Update app settings last backup time
  await db.appSettings.update('global_settings', {
    lastBackupAt: new Date().toISOString()
  });

  return {
    blob,
    filename,
    stats: {
      totalRecords,
      sizeBytes: blob.size
    }
  };
}

export async function restoreFullBackup(
  jsonText: string,
  user: User
): Promise<{ success: boolean; recordsRestored: number; message: string }> {
  if (user.role !== 'admin') {
    throw new Error('Only an administrator can restore system backups.');
  }

  const parsed = JSON.parse(jsonText);
  if (!parsed || !parsed.app?.includes('IBMS_GHANA') || !parsed.data) {
    throw new Error('Invalid or corrupted IBMS backup file format.');
  }

  return await db.transaction('rw', db.tables, async () => {
    let count = 0;
    for (const [tableName, rows] of Object.entries(parsed.data)) {
      const table = db.table(tableName);
      if (table && Array.isArray(rows)) {
        await table.clear();
        if (rows.length > 0) {
          await table.bulkPut(rows);
          count += rows.length;
        }
      }
    }

    await logAuditEvent(
      'system',
      'BACKUP_RESTORED',
      'SYSTEM_RESTORE',
      `Full system backup restored by administrator ${user.fullName} (${count} records imported)`,
      user
    );

    return {
      success: true,
      recordsRestored: count,
      message: `Successfully restored ${count} business records from backup.`
    };
  });
}
