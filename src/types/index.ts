export type BusinessId = 'building' | 'drinks';
export type UserRole = 'admin' | 'manager' | 'salesperson';
export type UserStatus = 'active' | 'inactive';
export type AssignedBusiness = 'all' | 'building' | 'drinks';

export interface User {
  id: string;
  fullName: string;
  username: string;
  passwordHash: string;
  salt: string;
  assignedBusiness: AssignedBusiness;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  lastLoginAt?: string;
}

export interface BusinessProfile {
  id: BusinessId;
  name: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  tinNumber?: string;
  receiptNotes?: string;
  currency: string;
  logoUrl?: string;
  updatedAt: string;
}

export interface ProductCategory {
  id: string;
  businessId: BusinessId;
  name: string;
  description?: string;
}

export interface Product {
  id: string;
  businessId: BusinessId;
  name: string;
  brand?: string;
  codeSku: string;
  categoryId: string;
  categoryName: string;
  unit: string; // e.g. Bags, Pieces, Bundles, Tonnes, Bottle, Crate, Pack
  purchasePrice: number;
  sellingPrice: number;
  currentStock: number;
  minStockLevel: number;
  openingStock: number;
  isActive: boolean;
  // Specific for Soft Drinks & Minerals
  expiryDate?: string;
  packagingConversionQty?: number; // e.g. 24 bottles per crate
  cratePrice?: number;
  packPrice?: number;
  tracksCrate?: boolean; // True if this item has bottles/crates
  containerTypeId?: string;
  createdAt: string;
  updatedAt: string;
}

export type MovementType =
  | 'purchase'
  | 'sale'
  | 'return'
  | 'damaged'
  | 'adjustment'
  | 'expiry'
  | 'cancellation_reverse';

export interface InventoryMovement {
  id: string;
  businessId: BusinessId;
  productId: string;
  productName: string;
  type: MovementType;
  quantity: number; // positive or negative
  previousStock: number;
  newStock: number;
  unitCost: number;
  totalValue: number;
  referenceId: string;
  reason: string;
  recordedByUserId: string;
  recordedByUserName: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  businessId: BusinessId;
  name: string;
  phone: string;
  address?: string;
  notes?: string;
  creditLimit: number;
  totalPurchased: number;
  totalPaid: number;
  outstandingDebt: number;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  businessId: BusinessId;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  contactPerson?: string;
  totalPurchased: number;
  totalPaid: number;
  outstandingBalance: number;
  createdAt: string;
  updatedAt: string;
}

export type PaymentMethod = 'cash' | 'momo' | 'bank' | 'credit' | 'split';
export type SaleStatus = 'completed' | 'credit' | 'partially_paid' | 'cancelled';

export interface SaleItem {
  productId: string;
  productName: string;
  unit: string;
  unitType?: 'bottle' | 'crate' | 'pack' | 'standard';
  quantity: number;
  unitPrice: number;
  costPrice: number;
  total: number;
  bottlesCount?: number; // For inventory deduction in drinks
}

export interface ContainerTransaction {
  containerId: string;
  containerName: string;
  issuedCrates: number;
  returnedCrates: number;
  depositPerCrate: number;
  netDepositCharge: number; // positive = customer owes deposit, negative = deposit refunded
}

export interface Sale {
  id: string;
  businessId: BusinessId;
  receiptNumber: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  subtotal: number;
  discount: number;
  totalAmount: number;
  amountPaid: number;
  outstandingBalance: number;
  paymentMethod: PaymentMethod;
  momoDetails?: {
    network: 'MTN MoMo' | 'Telecel Cash' | 'AirtelTigo Money';
    reference: string;
  };
  splitDetails?: {
    cash: number;
    momo: number;
    bank: number;
    credit: number;
  };
  status: SaleStatus;
  dueDate?: string;
  items: SaleItem[];
  containerTransactions?: ContainerTransaction[];
  notes?: string;
  recordedByUserId: string;
  recordedByUserName: string;
  isReversed?: boolean;
  reverseReason?: string;
  reversedAt?: string;
  reversedBy?: string;
  createdAt: string;
}

export interface CustomerPayment {
  id: string;
  businessId: BusinessId;
  receiptNumber: string;
  customerId: string;
  customerName: string;
  saleId?: string;
  amountPaid: number;
  paymentMethod: 'cash' | 'momo' | 'bank';
  referenceNumber?: string;
  notes?: string;
  recordedByUserId: string;
  recordedByUserName: string;
  createdAt: string;
}

