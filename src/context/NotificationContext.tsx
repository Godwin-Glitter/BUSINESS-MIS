import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { db, createFullBackup } from '../db';
import { useAuth } from './AuthContext';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

interface NotificationContextType {
  toasts: Toast[];
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  removeToast: (id: string) => void;
  isBackupReminderOpen: boolean;
  triggerBackupNow: () => Promise<void>;
  snoozeReminder: () => void;
  dismissReminder: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isBackupReminderOpen, setIsBackupReminderOpen] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    const id = 'toast_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Check backup reminder schedule against Africa/Accra time
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin') return;

    const checkReminder = async () => {
      try {
        const settings = await db.appSettings.get('global_settings');
        if (!settings || !settings.backupReminderEnabled) return;

        // If snoozed and snooze time not passed, skip
        if (settings.snoozedUntil && new Date() < new Date(settings.snoozedUntil)) {
          return;
        }

        // Get Accra current time in HH:mm
        const accraTimeStr = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Africa/Accra',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).format(new Date());

        const [currHours, currMins] = accraTimeStr.split(':').map(Number);
        const [targetHours, targetMins] = settings.backupReminderTime.split(':').map(Number);

        const currMinutesTotal = currHours * 60 + currMins;
        const targetMinutesTotal = targetHours * 60 + targetMins;

        // Check if last backup was already completed today
        let backedUpToday = false;
        if (settings.lastBackupAt) {
          const lastDate = new Date(settings.lastBackupAt).toLocaleDateString('en-GB', { timeZone: 'Africa/Accra' });
          const todayDate = new Date().toLocaleDateString('en-GB', { timeZone: 'Africa/Accra' });
          if (lastDate === todayDate) {
            backedUpToday = true;
          }
        }

        if (!backedUpToday && currMinutesTotal >= targetMinutesTotal) {
          setIsBackupReminderOpen(true);
        }
      } catch (err) {
        console.error('Reminder check error:', err);
      }
    };

    checkReminder();
    const interval = setInterval(checkReminder, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [currentUser]);

  const triggerBackupNow = async () => {
    try {
      const { blob, filename, stats } = await createFullBackup();
      // Download file to computer
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setIsBackupReminderOpen(false);
      showToast(`Backup created and downloaded successfully! (${stats.totalRecords} records saved)`, 'success');
    } catch (err: any) {
      showToast(`Backup failed: ${err.message}`, 'error');
    }
  };

  const snoozeReminder = async () => {
    setIsBackupReminderOpen(false);
    const snoozeTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await db.appSettings.update('global_settings', { snoozedUntil: snoozeTime });
    showToast('Backup reminder snoozed for 30 minutes.', 'info');
  };

  const dismissReminder = async () => {
    setIsBackupReminderOpen(false);
    // Dismiss until tomorrow morning 00:00
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    await db.appSettings.update('global_settings', { snoozedUntil: tomorrow.toISOString() });
    showToast('Backup reminder dismissed for today.', 'info');
  };

  return (
    <NotificationContext.Provider
      value={{
        toasts,
        showToast,
        removeToast,
        isBackupReminderOpen,
        triggerBackupNow,
        snoozeReminder,
        dismissReminder
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
