import React, { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../services/api';
import { Complaint, ComplaintPriority } from '../../types';
import { useToast } from '../../context/ToastContext';
import {
  Briefcase,
  UserCheck,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { StatusBadge } from '../../components/common/StatusBadge';
import { PriorityBadge, normalizePriority } from '../../components/common/PriorityBadge';
import { CategoryBadge } from '../../components/common/CategoryBadge';
import { TableSkeleton } from '../../components/common/SkeletonLoader';
import { EmptyState } from '../../components/common/EmptyState';

const DEPARTMENTS = [
  'Road Maintenance',
  'Water Supply',
  'Sanitation',
  'Street Lighting',
  'Waste Management',
  'Public Facilities',
  'Administration',
];

const DEFAULT_STAFF: Record<string, string> = {
  'Road Maintenance': 'Mahesh Jadhav (Junior Engineer)',
  'Water Supply': 'Kishore Bhende (Water Works Supervisor)',
  Sanitation: 'Deepak Kale (Sanitation Inspector)',
  'Street Lighting': 'Suresh Patil (Electrical Line Worker)',
  'Waste Management': 'Santosh Gaikwad (Sanitation Supervisor)',
  'Public Facilities': 'Ganesh More (Civil Supervisor)',
  Administration: 'Rajesh Shinde (Officer)',
};

export const AdminAssignmentsPage: React.FC = () => {
  const { success, error: toastError } = useToast();

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);

  const [dept, setDept] = useState(DEPARTMENTS[0]);
  const [staff, setStaff] = useState(DEFAULT_STAFF[DEPARTMENTS[0]] || '');
  const [dispatchPriority, setDispatchPriority] = useState<ComplaintPriority>('MEDIUM');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchQueue = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminApi.getComplaints({
        priority: priorityFilter,
        status: statusFilter,
        limit: 50,
      });
      if (res.success && res.data) {
        setComplaints(res.data);
      } else {
        setError(res.message || 'Unable to load complaints queue.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load complaints queue.');
    } finally {
      setIsLoading(false);
    }
  }, [priorityFilter, statusFilter]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handleSelectComplaint = (c: Complaint) => {
    setSelectedComplaint(c);
    setDispatchPriority(normalizePriority(c.priority));
    if (c.assignedDepartment && DEPARTMENTS.includes(c.assignedDepartment)) {
      setDept(c.assignedDepartment);
      setStaff(c.assignedStaff || DEFAULT_STAFF[c.assignedDepartment] || '');
    }
  };

  const handleSelectDept = (d: string) => {
    setDept(d);
    setStaff(DEFAULT_STAFF[d] || '');
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) {
      toastError('Please select a complaint from the table first.');
      return;
    }
    if (!staff.trim()) {
      toastError('Please specify the staff / engineer name.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await adminApi.assignComplaint(selectedComplaint.id, {
        assignedDepartment: dept,
        assignedStaff: staff.trim(),
        priority: dispatchPriority,
        remarks: remarks.trim(),
      });
      if (res.success) {
        success(`Complaint ${selectedComplaint.complaintNumber} assigned to ${dept}!`);
        setSelectedComplaint(null);
        setRemarks('');
        fetchQueue();
      } else {
        toastError(res.message || 'Failed to assign.');
      }
    } catch (err: any) {
      toastError(err.message || 'Assignment failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Departmental Work Assignment
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Prioritize and route complaints to field maintenance crews, electrical technicians, and sanitation squads.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Complaints Selection Table */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/80 p-6 shadow-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Complaints Queue</h2>
              <p className="text-xs text-slate-400">Click any row to select for assignment</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Filter queue priority"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-cyber-cyan"
              >
                <option value="ALL">All Priorities</option>
                <option value="HIGH">High Priority</option>
                <option value="MEDIUM">Medium Priority</option>
                <option value="LOW">Low Priority</option>
              </select>

              <select
                aria-label="Filter queue status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-cyber-cyan"
              >
                <option value="PENDING">Pending Triage</option>
                <option value="ACTIVE">In Progress / Assigned</option>
                <option value="ALL">All Active & Recent</option>
              </select>

              <span className="text-xs font-semibold text-cyber-blue bg-cyan-50 px-2.5 py-1 rounded-full border border-cyan-100">
                {complaints.length} Records
              </span>
            </div>
          </div>

          {isLoading ? (
            <TableSkeleton rows={6} />
          ) : error ? (
            <div className="rounded-2xl bg-rose-50 border border-rose-200 p-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{error}</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={fetchQueue}
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Retry
              </Button>
            </div>
          ) : complaints.length === 0 ? (
            <EmptyState
              title="No complaints match queue filter"
              description="Try switching priority or queue filter above to inspect other complaints."
              actionText="Show All"
              onAction={() => {
                setPriorityFilter('ALL');
                setStatusFilter('ALL');
              }}
            />
          ) : (
            <div className="overflow-y-auto max-h-[550px] divide-y divide-slate-100">
              {complaints.map((c) => {
                const isSelected = selectedComplaint?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => handleSelectComplaint(c)}
                    className={`p-3.5 rounded-2xl cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-cyan-50/80 border-2 border-cyber-cyan shadow-sm'
                        : 'hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-cyber-blue">
                          {c.complaintNumber}
                        </span>
                        <PriorityBadge priority={c.priority} size="sm" />
                        <CategoryBadge category={c.category} size="sm" />
                      </div>
                      <StatusBadge status={c.status} size="sm" />
                    </div>

                    <p className="text-xs font-bold text-slate-800 line-clamp-1">{c.title}</p>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                      <span>{c.location}</span>
                      <span>
                        {c.assignedDepartment ? (
                          <span className="text-slate-600 font-semibold">{c.assignedDepartment}</span>
                        ) : (
                          <span className="text-amber-500 font-semibold italic">Unassigned</span>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Assignment Panel */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-card space-y-6">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <Briefcase className="w-5 h-5 text-cyber-blue" />
            <h2 className="text-base font-bold text-slate-900">Assignment Controls</h2>
          </div>

          {selectedComplaint ? (
            <form onSubmit={handleAssign} className="space-y-4">
              <div className="p-4 rounded-2xl bg-cyan-50/60 border border-cyber-cyan/30 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400">
                    Target Grievance
                  </span>
                  <PriorityBadge priority={selectedComplaint.priority} size="sm" />
                </div>
                <span className="font-mono font-bold text-cyber-blue block">
                  {selectedComplaint.complaintNumber}
                </span>
                <p className="font-semibold text-slate-800 line-clamp-2">
                  {selectedComplaint.title}
                </p>
                <p className="text-slate-500">{selectedComplaint.location}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Responsible Department *
                </label>
                <select
                  value={dept}
                  onChange={(e) => handleSelectDept(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-cyber-cyan"
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Assigned Staff / Engineer Name *
                </label>
                <input
                  type="text"
                  value={staff}
                  onChange={(e) => setStaff(e.target.value)}
                  placeholder="e.g. Mahesh Jadhav (JE)"
                  required
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-cyber-cyan"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Dispatch Priority
                </label>
                <select
                  value={dispatchPriority}
                  onChange={(e) => setDispatchPriority(e.target.value as ComplaintPriority)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-cyber-cyan"
                >
                  <option value="HIGH">High Priority</option>
                  <option value="MEDIUM">Medium Priority</option>
                  <option value="LOW">Low Priority</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Internal Remarks / Work Order Notes
                </label>
                <textarea
                  rows={3}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Add inspection directions, machinery instructions, or priority notes..."
                  className="w-full p-3 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-cyber-cyan"
                />
              </div>

              <Button
                type="submit"
                size="md"
                className="w-full"
                isLoading={isSubmitting}
                rightIcon={<UserCheck className="w-4 h-4" />}
              >
                Dispatch Work Order
              </Button>
            </form>
          ) : (
            <div className="py-16 text-center text-slate-400 space-y-3">
              <Briefcase className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-xs max-w-xs mx-auto">
                Select any complaint from the left table to dispatch it to the responsible department.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