export interface PurchaseItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  packagingUnit?: string;
  bottlesCount?: number;
}

export interface Purchase {
  id: string;
  businessId: BusinessId;
  purchaseInvoiceNumber: string;
  supplierId: string;
  supplierName: string;
  subtotal: number;
  totalAmount: number;
  amountPaid: number;
  outstandingBalance: number;
  paymentMethod: PaymentMethod;
  status: 'completed' | 'credit' | 'partially_paid' | 'cancelled';
  items: PurchaseItem[];
  notes?: string;
  recordedByUserId: string;
  recordedByUserName: string;
  isReversed?: boolean;
  reverseReason?: string;
  reversedAt?: string;
  reversedBy?: string;
  createdAt: string;
}

export interface SupplierPayment {
  id: string;
  businessId: BusinessId;
  supplierId: string;
  supplierName: string;
  purchaseId?: string;
  amountPaid: number;
  paymentMethod: 'cash' | 'momo' | 'bank';
  referenceNumber?: string;
  notes?: string;
  recordedByUserId: string;
  recordedByUserName: string;
  createdAt: string;
}

export type ExpenseCategory =
  | 'Transport'
  | 'Rent'
  | 'Electricity & Utilities'
  | 'Salaries & Wages'
  | 'Repairs & Maintenance'
  | 'Fuel'
  | 'Security'
  | 'Packaging & Materials'
  | 'Miscellaneous';

export interface Expense {
  id: string;
  businessId: BusinessId;
  category: ExpenseCategory;
  amount: number;
  date: string;
  description: string;
  paymentMethod: 'cash' | 'momo' | 'bank';
  recordedByUserId: string;
  recordedByUserName: string;
  receiptRef?: string;
  createdAt: string;
}

// Dedicated soft drinks container management
export interface ContainerType {
  id: string;
  businessId: 'drinks';
  containerName: string; // e.g. "Crate (24 x 300ml RGB)", "Plastic Crate (Pet Bottles)", "Water Dispenser Jar (20L)"
  fullCrates: number;
  emptyCrates: number;
  fullBottles: number;
  emptyBottles: number;
  bottlesPerCrate: number;
  depositPerCrate: number;
  updatedAt: string;
}

export interface ContainerMovement {
  id: string;
  businessId: 'drinks';
  containerId: string;
  containerName: string;
  customerId?: string;
  customerName?: string;
  movementType:
    | 'issued_to_customer'
    | 'returned_by_customer'
    | 'received_from_brewery'
    | 'returned_to_brewery'
    | 'damaged'
    | 'missing';
  cratesCount: number;
  bottlesCount: number;
  depositAmount: number;
  referenceId?: string;
  recordedByUserId: string;
  recordedByUserName: string;
  reason?: string;
  createdAt: string;
}

export interface CustomerContainerBalance {
  id: string;
  businessId: 'drinks';
  customerId: string;
  customerName: string;
  containerId: string;
  containerName: string;
  cratesOwed: number; // Empty crates customer has not yet returned
  totalDepositsHeld: number; // Deposit amount held by business
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  businessId: BusinessId | 'system';
  action: string;
  recordReference: string;
  description: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface AppSettings {
  id: string; // 'global_settings'
  backupReminderTime: string; // '17:00'
  backupReminderEnabled: boolean;
  lastBackupAt?: string;
  snoozedUntil?: string;
  currencySymbol: string;
  timezone: string;
  buildingBusinessName: string;
  drinksBusinessName: string;
}

export interface BackupRecord {
  id: string;
  filename: string;
  date: string;
  recordCount: number;
  sizeBytes: number;
  backupType: 'manual' | 'reminder_prompted';
  status: 'success' | 'restored';
}

export interface FinancialSummary {
  totalSales: number;
  totalReceived: number;
  cashReceived: number;
  momoReceived: number;
  bankReceived: number;
  creditSales: number;
  totalCustomerDebt: number;
  totalPurchases: number;
  totalSupplierPaid: number;
  totalSupplierDebt: number;
  totalExpenses: number;
  costOfGoodsSold: number;
  grossProfit: number;
  netProfit: number;
  inventoryValue: number;
  totalProductsCount: number;
  lowStockCount: number;
  outOfStockCount: number;
}
