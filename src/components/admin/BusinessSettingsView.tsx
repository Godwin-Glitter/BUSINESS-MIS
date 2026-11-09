import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { type BusinessProfile } from '../../types';
import { db, logAuditEvent } from '../../db';
import {
  Sliders,
  Building2,
  Wine,
  Save,
  CheckCircle2,
  Receipt,
  Phone,
  Mail,
  MapPin
} from 'lucide-react';

export const BusinessSettingsView: React.FC = () => {
  const { currentUser } = useAuth();
  const { showToast } = useNotification();

  const [buildingProfile, setBuildingProfile] = useState<BusinessProfile | null>(null);
  const [drinksProfile, setDrinksProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeProfileTab, setActiveProfileTab] = useState<'building' | 'drinks'>('building');

  useEffect(() => {
    async function loadProfiles() {
      setLoading(true);
      try {
        const bld = await db.businessProfiles.get('building');
        const drk = await db.businessProfiles.get('drinks');
        if (bld) setBuildingProfile(bld);
        if (drk) setDrinksProfile(drk);
      } catch (err) {
        console.error('Error loading profiles:', err);
      } finally {
        setLoading(false);
      }
    }
    loadProfiles();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    try {
      const now = new Date().toISOString();
      if (activeProfileTab === 'building' && buildingProfile) {
        await db.businessProfiles.put({
          ...buildingProfile,
          updatedAt: now
        });
        await logAuditEvent('building', 'PROFILE_UPDATED', buildingProfile.name, 'Building Materials business profile updated', currentUser);
        showToast('Building Materials profile updated!', 'success');
      } else if (activeProfileTab === 'drinks' && drinksProfile) {
        await db.businessProfiles.put({
          ...drinksProfile,
          updatedAt: now
        });
        await logAuditEvent('drinks', 'PROFILE_UPDATED', drinksProfile.name, 'Soft Drinks & Minerals business profile updated', currentUser);
        showToast('Soft Drinks & Minerals profile updated!', 'success');
      }
    } catch (err: any) {
      showToast(`Error saving settings: ${err.message}`, 'error');
    }
  };

  const curr = activeProfileTab === 'building' ? buildingProfile : drinksProfile;

  return (
    <div className="space-y-5 pb-12 animate-fade-in">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
              Ghana Business Profiles & Receipt Settings
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure independent company addresses, telephone contacts, GRA TIN numbers, and receipt terms.
          </p>
        </div>
      </div>

      {/* Profile Selector Tabs */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs flex gap-2">
        <button
          onClick={() => setActiveProfileTab('building')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeProfileTab === 'building'
              ? 'bg-[#142D4E] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building2 className="w-4 h-4 text-amber-300" />
          <span>Building Materials Business Profile</span>
        </button>

        <button
          onClick={() => setActiveProfileTab('drinks')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeProfileTab === 'drinks'
              ? 'bg-[#0D9488] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Wine className="w-4 h-4 text-emerald-200" />
          <span>Soft Drinks & Minerals Business Profile</span>
        </button>
      </div>

      {/* Profile Form */}
      {curr && (
        <form onSubmit={handleSaveProfile} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Trading Business Name *
              </label>
              <input
                type="text"
                required
                value={curr.name}
                onChange={e => {
                  const val = e.target.value;
                  if (activeProfileTab === 'building' && buildingProfile) {
                    setBuildingProfile({ ...buildingProfile, name: val });
                  } else if (drinksProfile) {
                    setDrinksProfile({ ...drinksProfile, name: val });
                  }
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:outline-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Business Tagline / Subtitle
              </label>
              <input
                type="text"
                value={curr.tagline}
                onChange={e => {
                  const val = e.target.value;
                  if (activeProfileTab === 'building' && buildingProfile) {
                    setBuildingProfile({ ...buildingProfile, tagline: val });
                  } else if (drinksProfile) {
                    setDrinksProfile({ ...drinksProfile, tagline: val });
                  }
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:outline-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Contact Telephone *
              </label>
              <input
                type="text"
                required
                value={curr.phone}
                onChange={e => {
                  const val = e.target.value;
                  if (activeProfileTab === 'building' && buildingProfile) {
                    setBuildingProfile({ ...buildingProfile, phone: val });
                  } else if (drinksProfile) {
                    setDrinksProfile({ ...drinksProfile, phone: val });
                  }
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:outline-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Official Email
              </label>
              <input
                type="email"
                value={curr.email}
                onChange={e => {
                  const val = e.target.value;
                  if (activeProfileTab === 'building' && buildingProfile) {
                    setBuildingProfile({ ...buildingProfile, email: val });
                  } else if (drinksProfile) {
                    setDrinksProfile({ ...drinksProfile, email: val });
                  }
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:outline-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                GRA Tax Identification (TIN)
              </label>
              <input
                type="text"
                value={curr.tinNumber || ''}
                onChange={e => {
                  const val = e.target.value;
                  if (activeProfileTab === 'building' && buildingProfile) {
                    setBuildingProfile({ ...buildingProfile, tinNumber: val });
                  } else if (drinksProfile) {
                    setDrinksProfile({ ...drinksProfile, tinNumber: val });
                  }
                }}
                placeholder="e.g. P002345678X"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-medium focus:bg-white focus:outline-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Physical Premises Address *
            </label>
            <input
              type="text"
              required
              value={curr.address}
              onChange={e => {
                const val = e.target.value;
                if (activeProfileTab === 'building' && buildingProfile) {
                  setBuildingProfile({ ...buildingProfile, address: val });
                } else if (drinksProfile) {
                  setDrinksProfile({ ...drinksProfile, address: val });
                }
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:outline-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Receipt Footer Terms & Return Policies
            </label>
            <textarea
              rows={2}
              value={curr.receiptNotes || ''}
              onChange={e => {
                const val = e.target.value;
                if (activeProfileTab === 'building' && buildingProfile) {
                  setBuildingProfile({ ...buildingProfile, receiptNotes: val });
                } else if (drinksProfile) {
                  setDrinksProfile({ ...drinksProfile, receiptNotes: val });
                }
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:outline-blue-600"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Configuration</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
