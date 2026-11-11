import React, { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Filter,
  Clock,
  Percent,
  Timer,
  AlertTriangle,
  RotateCcw,
  Flag,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { StatCard } from '../../components/common/StatCard';
import { CardSkeleton } from '../../components/common/SkeletonLoader';

const CATEGORIES = [
  'Road Issues',
  'Street Light Problems',
  'Water Supply Issues',
  'Drainage & Sanitation',
  'Waste Management',
  'Public Facilities',
  'Other',
];

export const AdminReportsPage: React.FC = () => {
  const { success, error: toastError } = useToast();

  const [category, setCategory] = useState('ALL');
  const [priority, setPriority] = useState('ALL');
  const [dateRange, setDateRange] = useState('ALL');

  const [metrics, setMetrics] = useState<{
    total: number;
    resolved: number;
    assigned?: number;
    inProgress: number;
    pending: number;
    priorityCounts?: { HIGH: number; MEDIUM: number; LOW: number };
    resolutionRate: number;
    avgResolutionDays: number;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminApi.getReports({ category, priority, dateRange });
      if (res.success && res.data) {
        setMetrics(res.data);
      } else {
        setError(res.message || 'Unable to generate reports.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate governance report.');
    } finally {
      setIsLoading(false);
    }
  }, [category, priority, dateRange]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      await adminApi.exportCsv({ category, priority, dateRange });
      success('Audited CSV report downloaded.');
    } catch (err: any) {
      toastError(err.message || 'Failed to export CSV report.');
    } finally {
      setIsExporting(false);
    }
  };

  const activeWorkCount = metrics ? metrics.inProgress + (metrics.assigned ?? 0) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Governance Reports & Export
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Performance audits, priority mix, SLA resolution durations, and official CSV export.
          </p>
        </div>

        {/* Authenticated CSV Export Button */}
        <Button
          size="md"
          variant="primary"
          isLoading={isExporting}
          onClick={handleExportCsv}
          leftIcon={<Download className="w-4 h-4" />}
          className="shadow-cyber-sm"
        >
          Export Audited CSV Report
        </Button>
      </div>

      {/* Filter Options */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-card grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-cyber-blue flex-shrink-0" />
          <div className="flex-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-cyber-cyan"
            >
              <option value="ALL">All Civic Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Flag className="w-4 h-4 text-cyber-blue flex-shrink-0" />
          <div className="flex-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-cyber-cyan"
            >
              <option value="ALL">All Priorities</option>
              <option value="HIGH">High Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="LOW">Low Priority</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-cyber-blue flex-shrink-0" />
          <div className="flex-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
              Reporting Timeframe
            </label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-cyber-cyan"
            >
              <option value="ALL">All Time</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 3 Months</option>
              <option value="1y">Last 1 Year</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <CardSkeleton count={4} />
      ) : error || !metrics ? (
        <div className="rounded-3xl bg-rose-50 border border-rose-200 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-rose-900">Failed to Load Report Summary</h3>
              <p className="text-xs text-rose-700 mt-0.5">{error || 'Unable to compute report.'}</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchReports}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Retry
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Complaints Analyzed"
            value={metrics.total}
            subtitle={
              metrics.priorityCounts
                ? `${metrics.priorityCounts.HIGH} High, ${metrics.priorityCounts.MEDIUM} Med, ${metrics.priorityCounts.LOW} Low`
                : 'Within selected filter scope'
            }
            icon={<FileSpreadsheet className="w-5 h-5 text-cyber-blue" />}
            gradient="cyan"
          />
          <StatCard
            title="Resolution Success Rate"
            value={`${metrics.resolutionRate}%`}
            subtitle={`${metrics.resolved} of ${metrics.total} solved`}
            icon={<Percent className="w-5 h-5 text-emerald-500" />}
            gradient="emerald"
          />
          <StatCard
            title="Average Resolution Time"
            value={`${metrics.avgResolutionDays} Days`}
            subtitle="From submission to completion"
            icon={<Timer className="w-5 h-5 text-purple-600" />}
            gradient="purple"
          />
          <StatCard
            title="Pending & In-Progress"
            value={metrics.pending + activeWorkCount}
            subtitle={`${metrics.pending} pending, ${activeWorkCount} active`}
            icon={<Clock className="w-5 h-5 text-amber-500" />}
            gradient="amber"
          />
        </div>
      )}

      {/* Report Summary Narrative */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-card space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-cyber-blue" />
          <span>Performance Overview & Audit Summary</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-600">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
            <span className="font-bold text-slate-800 block text-sm">
              Grievance Lifecycle Efficiency
            </span>
            <p className="leading-relaxed">
              Based on active records, the Gram Panchayat achieves an average resolution duration of{' '}
              <strong>{metrics?.avgResolutionDays || 0} days</strong> across the selected civic grievance scope.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
            <span className="font-bold text-slate-800 block text-sm">
              Data Integrity & Official CSV Export
            </span>
            <p className="leading-relaxed">
              Exporting the report generates a standard UTF-8 CSV containing Complaint IDs, Priority levels, civic categories, exact ward landmarks, citizen contacts, assigned staff, and submission/completion timestamps.
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            Category: <strong>{category === 'ALL' ? 'All Categories' : category}</strong>
          </span>
          <span>
            Priority: <strong>{priority === 'ALL' ? 'All Priorities' : priority}</strong>
          </span>
          <span>
            Time Scope: <strong>{dateRange === 'ALL' ? 'Complete Records' : dateRange}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
