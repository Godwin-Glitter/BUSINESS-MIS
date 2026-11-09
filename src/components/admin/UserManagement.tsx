import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { type User, type AssignedBusiness, type UserRole, type UserStatus } from '../../types';
import { db, logAuditEvent } from '../../db';
import { hashPassword, generateSalt } from '../../utils/security';
import { formatDateTime } from '../../utils/formatters';
import {
  UserCog,
  Plus,
  ShieldCheck,
  UserX,
  UserCheck,
  KeyRound,
  X,
  Building2,
  Wine,
  Shield,
  Edit2
} from 'lucide-react';

export const UserManagement: React.FC = () => {
  const { currentUser } = useAuth();
  const { showToast } = useNotification();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [assignedBusiness, setAssignedBusiness] = useState<AssignedBusiness>('building');
  const [role, setRole] = useState<UserRole>('salesperson');
  const [status, setStatus] = useState<UserStatus>('active');

  // Password Reset Modal
  const [resetTargetUser, setResetTargetUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    try {
      const allUsers = await db.users.toArray();
      setUsers(allUsers);
    } catch (err) {
      console.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const openCreateModal = () => {
    setEditingUser(null);
    setFullName('');
    setUsername('');
    setPassword('');
    setAssignedBusiness('building');
    setRole('salesperson');
    setStatus('active');
    setIsModalOpen(true);
  };

  const openEditModal = (u: User) => {
    setEditingUser(u);
    setFullName(u.fullName);
    setUsername(u.username);
    setPassword('');
    setAssignedBusiness(u.assignedBusiness);
    setRole(u.role);
    setStatus(u.status);
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !username.trim() || !currentUser) {
      showToast('Please fill in user full name and username.', 'warning');
      return;
    }

    try {
      const now = new Date().toISOString();

      if (editingUser) {
        // Update user
        const updatePayload: Partial<User> = {
          fullName: fullName.trim(),
          username: username.trim().toLowerCase(),
          assignedBusiness,
          role,
          status
        };

        if (password.trim()) {
          const salt = generateSalt();
          const hash = await hashPassword(password, salt);
          updatePayload.passwordHash = hash;
          updatePayload.salt = salt;
        }

        await db.users.update(editingUser.id, updatePayload);

        await logAuditEvent(
          'system',
          'USER_MODIFIED',
          username,
          `Administrator ${currentUser.fullName} updated user account ${fullName} (${role})`,
          currentUser
        );
        showToast(`User ${fullName} updated successfully!`, 'success');
      } else {
        // Create user
        if (!password) {
          showToast('Please enter an initial password for the user.', 'warning');
          return;
        }

        const existing = await db.users.where('username').equalsIgnoreCase(username.trim()).first();
        if (existing) {
          showToast(`Username "${username}" already exists. Please choose a different handle.`, 'error');
          return;
        }

        const salt = generateSalt();
        const hash = await hashPassword(password, salt);

        const newUser: User = {
          id: 'usr_' + Date.now(),
          fullName: fullName.trim(),
          username: username.trim().toLowerCase(),
          passwordHash: hash,
          salt,
          assignedBusiness,
          role,
          status,
          createdAt: now
        };

        await db.users.add(newUser);

        await logAuditEvent(
          'system',
          'USER_CREATED',
          username,
          `Administrator created worker ${fullName} assigned to [${assignedBusiness}]`,
          currentUser
        );
        showToast(`User account ${fullName} created successfully!`, 'success');
      }

      setIsModalOpen(false);
      loadUsers();
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    }
  };

  const toggleUserStatus = async (targetUser: User) => {
    if (!currentUser) return;
    if (targetUser.id === currentUser.id) {
      showToast('You cannot deactivate your own active administrator account.', 'warning');
      return;
    }

    const newStatus: UserStatus = targetUser.status === 'active' ? 'inactive' : 'active';
    await db.users.update(targetUser.id, { status: newStatus });

    await logAuditEvent(
      'system',
      newStatus === 'active' ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      targetUser.username,
      `User account ${targetUser.username} set to ${newStatus} by ${currentUser.fullName}`,
      currentUser
    );

    showToast(`User ${targetUser.fullName} is now ${newStatus}.`, 'info');
    loadUsers();
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser || !newPassword || !currentUser) return;

    try {
      const salt = generateSalt();
      const hash = await hashPassword(newPassword, salt);
      await db.users.update(resetTargetUser.id, {
        passwordHash: hash,
        salt
      });

      await logAuditEvent(
        'system',
        'PASSWORD_RESET',
        resetTargetUser.username,
        `Administrator reset password for user ${resetTargetUser.username}`,
        currentUser
      );

      showToast(`Password successfully reset for ${resetTargetUser.fullName}!`, 'success');
      setResetTargetUser(null);
      setNewPassword('');
    } catch (err: any) {
      showToast(`Password reset failed: ${err.message}`, 'error');
    }
  };

  return (
    <div className="space-y-5 pb-12 animate-fade-in">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <UserCog className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
              User Accounts & Business Isolation Access
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Strict role-based isolation: Workers assigned to one business CANNOT access the other business.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Worker Account</span>
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left divide-y divide-slate-200">
            <thead className="bg-slate-50 font-bold text-slate-600 uppercase">
              <tr>
                <th className="py-3 px-4">User Full Name</th>
                <th className="py-3 px-4">Username</th>
                <th className="py-3 px-4">Assigned Business Access</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Last Login</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900">{u.fullName}</td>
                  <td className="py-3 px-4 font-mono font-medium text-slate-700">{u.username}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                        u.assignedBusiness === 'all'
                          ? 'bg-purple-100 text-purple-900'
                          : u.assignedBusiness === 'building'
                          ? 'bg-blue-100 text-blue-900'
                          : 'bg-teal-100 text-teal-900'
                      }`}
                    >
                      {u.assignedBusiness === 'all' ? (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Both Businesses</span>
                        </>
                      ) : u.assignedBusiness === 'building' ? (
                        <>
                          <Building2 className="w-3.5 h-3.5" />
                          <span>Building Materials Only</span>
                        </>
                      ) : (
                        <>
                          <Wine className="w-3.5 h-3.5" />
                          <span>Soft Drinks Only</span>
                        </>
                      )}
                    </span>
                  </td>
                  <td className="py-3 px-4 uppercase font-bold text-[10px] text-slate-600">
                    {u.role}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => toggleUserStatus(u)}
                      disabled={u.id === currentUser?.id}
                      className={`px-2 py-0.5 rounded font-bold text-[10px] cursor-pointer transition-colors ${
                        u.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                      }`}
                    >
                      {u.status.toUpperCase()}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                    {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Never'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => {
                          setResetTargetUser(u);
                          setNewPassword('');
                        }}
                        title="Reset User Password"
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg text-[11px] transition-colors cursor-pointer"
                      >
                        Reset Pass
                      </button>
                      <button
                        onClick={() => openEditModal(u)}
                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-fade-in">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCog className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-base">
                  {editingUser ? 'Edit User Privileges' : 'Create Worker Account'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  1. Worker Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="e.g. Kwame Mensah"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:outline-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  2. Username *
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="e.g. building_worker"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:bg-white focus:outline-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  3. Password {editingUser ? '(leave blank to keep current)' : '*'}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:outline-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  4. Assigned Business Access (Strict Isolation) *
                </label>
                <select
                  value={assignedBusiness}
                  onChange={e => setAssignedBusiness(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-blue-600"
                >
                  <option value="building">Building Materials ONLY (Akwaaba Supply)</option>
                  <option value="drinks">Soft Drinks & Minerals ONLY (Oasis Depot)</option>
                  <option value="all">Both Businesses (Administrator Master Access)</option>
                </select>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Workers assigned to one business are strictly barred from accessing the other business.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    5. Role *
                  </label>
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white"
                  >
                    <option value="salesperson">Salesperson</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    6. Account Status *
                  </label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white"
                  >
                    <option value="active">Active (Can Login)</option>
                    <option value="inactive">Inactive / Deactivated</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  {editingUser ? 'Save Updates' : 'Create User Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {resetTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-fade-in">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base">Reset User Password</h3>
              </div>
              <button
                onClick={() => setResetTargetUser(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                Enter a new secure password for <strong>{resetTargetUser.fullName}</strong> ({resetTargetUser.username}).
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  New Password *
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:outline-blue-600"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setResetTargetUser(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  Set New Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
