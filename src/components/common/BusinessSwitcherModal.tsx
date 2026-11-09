import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { type BusinessId } from '../../types';
import { Building2, Wine, Settings, ShieldCheck, X, Check, ArrowRight } from 'lucide-react';

interface BusinessSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAdminSection?: (section: string) => void;
}

export const BusinessSwitcherModal: React.FC<BusinessSwitcherModalProps> = ({
  isOpen,
  onClose,
  onSelectAdminSection
}) => {
  const { activeBusiness, setActiveBusiness, currentUser } = useAuth();

  if (!isOpen || currentUser?.role !== 'admin') return null;

  const handleSelectBusiness = (biz: BusinessId) => {
    setActiveBusiness(biz);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Administrator Business Selector</h3>
              <p className="text-xs text-slate-300">Switch between independent business workspaces</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-xs text-slate-500 mb-4">
            As an Administrator, you have full privileges to oversee and manage both business branches independently. Records and reports remain strictly separated.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Card 1: Building Materials */}
            <div
              onClick={() => handleSelectBusiness('building')}
              className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden group ${
                activeBusiness === 'building'
                  ? 'border-blue-600 bg-blue-50/50 shadow-md ring-2 ring-blue-500/20'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {activeBusiness === 'building' && (
                <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">
                  <Check className="w-3.5 h-3.5" />
                </div>
              )}
              <div className="w-12 h-12 rounded-2xl bg-[#142D4E] text-white flex items-center justify-center mb-4 shadow-sm group-hover:scale-105 transition-transform">
                <Building2 className="w-6 h-6 text-amber-300" />
              </div>
              <h4 className="font-bold text-base text-slate-900 mb-1">Building Materials</h4>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Cement, Iron Rods, Roofing Sheets, Nails, Paints, Plumbing, Electricals, Blocks & Hardware.
              </p>
              <div className="flex items-center text-xs font-semibold text-blue-700 gap-1 group-hover:translate-x-1 transition-transform">
                <span>Enter Workspace</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Card 2: Soft Drinks & Minerals */}
            <div
              onClick={() => handleSelectBusiness('drinks')}
              className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden group ${
                activeBusiness === 'drinks'
                  ? 'border-teal-600 bg-teal-50/50 shadow-md ring-2 ring-teal-500/20'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {activeBusiness === 'drinks' && (
                <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs">
                  <Check className="w-3.5 h-3.5" />
                </div>
              )}
              <div className="w-12 h-12 rounded-2xl bg-[#0D9488] text-white flex items-center justify-center mb-4 shadow-sm group-hover:scale-105 transition-transform">
                <Wine className="w-6 h-6 text-white" />
              </div>
              <h4 className="font-bold text-base text-slate-900 mb-1">Soft Drinks & Minerals</h4>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Beverages, Malta, Water, Energy Drinks, Full & Empty Crate Tracking, Bottle Deposits.
              </p>
              <div className="flex items-center text-xs font-semibold text-teal-700 gap-1 group-hover:translate-x-1 transition-transform">
                <span>Enter Workspace</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* Quick link to System Admin Settings */}
          {onSelectAdminSection && (
            <div className="border-t border-slate-200 pt-4 flex justify-between items-center text-xs text-slate-600">
              <span className="font-medium">System Configuration:</span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onSelectAdminSection('users');
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 font-semibold text-slate-800 transition-colors cursor-pointer"
                >
                  Manage Users
                </button>
                <button
                  onClick={() => {
                    onSelectAdminSection('backup');
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 font-semibold text-slate-800 transition-colors cursor-pointer"
                >
                  Backup & Restore
                </button>
                <button
                  onClick={() => {
                    onSelectAdminSection('audit');
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 font-semibold text-slate-800 transition-colors cursor-pointer"
                >
                  Audit Logs
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
