import React, { useState, useEffect } from 'react';
import { type AuditLog } from '../../types';
import { db } from '../../db';
import { formatDateTime } from '../../utils/formatters';
import {
  FileText,
  Search,
  Filter,
  Shield,
  Eye,
  X,
  Clock,
  Building2,
  Wine,
  User
} from 'lucide-react';

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState('');
  const [businessFilter, setBusinessFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [loading, setLoading] = useState(true);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const records = await db.auditLogs.reverse().limit(250).toArray();
      setLogs(records);
    } catch (err) {
      console.error('Error loading audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = logs.filter(l => {
    const matchesBusiness = businessFilter === 'all' || l.businessId === businessFilter;
    const matchesSearch =
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.description.toLowerCase().includes(search.toLowerCase()) ||
      l.userName.toLowerCase().includes(search.toLowerCase()) ||
      l.recordReference.toLowerCase().includes(search.toLowerCase());
    return matchesBusiness && matchesSearch;
  });

  return (
    <div className="space-y-5 pb-12 animate-fade-in">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
              Master System Audit Trail
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable transaction history, authentication logs, and supervisor operational checks.
          </p>
        </div>

        <span className="text-xs text-slate-500 font-medium">
          Showing last <strong>{filteredLogs.length}</strong> recorded audit events
        </span>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by action, user, or record reference..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-blue-600"
          />
        </div>

        <select
          value={businessFilter}
          onChange={e => setBusinessFilter(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
        >
          <option value="all">All Domains & Businesses</option>
          <option value="building">Building Materials Only</option>
          <option value="drinks">Soft Drinks & Minerals Only</option>
          <option value="system">Core System & Security</option>
        </select>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left divide-y divide-slate-200">
            <thead className="bg-slate-50 font-bold text-slate-600 uppercase">
              <tr>
                <th className="py-3 px-4">Timestamp (Accra)</th>
                <th className="py-3 px-4">Domain</th>
                <th className="py-3 px-4">Action Event</th>
                <th className="py-3 px-4">Record Ref</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">Loading audit trail...</td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">No logs found matching filter.</td>
                </tr>
              ) : (
                filteredLogs.map(l => (
                  <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap font-mono text-[11px]">
                      {formatDateTime(l.timestamp)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          l.businessId === 'building'
                            ? 'bg-blue-100 text-blue-900'
                            : l.businessId === 'drinks'
                            ? 'bg-teal-100 text-teal-900'
                            : 'bg-slate-200 text-slate-800'
                        }`}
                      >
                        {l.businessId}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{l.action}</td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-700">{l.recordReference}</td>
                    <td className="py-3 px-4 text-slate-700 truncate max-w-sm">{l.description}</td>
                    <td className="py-3 px-4 text-slate-600">
                      <span className="font-semibold block">{l.userName}</span>
                      <span className="text-[10px] text-slate-400 uppercase">{l.userRole}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {l.details && (
                        <button
                          onClick={() => setSelectedLog(l)}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-fade-in">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-base">Audit Log Snapshot</h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3 text-xs">
              <div>
                <span className="text-slate-500 block">Action & Reference:</span>
                <span className="font-bold text-sm text-slate-900">
                  {selectedLog.action} ({selectedLog.recordReference})
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Description:</span>
                <span className="text-slate-800">{selectedLog.description}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                <div>
                  <span className="text-slate-500 block">User:</span>
                  <span className="font-semibold text-slate-900">{selectedLog.userName} ({selectedLog.userRole})</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Timestamp:</span>
                  <span className="font-mono text-slate-800">{formatDateTime(selectedLog.timestamp)}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-500 block mb-1">Payload / State Details:</span>
                <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl overflow-x-auto text-[11px] font-mono">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 font-bold rounded-xl text-slate-800 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
