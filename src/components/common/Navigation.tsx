import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Layers,
  History,
  Users,
  CreditCard,
  Truck,
  Receipt,
  FileBarChart,
  Boxes,
  AlertTriangle,
  UserCog,
  FileText,
  Database,
  Sliders
} from 'lucide-react';

interface NavigationProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  isAdminView?: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({ currentTab, onSelectTab, isAdminView }) => {
  const { activeBusiness, currentUser } = useAuth();
  const isBuilding = activeBusiness === 'building';

  // Live query for items below designated reorder level
  const stockAlerts = useLiveQuery(
    async () => {
      const prods = await db.products
        .where('businessId')
        .equals(activeBusiness)
        .filter(p => p.isActive)
        .toArray();

      const lowItems = prods.filter(p => p.currentStock <= p.minStockLevel && p.currentStock > 0);
      const outItems = prods.filter(p => p.currentStock <= 0);

      return {
        lowCount: lowItems.length,
        outCount: outItems.length,
        totalAlerts: lowItems.length + outItems.length,
        itemsList: [...outItems, ...lowItems].map(p => `${p.name} (${p.currentStock}/${p.minStockLevel} ${p.unit})`)
      };
    },
    [activeBusiness],
    { lowCount: 0, outCount: 0, totalAlerts: 0, itemsList: [] }
  );

