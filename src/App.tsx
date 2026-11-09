import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider, useNotification } from './context/NotificationContext';
import { InitialSetup } from './components/auth/InitialSetup';
import { Login } from './components/auth/Login';
import { Header } from './components/common/Header';
import { Navigation } from './components/common/Navigation';
import { ToastContainer } from './components/common/ToastContainer';
import { BackupReminderModal } from './components/common/BackupReminderModal';
import { BusinessSwitcherModal } from './components/common/BusinessSwitcherModal';
import { ReceiptModal } from './components/common/ReceiptModal';
import { CustomerStatementModal } from './components/common/CustomerStatementModal';

// Operational Components
import { BusinessDashboard } from './components/dashboard/BusinessDashboard';
import { POS } from './components/pos/POS';
import { ProductList } from './components/products/ProductList';
import { InventoryManagement } from './components/inventory/InventoryManagement';
import { SalesHistory } from './components/sales/SalesHistory';
import { CustomerList } from './components/customers/CustomerList';
import { CustomerPayments } from './components/customers/CustomerPayments';
import { PurchasesAndSuppliers } from './components/purchases/PurchasesAndSuppliers';
import { ExpenseManagement } from './components/expenses/ExpenseManagement';
import { FinancialReports } from './components/reports/FinancialReports';

// Soft Drinks Specific
import { ContainerManagement } from './components/drinks/ContainerManagement';
import { ExpiryManagement } from './components/drinks/ExpiryManagement';

// Administrator Modules
import { UserManagement } from './components/admin/UserManagement';
import { AuditLogsView } from './components/admin/AuditLogsView';
import { BackupRestoreView } from './components/admin/BackupRestoreView';
import { BusinessSettingsView } from './components/admin/BusinessSettingsView';

import { type Sale, type Customer, type BusinessProfile } from './types';
import { db } from './db';
import { Building2, Wine, Shield } from 'lucide-react';

