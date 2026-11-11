import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { adminApi } from '../../services/api';
import { Complaint, ComplaintPriority, Pagination as PaginationType } from '../../types';
import { useToast } from '../../context/ToastContext';
import {
  Search,
  Eye,
  X,
  Download,
  Image as ImageIcon,
  AlertTriangle,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { StatusBadge } from '../../components/common/StatusBadge';
import { PriorityBadge } from '../../components/common/PriorityBadge';
import { CategoryBadge } from '../../components/common/CategoryBadge';
import { Pagination } from '../../components/common/Pagination';
import { TableSkeleton } from '../../components/common/SkeletonLoader';
import { EmptyState } from '../../components/common/EmptyState';

const CATEGORIES = [
  'Road Issues',
  'Street Light Problems',
  'Water Supply Issues',
  'Drainage & Sanitation',
  'Waste Management',
  'Public Facilities',
  'Other',
];

const PRIORITIES: { label: string; value: string }[] = [
  { label: 'All Priorities', value: 'ALL' },
  { label: 'High Priority', value: 'HIGH' },
  { label: 'Medium Priority', value: 'MEDIUM' },
  { label: 'Low Priority', value: 'LOW' },
];

const STATUSES = [
  { label: 'All Statuses', value: 'ALL' },
  { label: 'Pending (New & Under Review)', value: 'PENDING' },
  { label: 'In Progress (Assigned & Active)', value: 'ACTIVE' },
  { label: 'Submitted (New Only)', value: 'SUBMITTED' },
  { label: 'Under Review', value: 'UNDER_REVIEW' },
  { label: 'Assigned', value: 'ASSIGNED' },
  { label: 'In Progress (Field Work Only)', value: 'IN_PROGRESS' },
  { label: 'Resolved', value: 'RESOLVED' },
  { label: 'Rejected', value: 'REJECTED' },
];

const DEPARTMENTS = [
  { label: 'All Departments', value: 'ALL' },
  { label: 'Unassigned Only', value: 'UNASSIGNED' },
  { label: 'Road Maintenance', value: 'Road Maintenance' },
  { label: 'Water Supply', value: 'Water Supply' },
  { label: 'Sanitation', value: 'Sanitation' },
  { label: 'Street Lighting', value: 'Street Lighting' },
  { label: 'Waste Management', value: 'Waste Management' },
  { label: 'Public Facilities', value: 'Public Facilities' },
  { label: 'Administration', value: 'Administration' },
];

const DATE_RANGES = [
  { label: 'All Dates', value: 'ALL' },
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 30 Days', value: '30d' },
  { label: 'Last 3 Months', value: '90d' },
  { label: 'Last 1 Year', value: '1y' },
];

export const AdminComplaintsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const { success, error: toastError } = useToast();

  // Derive active filter state directly from URL query parameters
  const appliedSearch = searchParams.get('search') || '';
  const selectedStatus = (searchParams.get('status') || 'ALL').toUpperCase();
  const selectedPriority = (searchParams.get('priority') || 'ALL').toUpperCase();
  const selectedCategory = searchParams.get('category') || 'ALL';
  const selectedDepartment = searchParams.get('department') || 'ALL';
  const dateRange = searchParams.get('dateRange') || 'ALL';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);

  const [searchDraft, setSearchDraft] = useState(appliedSearch);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const [pagination, setPagination] = useState<PaginationType>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });

  // Sync draft search box when URL changes externally (e.g. Back button / reset)
  useEffect(() => {
    setSearchDraft(appliedSearch);
  }, [appliedSearch]);

  const updateUrlParams = useCallback(
    (updates: Record<string, string | undefined>, resetPage = true) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(updates).forEach(([key, val]) => {
        if (!val || val === 'ALL') {
          next.delete(key);
        } else {
          next.set(key, val);
        }
      });
      if (resetPage) {
        next.delete('page');
      }
      setSearchParams(next);
    },
    [searchParams, setSearchParams]
  );

  const fetchComplaints = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminApi.getComplaints({
        search: appliedSearch || undefined,
        status: selectedStatus,
        priority: selectedPriority,
        category: selectedCategory,
        department: selectedDepartment,
        dateRange,
        page,
        limit: 10,
      });

      if (res.success && res.data) {
        setComplaints(res.data);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      } else {
        setError(res.message || 'Unable to retrieve complaints list.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load complaints. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [
    appliedSearch,
    selectedStatus,
    selectedPriority,
    selectedCategory,
    selectedDepartment,
    dateRange,
    page,
  ]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUrlParams({ search: searchDraft.trim() || undefined }, true);
  };

  const handleClearFilters = () => {
    setSearchDraft('');
    setSearchParams({});
  };

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      await adminApi.exportCsv({
        search: appliedSearch || undefined,
        status: selectedStatus,
        priority: selectedPriority,
        category: selectedCategory,
        department: selectedDepartment,
        dateRange,
      });
      success('Filtered CSV report downloaded.');
    } catch (err: any) {
      toastError(err.message || 'Failed to export CSV report.');
    } finally {
      setIsExporting(false);
    }
  };

  const hasActiveFilters =
    Boolean(appliedSearch) ||
    selectedStatus !== 'ALL' ||
    selectedPriority !== 'ALL' ||
    selectedCategory !== 'ALL' ||
    selectedDepartment !== 'ALL' ||
    dateRange !== 'ALL';

  const statusLabel =
    STATUSES.find((s) => s.value === selectedStatus)?.label || selectedStatus.replace('_', ' ');
  const priorityLabel =
    PRIORITIES.find((p) => p.value === selectedPriority)?.label || selectedPriority;
  const deptLabel =
    DEPARTMENTS.find((d) => d.value === selectedDepartment)?.label || selectedDepartment;
  const dateLabel = DATE_RANGES.find((d) => d.value === dateRange)?.label || dateRange;

  const isHighPendingPreset = selectedPriority === 'HIGH' && selectedStatus === 'PENDING';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Manage Civic Complaints
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Combine priority, status, category, department, and date filters with full pagination and shareable URLs.
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          isLoading={isExporting}
          onClick={handleExportCsv}
          leftIcon={<Download className="w-4 h-4 text-cyber-blue" />}
        >
          Export Filtered CSV
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-card space-y-4">
        {/* Quick Priority Filter Pills + High Priority & Pending Preset */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="inline-flex items-center gap-1.5 font-bold text-slate-500 mr-1">
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyber-blue" />
              Quick Priority:
            </span>
            {(
              [
                { label: 'All', value: 'ALL', cls: 'bg-slate-900 text-white' },
                { label: 'High', value: 'HIGH', cls: 'bg-red-600 text-white' },
                { label: 'Medium', value: 'MEDIUM', cls: 'bg-amber-500 text-white' },
                { label: 'Low', value: 'LOW', cls: 'bg-emerald-600 text-white' },
              ] as const
            ).map((item) => {
              const active = selectedPriority === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => updateUrlParams({ priority: item.value })}
                  className={`px-3 py-1 rounded-full font-bold transition-all ${
                    active
                      ? item.cls
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() =>
              isHighPendingPreset
                ? updateUrlParams({ priority: 'ALL', status: 'ALL' })
                : updateUrlParams({ priority: 'HIGH', status: 'PENDING' })
            }
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all ${
              isHighPendingPreset
                ? 'bg-red-600 text-white border-red-600 shadow-sm'
                : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>High Priority + Pending</span>
          </button>
        </div>

        <form onSubmit={handleSearchSubmit} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                placeholder="Search by ID (GP-2026-...), title, citizen name, phone, or location..."
                className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-cyber-cyan"
              />
              {searchDraft && (
                <button
                  type="button"
                  aria-label="Clear search text"
                  onClick={() => {
                    setSearchDraft('');
                    if (appliedSearch) updateUrlParams({ search: undefined });
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" variant="secondary">
                Search
              </Button>

              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  leftIcon={<X className="w-3.5 h-3.5" />}
                >
                  Reset Filters
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {/* Priority Select */}
            <select
              aria-label="Filter by Priority"
              value={selectedPriority}
              onChange={(e) => updateUrlParams({ priority: e.target.value as ComplaintPriority | 'ALL' })}
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-cyber-cyan"
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>

            {/* Status Select */}
            <select
              aria-label="Filter by Status"
              value={selectedStatus}
              onChange={(e) => updateUrlParams({ status: e.target.value })}
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-cyber-cyan"
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            {/* Category Select */}
            <select
              aria-label="Filter by Category"
              value={selectedCategory}
              onChange={(e) => updateUrlParams({ category: e.target.value })}
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-cyber-cyan"
            >
              <option value="ALL">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* Department Select */}
            <select
              aria-label="Filter by Department"
              value={selectedDepartment}
              onChange={(e) => updateUrlParams({ department: e.target.value })}
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-cyber-cyan"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>

            {/* Date Range Select */}
            <select
              aria-label="Filter by Date Range"
              value={dateRange}
              onChange={(e) => updateUrlParams({ dateRange: e.target.value })}
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-cyber-cyan"
            >
              {DATE_RANGES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        </form>

        {/* Active Filter Chips & Result Counter */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-bold text-slate-500">
              {isLoading
                ? 'Loading complaints...'
                : `${pagination.total} complaint${pagination.total === 1 ? '' : 's'} matched`}
            </span>

            {hasActiveFilters && (
              <>
                <span className="text-slate-300 mx-1">|</span>
                {selectedPriority !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => updateUrlParams({ priority: undefined })}
                    className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-2.5 py-0.5 rounded-full"
                  >
                    <span>Priority: {priorityLabel}</span>
                    <X className="w-3 h-3" />
                  </button>
                )}
                {selectedStatus !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => updateUrlParams({ status: undefined })}
                    className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-2.5 py-0.5 rounded-full"
                  >
                    <span>Status: {statusLabel}</span>
                    <X className="w-3 h-3" />
                  </button>
                )}
                {selectedCategory !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => updateUrlParams({ category: undefined })}
                    className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-2.5 py-0.5 rounded-full"
                  >
                    <span>Category: {selectedCategory}</span>
                    <X className="w-3 h-3" />
                  </button>
                )}
                {selectedDepartment !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => updateUrlParams({ department: undefined })}
                    className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-2.5 py-0.5 rounded-full"
                  >
                    <span>Dept: {deptLabel}</span>
                    <X className="w-3 h-3" />
                  </button>
                )}
                {dateRange !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => updateUrlParams({ dateRange: undefined })}
                    className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-2.5 py-0.5 rounded-full"
                  >
                    <span>Date: {dateLabel}</span>
                    <X className="w-3 h-3" />
                  </button>
                )}
                {appliedSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchDraft('');
                      updateUrlParams({ search: undefined });
                    }}
                    className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-2.5 py-0.5 rounded-full"
                  >
                    <span>Search: "{appliedSearch}"</span>
                    <X className="w-3 h-3" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Complaints Table Container */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-card space-y-4">
        {isLoading ? (
          <TableSkeleton rows={6} />
        ) : error ? (
          <div className="rounded-2xl bg-rose-50 border border-rose-200 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-rose-900">Failed to Load Complaints</h3>
                <p className="text-xs text-rose-700 mt-0.5">{error}</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={fetchComplaints}
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Retry
            </Button>
          </div>
        ) : complaints.length === 0 ? (
          <EmptyState
            title="No complaints match your criteria"
            description="Try modifying search keywords or resetting active priority, status, category, or date filters."
            actionText={hasActiveFilters ? 'Reset Filters' : undefined}
            onAction={hasActiveFilters ? handleClearFilters : undefined}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-3">Complaint ID</th>
                    <th className="py-3 px-3">Priority</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Issue Title</th>
                    <th className="py-3 px-3">Location</th>
                    <th className="py-3 px-3">Citizen Info</th>
                    <th className="py-3 px-3">Department</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {complaints.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-3 font-mono font-bold text-cyber-blue whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{c.complaintNumber}</span>
                          {c.imageUrl && (
                            <span
                              title="Photo Attached"
                              className="text-cyber-blue bg-cyan-50 p-0.5 rounded border border-cyan-100"
                            >
                              <ImageIcon className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <PriorityBadge priority={c.priority} size="sm" />
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <CategoryBadge category={c.category} size="sm" />
                      </td>
                      <td className="py-3.5 px-3 max-w-[190px] truncate text-slate-800" title={c.title}>
                        {c.title}
                      </td>
                      <td className="py-3.5 px-3 text-slate-500 max-w-[150px] truncate" title={c.location}>
                        {c.location}
                      </td>
                      <td className="py-3.5 px-3 text-slate-700 whitespace-nowrap">
                        <span className="font-bold block">{c.user?.name}</span>
                        <span className="text-[10px] text-slate-400">{c.user?.mobile}</span>
                      </td>
                      <td className="py-3.5 px-3 text-slate-600 whitespace-nowrap">
                        {c.assignedDepartment || (
                          <span className="text-amber-500 font-medium italic">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-slate-500 whitespace-nowrap">
                        {new Date(c.submittedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <StatusBadge status={c.status} size="sm" />
                      </td>
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <Link
                          to={`/admin/complaints/${c.id}`}
                          state={{ from: `${location.pathname}${location.search}` }}
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

            {/* Pagination Controls */}
            <Pagination
              pagination={pagination}
              onPageChange={(newPage) =>
                updateUrlParams({ page: newPage > 1 ? String(newPage) : undefined }, false)
              }
            />
          </>
        )}
      </div>
    </div>
  );
};
