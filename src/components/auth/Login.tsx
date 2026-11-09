import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { Building2, Wine, Lock, User, Eye, EyeOff, ShieldAlert, ArrowRight, CheckCircle2 } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const { showToast } = useNotification();

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Admin@2026');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!username.trim() || !password) {
      setErrorMessage('Please enter both username and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await login(username, password);
      if (!res.success) {
        setErrorMessage(res.error || 'Authentication failed.');
      } else {
        showToast('Login successful. Welcome to IBMS Ghana!', 'success');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error authenticating user.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 sm:p-6">
      {/* Container */}
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#142D4E] to-[#0D9488] p-7 text-white text-center">
          <div className="inline-flex items-center justify-center gap-3 mb-2.5">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-amber-300">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-emerald-200">
              <Wine className="w-6 h-6" />
            </div>
          </div>
          <h2 className="text-xl font-extrabold tracking-tight">IBMS Ghana</h2>
          <p className="text-xs text-white/80 mt-0.5">
            Integrated Dual-Business Management System
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/25 text-[11px] text-emerald-300 border border-emerald-400/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Local & Offline-First Active</span>
          </div>
        </div>

        {/* Login Form */}
        <div className="p-6 sm:p-8">
          {errorMessage && (
            <div className="p-3.5 mb-5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-blue-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-blue-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In to Workplace</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Access Buttons for Verification */}
          <div className="mt-6 pt-5 border-t border-slate-200">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center mb-3">
              One-Click Role Test Logins:
            </p>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill('admin', 'Admin@2026')}
                className="w-full p-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-left text-xs transition-colors flex items-center justify-between cursor-pointer"
              >
                <div>
                  <span className="font-bold text-slate-900 block">Administrator (Full Access)</span>
                  <span className="text-[11px] text-slate-500">User: admin / Pass: Admin@2026</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                  Both Businesses
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('building_worker', 'worker123')}
                className="w-full p-2.5 bg-blue-50/60 hover:bg-blue-100/60 border border-blue-200 rounded-xl text-left text-xs transition-colors flex items-center justify-between cursor-pointer"
              >
                <div>
                  <span className="font-bold text-slate-900 block">Building Materials Worker</span>
                  <span className="text-[11px] text-slate-500">User: building_worker / Pass: worker123</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                  Building Only
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('drinks_worker', 'drinks123')}
                className="w-full p-2.5 bg-teal-50/60 hover:bg-teal-100/60 border border-teal-200 rounded-xl text-left text-xs transition-colors flex items-center justify-between cursor-pointer"
              >
                <div>
                  <span className="font-bold text-slate-900 block">Drinks & Minerals Worker</span>
                  <span className="text-[11px] text-slate-500">User: drinks_worker / Pass: drinks123</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-900">
                  Drinks Only
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
