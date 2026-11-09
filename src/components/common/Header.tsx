import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { type BusinessProfile, type Sale, type Customer } from '../../types';
import { db } from '../../db';
import { GlobalSearch } from './GlobalSearch';
import {
  Building2,
  Wine,
  Shield,
  LogOut,
  Repeat,
  Download,
  Clock,
  User as UserIcon,
  Bell,
  Menu,
  ChevronDown
} from 'lucide-react';
import { formatDate } from '../../utils/formatters';

interface HeaderProps {
  onOpenBusinessSwitcher?: () => void;
  onOpenMobileMenu?: () => void;
  onNavigate?: (tab: string) => void;
  onOpenReceipt?: (sale: Sale) => void;
  onOpenStatement?: (customer: Customer) => void;
  onRecordPaymentForCustomer?: (customer: Customer) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenBusinessSwitcher,
  onOpenMobileMenu,
  onNavigate,
  onOpenReceipt,
  onOpenStatement,
  onRecordPaymentForCustomer
}) => {
  const { currentUser, activeBusiness, canSwitchBusiness, logout, sessionTimeRemaining } = useAuth();
  const { triggerBackupNow } = useNotification();
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');
  const [profile, setProfile] = useState<BusinessProfile | null>(null);

  // Live Accra clock
  useEffect(() => {
    const updateTime = () => {
      const time = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Accra',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }).format(new Date());
      setCurrentTimeStr(time);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch business profile
  useEffect(() => {
    async function loadProfile() {
      const p = await db.businessProfiles.get(activeBusiness);
      if (p) setProfile(p);
    }
    loadProfile();
  }, [activeBusiness]);

  const isBuilding = activeBusiness === 'building';

  // Role display label
  const roleLabel =
    currentUser?.role === 'admin'
      ? 'Administrator'
      : currentUser?.role === 'manager'
      ? 'Manager'
      : 'Salesperson';

  // Business theme colors
  // Building: Navy #142D4E / Royal Blue #2563EB
  // Drinks: Teal #0D9488 / Emerald #059669
  const headerTheme = isBuilding
    ? 'bg-[#142D4E] text-white border-b border-blue-950 shadow-md'
    : 'bg-[#0D9488] text-white border-b border-teal-800 shadow-md';

  return (
    <header className={`${headerTheme} sticky top-0 z-40 px-4 py-2.5 transition-colors duration-300`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Business Branding & Logo */}
        <div className="flex items-center gap-3">
          {onOpenMobileMenu && (
            <button
              onClick={onOpenMobileMenu}
              className="md:hidden p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-xs border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
            {isBuilding ? (
              <Building2 className="w-6 h-6 text-amber-300" />
            ) : (
              <Wine className="w-6 h-6 text-emerald-200" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white line-clamp-1">
                {profile?.name || (isBuilding ? 'Akwaaba Building Materials Supply' : 'Oasis Soft Drinks & Minerals Depot')}
              </h1>
              <span
                className={`hidden sm:inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                  isBuilding
                    ? 'bg-blue-900/60 text-blue-200 border-blue-400/30'
                    : 'bg-emerald-900/60 text-emerald-100 border-emerald-400/30'
                }`}
              >
                {isBuilding ? 'Building Materials' : 'Soft Drinks & Minerals'}
              </span>
            </div>
            <p className="text-[11px] text-white/70 line-clamp-1 hidden md:block">
              {profile?.tagline || (isBuilding ? 'Cement, Iron Rods, Roofing & Hardware' : 'Beverages, Packs & Empty Container Tracking')}
            </p>
          </div>
        </div>

        {/* Center: Global Search Bar */}
        <div className="flex-1 max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg mx-1 sm:mx-3">
          <GlobalSearch
            onNavigate={onNavigate}
            onOpenReceipt={onOpenReceipt}
            onOpenStatement={onOpenStatement}
            onRecordPaymentForCustomer={onRecordPaymentForCustomer}
          />
        </div>

        {/* Live Accra Clock & Date (visible on larger screens) */}
        <div className="hidden xl:flex items-center gap-2 px-3 py-1 rounded-xl bg-black/20 border border-white/10 text-xs text-white/90 shrink-0">
          <Clock className="w-3.5 h-3.5 text-amber-300" />
          <span className="font-medium">{formatDate(new Date())}</span>
          <span className="text-white/40">•</span>
          <span className="font-mono font-semibold tracking-wide text-white">{currentTimeStr}</span>
          <span className="text-[10px] text-white/60 bg-white/10 px-1.5 py-0.2 rounded font-sans">Accra</span>
        </div>

        {/* Right: User Profile, Business Switcher (Admin Only), Backup, Logout */}
        <div className="flex items-center gap-2.5">
          {/* Business Switcher - STRICTLY ADMINISTRATOR ONLY */}
          {canSwitchBusiness && (
            <button
              onClick={onOpenBusinessSwitcher}
              title="Switch Business Module (Administrator Only)"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-xs font-semibold text-white transition-all shadow-xs cursor-pointer"
            >
              <Repeat className="w-3.5 h-3.5 text-amber-300" />
              <span className="hidden sm:inline">Switch Business</span>
              <ChevronDown className="w-3 h-3 text-white/70" />
            </button>
          )}

          {/* Quick Backup for Admin */}
          {currentUser?.role === 'admin' && (
            <button
              onClick={triggerBackupNow}
              title="Download Full Database Backup to Computer"
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-medium text-white transition-all flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-blue-200" />
              <span className="hidden xl:inline">Backup</span>
            </button>
          )}

          {/* User info badge */}
          <div className="flex items-center gap-2 pl-2 border-l border-white/20">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white shrink-0 font-bold text-xs uppercase border border-white/30">
              {currentUser?.fullName.charAt(0) || 'U'}
            </div>
            <div className="hidden sm:block text-left text-xs">
              <span className="font-semibold text-white block leading-tight truncate max-w-[120px]">
                {currentUser?.fullName.split(' ')[0]}
              </span>
              <span className="text-[10px] text-white/75 font-medium leading-none block">
                {roleLabel}
              </span>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={logout}
            title="Log Out of IBMS"
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-300/30 text-rose-100 hover:text-white text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};
