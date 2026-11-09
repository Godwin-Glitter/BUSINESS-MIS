import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { type User, type BusinessId, type AssignedBusiness } from '../types';
import { db, isSystemInitialized, initializeAppSettings, seedDefaultProfiles, seedSampleOperationalData, logAuditEvent } from '../db';
import { verifyPassword, hashPassword, generateSalt, SESSION_TIMEOUT_MS } from '../utils/security';

interface AuthContextType {
  currentUser: User | null;
  activeBusiness: BusinessId;
  setActiveBusiness: (biz: BusinessId) => void;
  isLoading: boolean;
  needsSetup: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  setupInitialAdmin: (fullName: string, username: string, password: string) => Promise<boolean>;
  canSwitchBusiness: boolean;
  hasAccessTo: (business: BusinessId) => boolean;
  sessionTimeRemaining: number;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeBusiness, setActiveBusinessState] = useState<BusinessId>('building');
  const [isLoading, setIsLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState<number>(SESSION_TIMEOUT_MS);

  // Initialize DB and verify setup status
  useEffect(() => {
    async function checkSetup() {
      try {
        await initializeAppSettings();
        await seedDefaultProfiles();
        const initialized = await isSystemInitialized();
        if (!initialized) {
          setNeedsSetup(true);
        } else {
          // Check if session stored in local storage
          const storedUserId = sessionStorage.getItem('ibms_session_user_id');
          if (storedUserId) {
            const user = await db.users.get(storedUserId);
            if (user && user.status === 'active') {
              setCurrentUser(user);
              if (user.assignedBusiness === 'drinks') {
                setActiveBusinessState('drinks');
              } else {
                setActiveBusinessState('building');
              }
            } else {
              sessionStorage.removeItem('ibms_session_user_id');
            }
          }
        }
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setIsLoading(false);
      }
    }
    checkSetup();
  }, []);

  // Track user activity & session timeout
  useEffect(() => {
    if (!currentUser) return;

    const handleUserActivity = () => {
      setLastActivity(Date.now());
    };

    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('click', handleUserActivity);

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivity;
      const remaining = Math.max(0, SESSION_TIMEOUT_MS - elapsed);
      setSessionTimeRemaining(remaining);

      if (elapsed >= SESSION_TIMEOUT_MS) {
        logout();
      }
    }, 10000);

    return () => {
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      clearInterval(interval);
    };
  }, [currentUser, lastActivity]);

  const canSwitchBusiness = currentUser?.role === 'admin' && currentUser?.assignedBusiness === 'all';

  const hasAccessTo = (business: BusinessId): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin' || currentUser.assignedBusiness === 'all') return true;
    return currentUser.assignedBusiness === business;
  };

  const setActiveBusiness = (biz: BusinessId) => {
    if (!currentUser) return;
    // Strict isolation enforcement
    if (currentUser.role !== 'admin' && currentUser.assignedBusiness !== 'all') {
      if (currentUser.assignedBusiness !== biz) {
        console.warn(`Prevented unauthorized attempt to switch business to ${biz}`);
        return;
      }
    }
    setActiveBusinessState(biz);
  };

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const user = await db.users.where('username').equalsIgnoreCase(username.trim()).first();
      if (!user) {
        // Record failed login audit log
        await logAuditEvent('system', 'FAILED_LOGIN', username, `Failed login attempt for username: ${username}`, {
          id: 'anonymous',
          fullName: 'Unknown',
          role: 'salesperson'
        });
        return { success: false, error: 'Invalid username or password.' };
      }

      if (user.status !== 'active') {
        await logAuditEvent('system', 'BLOCKED_LOGIN', username, `Deactivated user "${username}" attempted login`, user);
        return { success: false, error: 'This user account has been deactivated by the administrator.' };
      }

      const isValid = await verifyPassword(password, user.salt, user.passwordHash);
      if (!isValid) {
        await logAuditEvent('system', 'FAILED_LOGIN', username, `Incorrect password for username: ${username}`, user);
        return { success: false, error: 'Invalid username or password.' };
      }

      // Successful login
      const now = new Date().toISOString();
      await db.users.update(user.id, { lastLoginAt: now });
      user.lastLoginAt = now;

      sessionStorage.setItem('ibms_session_user_id', user.id);
      setCurrentUser(user);
      setLastActivity(Date.now());

      // Auto-assign active business based on user assignedBusiness
      if (user.assignedBusiness === 'drinks') {
        setActiveBusinessState('drinks');
      } else if (user.assignedBusiness === 'building') {
        setActiveBusinessState('building');
      } else {
        // Admin default: starts on building or choice page
        setActiveBusinessState('building');
      }

      await logAuditEvent('system', 'USER_LOGIN', user.username, `User ${user.fullName} (${user.role}) logged in successfully`, user);

      return { success: true };
    } catch (err: any) {
      console.error('Login error:', err);
      return { success: false, error: err.message || 'Login failed.' };
    }
  };

  const logout = async () => {
    if (currentUser) {
      await logAuditEvent('system', 'USER_LOGOUT', currentUser.username, `User ${currentUser.fullName} logged out`, currentUser);
    }
    sessionStorage.removeItem('ibms_session_user_id');
    setCurrentUser(null);
  };

  const setupInitialAdmin = async (fullName: string, username: string, password: string): Promise<boolean> => {
    try {
      const salt = generateSalt();
      const passwordHash = await hashPassword(password, salt);
      const adminId = 'usr_admin_' + Date.now();

      const adminUser: User = {
        id: adminId,
        fullName: fullName.trim(),
        username: username.trim().toLowerCase(),
        passwordHash,
        salt,
        assignedBusiness: 'all',
        role: 'admin',
        status: 'active',
        createdAt: new Date().toISOString()
      };

      await db.users.add(adminUser);

      // Also create two standard sample workers for immediate testing:
      const workerSalt1 = generateSalt();
      const workerHash1 = await hashPassword('worker123', workerSalt1);
      const buildingWorker: User = {
        id: 'usr_bld_worker',
        fullName: 'Kwame Mensah (Building Materials)',
        username: 'building_worker',
        passwordHash: workerHash1,
        salt: workerSalt1,
        assignedBusiness: 'building',
        role: 'salesperson',
        status: 'active',
        createdAt: new Date().toISOString()
      };

      const workerSalt2 = generateSalt();
      const workerHash2 = await hashPassword('drinks123', workerSalt2);
      const drinksWorker: User = {
        id: 'usr_drk_worker',
        fullName: 'Abena Osei (Drinks & Minerals)',
        username: 'drinks_worker',
        passwordHash: workerHash2,
        salt: workerSalt2,
        assignedBusiness: 'drinks',
        role: 'salesperson',
        status: 'active',
        createdAt: new Date().toISOString()
      };

      await db.users.bulkAdd([buildingWorker, drinksWorker]);

      // Seed operational sample data
      await seedSampleOperationalData(adminUser);

      setNeedsSetup(false);
      setCurrentUser(adminUser);
      sessionStorage.setItem('ibms_session_user_id', adminId);
      setActiveBusinessState('building');

      return true;
    } catch (err) {
      console.error('Failed initial admin setup:', err);
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        activeBusiness,
        setActiveBusiness,
        isLoading,
        needsSetup,
        login,
        logout,
        setupInitialAdmin,
        canSwitchBusiness,
        hasAccessTo,
        sessionTimeRemaining
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
