import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { type BackupRecord, type AppSettings } from '../../types';
import { db, createFullBackup, restoreFullBackup } from '../../db';
import { formatDateTime } from '../../utils/formatters';
import {
  Database,
  Download,
  Upload,
  Clock,
  ShieldCheck,
  AlertTriangle,
  History,
  CheckCircle2,
  Settings,
  HardDrive
} from 'lucide-react';

export const BackupRestoreView: React.FC = () => {
  const { currentUser } = useAuth();
  const { showToast } = useNotification();

  const [history, setHistory] = useState<BackupRecord[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [reminderTime, setReminderTime] = useState('17:00');
  const [reminderEnabled, setReminderEnabled] = useState(true);

  // Restore State
  const [selectedFileText, setSelectedFileText] = useState<string | null>(null);
  const [restoreFileName, setRestoreFileName] = useState('');
  const [isConfirmingRestore, setIsConfirmingRestore] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const loadData = async () => {
    try {
      const hist = await db.backupHistory.reverse().toArray();
      setHistory(hist);

      const appSet = await db.appSettings.get('global_settings');
      if (appSet) {
        setSettings(appSet);
        setReminderTime(appSet.backupReminderTime || '17:00');
        setReminderEnabled(appSet.backupReminderEnabled ?? true);
      }
    } catch (err) {
      console.error('Error loading backup settings:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleManualBackup = async () => {
    try {
      const { blob, filename, stats } = await createFullBackup();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast(`Backup downloaded! Saved ${stats.totalRecords} business records.`, 'success');
      loadData();
    } catch (err: any) {
      showToast(`Backup failed: ${err.message}`, 'error');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreFileName(file.name);
    const reader = new FileReader();
    reader.onload = evt => {
      const content = evt.target?.result as string;
      setSelectedFileText(content);
      setIsConfirmingRestore(true);
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = async () => {
    if (!selectedFileText || !currentUser) return;

    setIsRestoring(true);
    try {
      const result = await restoreFullBackup(selectedFileText, currentUser);
      showToast(result.message, 'success');
      setIsConfirmingRestore(false);
      setSelectedFileText(null);
      setRestoreFileName('');
      loadData();
      // Reload page to reflect completely restored state
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      showToast(`Restoration failed: ${err.message}`, 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleSaveReminderSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await db.appSettings.update('global_settings', {
        backupReminderTime: reminderTime,
        backupReminderEnabled: reminderEnabled
      });
      showToast('Daily backup schedule settings updated successfully!', 'success');
      loadData();
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
              Database Backup & Disaster Recovery
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Preserve all business records persistently. Export snapshots to USB drives or local offline storage.
          </p>
        </div>

        <button
          onClick={handleManualBackup}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Download Master Backup Now</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: Restore from File */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-sm text-slate-900">Restore Records from Backup File</h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Select a verified <code>.json</code> IBMS backup file. The system will validate all data structures before prompting for confirmation.
          </p>

          <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl p-6 text-center transition-colors">
            <HardDrive className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <label className="inline-block px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors">
              <span>Choose Backup File...</span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
            <span className="block text-[11px] text-slate-400 mt-2">
              Accepts JSON files generated by IBMS Ghana
            </span>
          </div>

          {/* Confirm restore warning dialog */}
          {isConfirmingRestore && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-3 animate-fade-in text-xs">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-900 block text-sm">
                    Confirm Full System Restoration?
                  </span>
                  <p className="text-amber-800 mt-1 leading-relaxed">
                    File selected: <strong>{restoreFileName}</strong>.
                    Restoration will replace existing local records with the data from the backup snapshot.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-amber-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsConfirmingRestore(false);
                    setSelectedFileText(null);
                  }}
                  className="px-3 py-1.5 bg-white text-slate-700 font-semibold rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isRestoring}
                  onClick={handleExecuteRestore}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {isRestoring ? 'Restoring Records...' : 'Proceed with Restoration'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Scheduled Reminder Settings */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-sm text-slate-900">Daily Scheduled Backup Reminder</h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Configure the automated end-of-day backup reminder. Default schedule is <strong>5:00 PM Africa/Accra</strong>.
          </p>

          <form onSubmit={handleSaveReminderSettings} className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 block">Daily In-App Reminder:</span>
                <span className="text-[11px] text-slate-500">Prompts user when due if app is open</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={reminderEnabled}
                  onChange={e => setReminderEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Reminder Time (Accra):
                </label>
                <input
                  type="time"
                  value={reminderTime}
                  onChange={e => setReminderTime(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Timezone:
                </label>
                <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-medium text-slate-600">
                  Africa/Accra (GMT+0)
                </div>
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl cursor-pointer"
              >
                Save Schedule
              </button>
            </div>
          </form>

          <div className="text-xs text-slate-500 flex items-center justify-between pt-1">
            <span>Last Successful Backup:</span>
            <span className="font-semibold text-slate-800">
              {settings?.lastBackupAt ? formatDateTime(settings.lastBackupAt) : 'None recorded yet'}
            </span>
          </div>
        </div>
      </div>

      {/* Backup History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center gap-2">
          <History className="w-4 h-4 text-slate-600" />
          <h3 className="font-bold text-sm text-slate-900">Backup & Snapshot History</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left divide-y divide-slate-200">
            <thead className="bg-slate-50 font-bold text-slate-600 uppercase">
              <tr>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Filename</th>
                <th className="py-3 px-4 text-center">Records Saved</th>
                <th className="py-3 px-4 text-right">File Size</th>
                <th className="py-3 px-4 text-center">Trigger Mode</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No backup activities logged yet.
                  </td>
                </tr>
              ) : (
                history.map(b => (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{formatDateTime(b.date)}</td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{b.filename}</td>
                    <td className="py-3 px-4 text-center font-bold text-blue-700">{b.recordCount}</td>
                    <td className="py-3 px-4 text-right text-slate-600 font-mono">
                      {(b.sizeBytes / 1024).toFixed(1)} KB
                    </td>
                    <td className="py-3 px-4 text-center capitalize text-slate-600">{b.backupType}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                        SUCCESS
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