  interface NavItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    highlight?: boolean;
    badge?: number;
    badgeType?: 'warning' | 'critical';
    badgeTitle?: string;
  }

  const alertCount = stockAlerts?.totalAlerts || 0;
  const alertBadgeType = (stockAlerts?.outCount || 0) > 0 ? 'critical' : 'warning';
  const alertTooltip = alertCount > 0
    ? `${alertCount} item${alertCount > 1 ? 's' : ''} below reorder level (${stockAlerts?.outCount || 0} out of stock)`
    : undefined;

  // Navigation items for Building Materials
  const buildingTabs: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'pos', label: 'Point of Sale (POS)', icon: <ShoppingCart className="w-4 h-4" /> },
    {
      id: 'products',
      label: 'Products & SKUs',
      icon: <Package className="w-4 h-4" />,
      badge: alertCount > 0 ? alertCount : undefined,
      badgeType: alertBadgeType,
      badgeTitle: alertTooltip
    },
    {
      id: 'inventory',
      label: 'Stock & Movements',
      icon: <Layers className="w-4 h-4" />,
      badge: alertCount > 0 ? alertCount : undefined,
      badgeType: alertBadgeType,
      badgeTitle: alertTooltip
    },
    { id: 'sales', label: 'Sales History', icon: <History className="w-4 h-4" /> },
    { id: 'customers', label: 'Customers & Debts', icon: <Users className="w-4 h-4" /> },
    { id: 'payments', label: 'Customer Payments', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'purchases', label: 'Suppliers & Purchases', icon: <Truck className="w-4 h-4" /> },
    { id: 'expenses', label: 'Expenses', icon: <Receipt className="w-4 h-4" /> },
    { id: 'reports', label: 'Financial Reports', icon: <FileBarChart className="w-4 h-4" /> }
  ];

  // Navigation items for Soft Drinks & Minerals
  const drinksTabs: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'pos', label: 'Point of Sale (POS)', icon: <ShoppingCart className="w-4 h-4" /> },
    {
      id: 'products',
      label: 'Beverages & Units',
      icon: <Package className="w-4 h-4" />,
      badge: alertCount > 0 ? alertCount : undefined,
      badgeType: alertBadgeType,
      badgeTitle: alertTooltip
    },
    { id: 'containers', label: 'Container Logistics', icon: <Boxes className="w-4 h-4" />, highlight: true },
    {
      id: 'inventory',
      label: 'Inventory & Stock',
      icon: <Layers className="w-4 h-4" />,
      badge: alertCount > 0 ? alertCount : undefined,
      badgeType: alertBadgeType,
      badgeTitle: alertTooltip
    },
    { id: 'expiry', label: 'Expiry & Damaged', icon: <AlertTriangle className="w-4 h-4" /> },
    { id: 'sales', label: 'Sales History', icon: <History className="w-4 h-4" /> },
    { id: 'customers', label: 'Customers & Debts', icon: <Users className="w-4 h-4" /> },
    { id: 'payments', label: 'Customer Payments', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'purchases', label: 'Suppliers & Purchases', icon: <Truck className="w-4 h-4" /> },
    { id: 'expenses', label: 'Expenses', icon: <Receipt className="w-4 h-4" /> },
    { id: 'reports', label: 'Financial Reports', icon: <FileBarChart className="w-4 h-4" /> }
  ];

  // Navigation items for System Admin
  const adminTabs: NavItem[] = [
    { id: 'admin_users', label: 'User Management', icon: <UserCog className="w-4 h-4" /> },
    { id: 'admin_audit', label: 'Audit Logs', icon: <FileText className="w-4 h-4" /> },
    { id: 'admin_backup', label: 'Backup & Restore', icon: <Database className="w-4 h-4" /> },
    { id: 'admin_settings', label: 'Business Settings', icon: <Sliders className="w-4 h-4" /> }
  ];

  const tabs = isAdminView ? adminTabs : isBuilding ? buildingTabs : drinksTabs;

  return (
    <nav className="bg-white border-b border-slate-200 px-4 shadow-2xs overflow-x-auto scrollbar-none">
      <div className="max-w-7xl mx-auto flex items-center gap-1.5 py-1.5 min-w-max">
        {tabs.map(tab => {
          const isActive = currentTab === tab.id;
          let activeClass = '';
          if (isActive) {
            if (isAdminView) {
              activeClass = 'bg-slate-900 text-white font-bold shadow-xs';
            } else if (isBuilding) {
              activeClass = 'bg-[#142D4E] text-white font-bold shadow-xs';
            } else {
              activeClass = 'bg-[#0D9488] text-white font-bold shadow-xs';
            }
          } else {
            activeClass = 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium';
          }

          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs transition-all cursor-pointer whitespace-nowrap ${activeClass}`}
              title={tab.badgeTitle}
            >
              {tab.icon}
              <span>{tab.label}</span>

              {/* Notification badge for items below reorder level */}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none shadow-xs transition-all ${
                    tab.badgeType === 'critical'
                      ? 'bg-rose-500 text-white animate-pulse ring-2 ring-rose-300/50'
                      : 'bg-amber-500 text-white animate-pulse ring-2 ring-amber-300/50'
                  }`}
                >
                  <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                  <span>{tab.badge}</span>
                </span>
              )}

              {tab.highlight && !isActive && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </button>
          );
        })}

        {/* Global Reorder Alert Banner Indicator Chip in Navigation Bar */}
        {!isAdminView && alertCount > 0 && (
          <button
            onClick={() => onSelectTab('inventory')}
            className={`ml-2 flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer animate-pulse border ${
              alertBadgeType === 'critical'
                ? 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100 hover:border-rose-300'
                : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100 hover:border-amber-300'
            }`}
            title={`Click to view low stock items:\n${stockAlerts?.itemsList.slice(0, 5).join('\n') || ''}`}
          >
            <span className="relative flex h-2 w-2 shrink-0">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  alertBadgeType === 'critical' ? 'bg-rose-400' : 'bg-amber-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  alertBadgeType === 'critical' ? 'bg-rose-500' : 'bg-amber-500'
                }`}
              />
            </span>
            <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${
              alertBadgeType === 'critical' ? 'text-rose-600' : 'text-amber-600'
            }`} />
            <span>
              {alertCount} Below Reorder Level
            </span>
          </button>
        )}

        {/* Admin Section Tab Toggle (Admin Only) */}
        {currentUser?.role === 'admin' && (
          <div className="ml-auto pl-2 border-l border-slate-200">
            <button
              onClick={() => onSelectTab(isAdminView ? 'dashboard' : 'admin_users')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                isAdminView
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <UserCog className="w-3.5 h-3.5 text-blue-600" />
              <span>{isAdminView ? 'Back to Operations' : 'Admin Controls'}</span>
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};