function AppContent() {
  const { currentUser, isLoading, needsSetup, activeBusiness, setActiveBusiness } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);

  // Modals for receipts & statements
  const [activeReceiptSale, setActiveReceiptSale] = useState<Sale | null>(null);
  const [activeStatementCustomer, setActiveStatementCustomer] = useState<Customer | null>(null);
  const [preselectedPaymentCustomer, setPreselectedPaymentCustomer] = useState<Customer | null>(null);
  const [activeProfile, setActiveProfile] = useState<BusinessProfile | null>(null);

  // Load profile when active business changes
  useEffect(() => {
    async function loadActiveProfile() {
      const p = await db.businessProfiles.get(activeBusiness);
      if (p) setActiveProfile(p);
    }
    loadActiveProfile();
  }, [activeBusiness]);

  // Reset navigation to 'dashboard' whenever authenticated user changes or logs in
  useEffect(() => {
    if (currentUser) {
      setCurrentTab('dashboard');
    }
  }, [currentUser?.id]);

  // Strict tab and route guard: Non-admin workers can NEVER access admin_* tabs
  // and maintain strict business isolation
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role !== 'admin' && currentTab.startsWith('admin_')) {
        setCurrentTab('dashboard');
      }
      if (activeBusiness === 'building' && (currentTab === 'containers' || currentTab === 'expiry')) {
        setCurrentTab('dashboard');
      }
      if (currentUser.role !== 'admin' && currentUser.assignedBusiness !== 'all') {
        if (activeBusiness !== currentUser.assignedBusiness) {
          setActiveBusiness(currentUser.assignedBusiness as any);
        }
      }
    }
  }, [currentUser, currentTab, activeBusiness, setActiveBusiness]);

  // Handle Loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="w-14 h-14 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-white text-lg font-extrabold tracking-tight">IBMS Ghana</h2>
        <p className="text-xs text-slate-400 mt-1">Initializing local offline persistent storage...</p>
      </div>
    );
  }

  // Handle Initial System Setup
  if (needsSetup) {
    return <InitialSetup />;
  }

  // Handle Authentication
  if (!currentUser) {
    return <Login />;
  }

  // Admin view is strictly restricted to administrator users
  const isAdminView = currentUser?.role === 'admin' && currentTab.startsWith('admin_');

  // Callback to trigger receipt modal
  const handleOpenReceipt = (sale: Sale) => {
    setActiveReceiptSale(sale);
  };

  // Callback to trigger customer statement modal
  const handleOpenStatement = (customer: Customer) => {
    setActiveStatementCustomer(customer);
  };

  // Callback to trigger direct customer payment
  const handleRecordPaymentForCustomer = (customer: Customer) => {
    setPreselectedPaymentCustomer(customer);
    setCurrentTab('payments');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* Universal Top Header with Global Search */}
      <Header
        onOpenBusinessSwitcher={() => setIsSwitcherOpen(true)}
        onNavigate={tab => setCurrentTab(tab)}
        onOpenReceipt={handleOpenReceipt}
        onOpenStatement={handleOpenStatement}
        onRecordPaymentForCustomer={handleRecordPaymentForCustomer}
      />

      {/* Navigation Bar */}
      <Navigation
        currentTab={currentTab}
        onSelectTab={tab => setCurrentTab(tab)}
        isAdminView={isAdminView}
      />

      {/* Main Workspace View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {/* Dashboard */}
        {currentTab === 'dashboard' && (
          <BusinessDashboard
            onNavigate={tab => setCurrentTab(tab)}
            onOpenReceipt={handleOpenReceipt}
          />
        )}

        {/* POS */}
        {currentTab === 'pos' && (
          <POS
            onSaleComplete={sale => handleOpenReceipt(sale)}
            isReceiptOpen={!!activeReceiptSale}
          />
        )}

        {/* Products */}
        {currentTab === 'products' && <ProductList />}

        {/* Inventory & Stock Movements */}
        {currentTab === 'inventory' && <InventoryManagement />}

        {/* Container Logistics (Drinks Only) */}
        {currentTab === 'containers' && <ContainerManagement />}

        {/* Expiry & Damaged (Drinks Only) */}
        {currentTab === 'expiry' && <ExpiryManagement />}

        {/* Sales History */}
        {currentTab === 'sales' && (
          <SalesHistory onOpenReceipt={handleOpenReceipt} />
        )}

        {/* Customers */}
        {currentTab === 'customers' && (
          <CustomerList
            onOpenStatement={handleOpenStatement}
            onRecordPaymentForCustomer={handleRecordPaymentForCustomer}
          />
        )}

        {/* Customer Payments */}
        {currentTab === 'payments' && (
          <CustomerPayments
            preselectedCustomer={preselectedPaymentCustomer}
            onClearPreselectedCustomer={() => setPreselectedPaymentCustomer(null)}
          />
        )}

        {/* Suppliers & Purchases */}
        {currentTab === 'purchases' && <PurchasesAndSuppliers />}

        {/* Expenses */}
        {currentTab === 'expenses' && <ExpenseManagement />}

        {/* Reports */}
        {currentTab === 'reports' && <FinancialReports />}

        {/* Admin Section: Users */}
        {currentTab === 'admin_users' && currentUser?.role === 'admin' && <UserManagement />}

        {/* Admin Section: Audit */}
        {currentTab === 'admin_audit' && currentUser?.role === 'admin' && <AuditLogsView />}

        {/* Admin Section: Backup & Restore */}
        {currentTab === 'admin_backup' && currentUser?.role === 'admin' && <BackupRestoreView />}

        {/* Admin Section: Settings */}
        {currentTab === 'admin_settings' && currentUser?.role === 'admin' && <BusinessSettingsView />}
      </main>

      {/* Interactive Modals */}
      <BusinessSwitcherModal
        isOpen={isSwitcherOpen}
        onClose={() => setIsSwitcherOpen(false)}
        onSelectAdminSection={section => {
          if (section === 'users') setCurrentTab('admin_users');
          else if (section === 'backup') setCurrentTab('admin_backup');
          else if (section === 'audit') setCurrentTab('admin_audit');
        }}
      />

      <ReceiptModal
        sale={activeReceiptSale}
        profile={activeProfile}
        onClose={() => setActiveReceiptSale(null)}
      />

      <CustomerStatementModal
        customer={activeStatementCustomer}
        profile={activeProfile}
        onClose={() => setActiveStatementCustomer(null)}
      />

      <BackupReminderModal />
      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </AuthProvider>
  );
}
