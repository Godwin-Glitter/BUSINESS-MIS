import React from 'react';
import { useNotification } from '../../context/NotificationContext';
import { Database, Clock, X, ShieldCheck, Download } from 'lucide-react';

export const BackupReminderModal: React.FC = () => {
  const { isBackupReminderOpen, triggerBackupNow, snoozeReminder, dismissReminder } = useNotification();

  if (!isBackupReminderOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-white">Daily Backup Scheduled Reminder</h3>
            <p className="text-xs text-slate-300">Africa/Accra Standard 5:00 PM Business Safeguard</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex items-start gap-4 mb-5">
            <div className="p-2.5 rounded-full bg-amber-50 text-amber-600 shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-semibold text-slate-900 mb-1">
                Your daily business backup is due. Would you like to back up your business records now?
              </h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                Backing up preserves both <strong>Building Materials</strong> and <strong>Soft Drinks & Minerals</strong> sales, inventory, debts, payments, container records, and audit logs safely on this computer or external USB storage.
              </p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-6 text-xs text-slate-600 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>The backup file will be saved directly into your computer's Downloads folder as a secure JSON snapshot.</span>
          </div>

          {/* Action Buttons: Exact 3 options specified in requirement */}
          <div className="flex flex-col sm:flex-row gap-2.5 justify-end">
            <button
              onClick={dismissReminder}
              className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Dismiss
            </button>
            <button
              onClick={snoozeReminder}
              className="px-4 py-2.5 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl border border-amber-200 transition-colors cursor-pointer"
            >
              Remind Me Later (30m)
            </button>
            <button
              onClick={triggerBackupNow}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Back Up Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
