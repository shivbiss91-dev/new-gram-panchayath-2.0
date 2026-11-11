import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../services/api';
import { AdminDashboardData } from '../../types';
import {
  ClipboardList,
  Clock,
  RefreshCw,
  CheckCircle2,
  ArrowRight,
  Eye,
  AlertTriangle,
  Briefcase,
  FileSpreadsheet,
  BarChart3,
  Minus,
  ArrowDown,
  Image as ImageIcon,
  RotateCcw,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { StatCard } from '../../components/common/StatCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { PriorityBadge } from '../../components/common/PriorityBadge';
import { CategoryBadge } from '../../components/common/CategoryBadge';
import { CardSkeleton, TableSkeleton } from '../../components/common/SkeletonLoader';
import { EmptyState } from '../../components/common/EmptyState';

export const AdminDashboard: React.FC = () => {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminApi.getDashboard();
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.message || 'Unable to load dashboard summary.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard metrics. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const highCount = data?.priorityCounts?.HIGH ?? 0;
  const mediumCount = data?.priorityCounts?.MEDIUM ?? 0;
  const lowCount = data?.priorityCounts?.LOW ?? 0;
  const highPending = data?.highPriorityPending ?? 0;
  const mediumPending = data?.mediumPriorityPending ?? 0;
  const lowPending = data?.lowPriorityPending ?? 0;
  const activeCount = data ? (data.activeComplaints ?? data.assigned + data.inProgress) : 0;

  return (
    <div className="space-y-8">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyber-dark text-cyber-cyan text-xs font-bold border border-cyber-cyan/30 mb-2">
            <span>Gram Panchayat Administration Workspace</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Panchayat Officer Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time monitoring of civic grievances, urgency priorities, departmental assignments, and resolutions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/admin/assignments">
            <Button variant="outline" size="sm" leftIcon={<Briefcase className="w-4 h-4 text-cyber-blue" />}>
              Assign Work
            </Button>
          </Link>
          <Link to="/admin/reports">
            <Button variant="primary" size="sm" leftIcon={<FileSpreadsheet className="w-4 h-4" />}>
              Export Reports
            </Button>
          </Link>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-3xl bg-rose-50 border border-rose-200 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-rose-900">Could Not Load Dashboard Metrics</h3>
              <p className="text-xs text-rose-700 mt-0.5">{error}</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchDashboard}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Status Totals (Click cards to filter complaints page) */}
      {isLoading ? (
        <CardSkeleton count={4} />
      ) : data ? (
        <div className="space-y-6">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Complaint Status Summary (Click Any Card to Filter)
              </h2>
              {data.rejected > 0 && (
                <Link
                  to="/admin/complaints?status=REJECTED"
                  className="text-xs font-semibold text-slate-500 hover:text-rose-600 transition-colors"
                >
                  {data.rejected} Closed / Rejected &rarr;
                </Link>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link to="/admin/complaints" className="block group focus:outline-none">
                <StatCard
                  title="Total Complaints"
                  value={data.totalComplaints}
                  subtitle="Click to view all records"
                  icon={<ClipboardList className="w-5 h-5 text-cyber-blue" />}
                  gradient="cyan"
                  interactive
                  className="h-full"
                />
              </Link>

              <Link to="/admin/complaints?status=PENDING" className="block group focus:outline-none">
                <StatCard
                  title="Pending"
                  value={data.pendingReview}
                  subtitle={`${data.submitted ?? 0} submitted, ${data.underReview ?? 0} under review`}
                  icon={<Clock className="w-5 h-5 text-amber-500" />}
                  gradient="amber"
                  interactive
                  className="h-full"
                />
              </Link>

              <Link to="/admin/complaints?status=ACTIVE" className="block group focus:outline-none">
                <StatCard
                  title="In Progress"
                  value={activeCount}
                  subtitle={`${data.assigned} assigned, ${data.inProgress} work underway`}
                  icon={<RefreshCw className="w-5 h-5 text-cyber-blue" />}
                  gradient="blue"
                  interactive
                  className="h-full"
                />
              </Link>

              <Link to="/admin/complaints?status=RESOLVED" className="block group focus:outline-none">
                <StatCard
                  title="Resolved"
                  value={data.resolved}
                  subtitle={`${data.resolutionRate}% completion rate`}
                  icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                  gradient="emerald"
                  trend={`${data.resolutionRate}%`}
                  interactive
                  className="h-full"
                />
              </Link>
            </div>
          </div>

          {/* Priority Totals & Combined Filter Shortcuts */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Priority Breakdown & Combined Triage Shortcuts
              </h2>
              <Link
                to="/admin/complaints?priority=HIGH&status=PENDING"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-full border border-red-200 transition-colors"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>High Priority + Pending ({highPending})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* High Priority */}
              <div className="rounded-2xl bg-white border border-red-200/80 p-5 shadow-card hover:shadow-md hover:border-red-300 transition-all flex flex-col justify-between gap-3">
                <Link to="/admin/complaints?priority=HIGH" className="flex items-start justify-between gap-3 group">
                  <div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700 bg-red-50 px-2.5 py-0.5 rounded-full border border-red-200">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      High Priority
                    </span>
                    <div className="text-3xl font-extrabold text-slate-900 mt-2.5 tracking-tight">
                      {highCount}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Critical safety & utility disruptions
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-red-600 group-hover:translate-x-1 transition-all" />
                </Link>
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <Link
                    to="/admin/complaints?priority=HIGH&status=PENDING"
                    className="font-bold text-red-700 hover:underline flex items-center gap-1"
                  >
                    <span>{highPending} High Priority + Pending</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                  <Link
                    to="/admin/complaints?priority=HIGH&status=ACTIVE"
                    className="text-slate-500 hover:text-slate-800 font-semibold"
                  >
                    Filter Active
                  </Link>
                </div>
              </div>

              {/* Medium Priority */}
              <div className="rounded-2xl bg-white border border-amber-200/80 p-5 shadow-card hover:shadow-md hover:border-amber-300 transition-all flex flex-col justify-between gap-3">
                <Link to="/admin/complaints?priority=MEDIUM" className="flex items-start justify-between gap-3 group">
                  <div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-300">
                      <Minus className="w-3.5 h-3.5" />
                      Medium Priority
                    </span>
                    <div className="text-3xl font-extrabold text-slate-900 mt-2.5 tracking-tight">
                      {mediumCount}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Standard civic repair & maintenance requests
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" />
                </Link>
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <Link
                    to="/admin/complaints?priority=MEDIUM&status=PENDING"
                    className="font-bold text-amber-700 hover:underline flex items-center gap-1"
                  >
                    <span>{mediumPending} Medium + Pending</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                  <Link
                    to="/admin/complaints?priority=MEDIUM&status=ACTIVE"
                    className="text-slate-500 hover:text-slate-800 font-semibold"
                  >
                    Filter Active
                  </Link>
                </div>
              </div>

              {/* Low Priority */}
              <div className="rounded-2xl bg-white border border-emerald-200/80 p-5 shadow-card hover:shadow-md hover:border-emerald-300 transition-all flex flex-col justify-between gap-3">
                <Link to="/admin/complaints?priority=LOW" className="flex items-start justify-between gap-3 group">
                  <div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      <ArrowDown className="w-3.5 h-3.5" />
                      Low Priority
                    </span>
                    <div className="text-3xl font-extrabold text-slate-900 mt-2.5 tracking-tight">
                      {lowCount}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Routine upkeep & minor improvement works
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
                </Link>
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <Link
                    to="/admin/complaints?priority=LOW&status=PENDING"
                    className="font-bold text-emerald-700 hover:underline flex items-center gap-1"
                  >
                    <span>{lowPending} Low + Pending</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                  <Link
                    to="/admin/complaints?priority=LOW&status=ACTIVE"
                    className="text-slate-500 hover:text-slate-800 font-semibold"
                  >
                    Filter Active
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Admin Quick Action Shortcuts */}
      {!error && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            to="/admin/complaints?priority=HIGH&status=PENDING"
            className="p-5 rounded-2xl bg-white border border-slate-200/80 hover:border-red-400 shadow-sm hover:shadow-md transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-800 block">Urgent Triage Queue</span>
                <span className="text-xs text-slate-400 block mt-0.5">
                  {data ? `${highPending} High Priority + Pending to review` : 'Loading urgent queue...'}
                </span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 group-hover:text-red-500 transition-all" />
          </Link>

          <Link
            to="/admin/assignments"
            className="p-5 rounded-2xl bg-white border border-slate-200/80 hover:border-cyber-cyan shadow-sm hover:shadow-md transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-cyan-50 text-cyber-blue flex items-center justify-center font-bold">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-800 block">Department Dispatch</span>
                <span className="text-xs text-slate-400 block mt-0.5">
                  Assign road, electrical & water crew
                </span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 group-hover:text-cyber-blue transition-all" />
          </Link>

          <Link
            to="/admin/analytics"
            className="p-5 rounded-2xl bg-white border border-slate-200/80 hover:border-purple-400 shadow-sm hover:shadow-md transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-800 block">Analytics & Charts</span>
                <span className="text-xs text-slate-400 block mt-0.5">
                  Category, priority & monthly trends
                </span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 group-hover:text-purple-600 transition-all" />
          </Link>
        </div>
      )}

      {/* Recent Complaints Queue Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Recent Complaints Queue</h2>
            <p className="text-xs text-slate-500">Latest issues submitted by village residents</p>
          </div>
          <Link
            to="/admin/complaints"
            className="text-xs font-bold text-cyber-blue hover:underline flex items-center gap-1"
          >
            <span>View All ({data?.totalComplaints || 0})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {isLoading ? (
          <TableSkeleton rows={5} />
        ) : error ? (
          <div className="py-6 text-center text-xs text-rose-700 bg-rose-50/70 rounded-2xl border border-rose-200">
            Recent complaints queue could not be loaded. Use Retry above to try again.
          </div>
        ) : !data || data.recentComplaints.length === 0 ? (
          <EmptyState
            title="No complaints logged yet"
            description="New citizen grievances submitted through the portal will appear here automatically."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3">Complaint ID</th>
                  <th className="py-3 px-3">Priority</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Issue Title</th>
                  <th className="py-3 px-3">Citizen Contact</th>
                  <th className="py-3 px-3">Department</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {data.recentComplaints.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-3 font-mono font-bold text-cyber-blue whitespace-nowrap">
                      {c.complaintNumber}
                    </td>
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <PriorityBadge priority={c.priority} size="sm" />
                    </td>
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <CategoryBadge category={c.category} size="sm" />
                    </td>
                    <td className="py-3.5 px-3 max-w-[200px] text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{c.title}</span>
                        {c.imageUrl && (
                          <span
                            title="Photo evidence attached"
                            className="text-cyber-blue flex-shrink-0"
                          >
                            <ImageIcon className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-slate-600 whitespace-nowrap">
                      <span className="font-semibold block">{c.user?.name}</span>
                      <span className="text-[10px] text-slate-400">{c.user?.mobile}</span>
                    </td>
                    <td className="py-3.5 px-3 text-slate-600 whitespace-nowrap">
                      {c.assignedDepartment || <span className="text-amber-500 italic">Unassigned</span>}
                    </td>
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <StatusBadge status={c.status} size="sm" />
                    </td>
                    <td className="py-3.5 px-3 text-right whitespace-nowrap">
                      <Link
                        to={`/admin/complaints/${c.id}`}
                        state={{ from: '/admin/dashboard' }}
                      >
                        <Button variant="outline" size="sm" className="text-[11px] py-1 px-2.5">
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Manage
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
