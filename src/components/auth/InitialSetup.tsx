import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { Building2, Wine, ShieldCheck, KeyRound, User, Lock, Sparkles, CheckCircle2 } from 'lucide-react';

export const InitialSetup: React.FC = () => {
  const { setupInitialAdmin } = useAuth();
  const { showToast } = useNotification();

  const [fullName, setFullName] = useState('Ing. Kwame Adjei');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Admin@2026');
  const [confirmPassword, setConfirmPassword] = useState('Admin@2026');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim() || !username.trim() || !password) {
      setError('Please fill in all required administrator setup fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters for security.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter carefully.');
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await setupInitialAdmin(fullName, username, password);
      if (success) {
        showToast('Administrator initialized and Ghanaian business databases provisioned!', 'success');
      } else {
        setError('Failed to initialize database. Please check console.');
      }
    } catch (err: any) {
      setError(err.message || 'Setup error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-xl w-full bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-fade-in">
        {/* Banner */}
        <div className="bg-gradient-to-r from-[#142D4E] to-[#0D9488] p-8 text-white text-center relative">
          <div className="inline-flex items-center justify-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-amber-300">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-emerald-200">
              <Wine className="w-6 h-6" />
            </div>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">IBMS Ghana Setup Wizard</h1>
          <p className="text-xs text-white/80 mt-1 max-w-md mx-auto">
            Integrated Business Management System for Building Materials and Soft Drinks & Minerals (Offline-First Local Storage)
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:p-8">
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6 text-xs text-blue-900 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-0.5">Welcome! Configure Your Primary System Administrator</p>
              <p className="text-blue-800 leading-relaxed">
                This administrator will have master privileges over both independent businesses:
                <strong> Akwaaba Building Materials Supply</strong> and <strong>Oasis Soft Drinks & Minerals Depot</strong>.
                Passwords are saved locally using SHA-256 salted encryption.
              </p>
            </div>
          </div>

          {error && (
            <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Administrator Full Name *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="e.g. Ing. Kwame Adjei"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-blue-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Admin Username *
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="e.g. admin"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-blue-600"
                />
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">Case-insensitive login handle</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Master Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Confirm Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-blue-600"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Initializing System...</span>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>Complete Initial Setup & Enter IBMS</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
