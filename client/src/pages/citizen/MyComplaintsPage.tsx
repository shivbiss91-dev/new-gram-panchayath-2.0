import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { complaintApi } from '../../services/api';
import { Complaint, Pagination as PaginationType } from '../../types';
import {
  Search,
  Eye,
  PlusCircle,
  X,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { StatusBadge } from '../../components/common/StatusBadge';
import { PriorityBadge } from '../../components/common/PriorityBadge';
import { CategoryBadge } from '../../components/common/CategoryBadge';
import { Pagination } from '../../components/common/Pagination';
import { TableSkeleton } from '../../components/common/SkeletonLoader';
import { EmptyState } from '../../components/common/EmptyState';

const STATUS_FILTERS = [
  { label: 'All', value: 'ALL' },
  { label: 'Pending', value: 'SUBMITTED' },
  { label: 'Under Review', value: 'UNDER_REVIEW' },
  { label: 'Assigned', value: 'ASSIGNED' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Resolved', value: 'RESOLVED' },
  { label: 'Rejected', value: 'REJECTED' },
];

const CATEGORY_FILTERS = [
  'ALL',
  'Road Issues',
  'Street Light Problems',
  'Water Supply Issues',
  'Drainage & Sanitation',
  'Waste Management',
  'Public Facilities',
  'Other',
];

export const MyComplaintsPage: React.FC = () => {
  const navigate = useNavigate();

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedPriority, setSelectedPriority] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pagination, setPagination] = useState<PaginationType>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });

  const fetchComplaints = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await complaintApi.getComplaints({
        search: appliedSearch || undefined,
        status: selectedStatus,
        priority: selectedPriority,
        category: selectedCategory,
        page,
        limit: 10,
      });

      if (res.success && res.data) {
        setComplaints(res.data);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      } else {
        setError(res.message || 'Unable to retrieve your complaints.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load your complaints. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [appliedSearch, selectedStatus, selectedPriority, selectedCategory, page]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(search.trim());
  };

  const handleClearFilters = () => {
    setSearch('');
    setAppliedSearch('');
    setSelectedStatus('ALL');
    setSelectedPriority('ALL');
    setSelectedCategory('ALL');
    setPage(1);
  };

  const hasActiveFilters =
    Boolean(appliedSearch) ||
    selectedStatus !== 'ALL' ||
    selectedPriority !== 'ALL' ||
    selectedCategory !== 'ALL';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            My Complaints History
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Track, filter, and review all civic problems logged under your account.
          </p>
        </div>

        <Link to="/citizen/complaints/new">
          <Button
            size="md"
            leftIcon={<PlusCircle className="w-4 h-4" />}
            className="shadow-cyber-sm"
          >
            Submit New Complaint
          </Button>
        </Link>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-card space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ID (GP-2026-...), title, location, category..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-cyber-cyan"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Filter by Priority"
              value={selectedPriority}
              onChange={(e) => {
                setSelectedPriority(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-cyber-cyan"
            >
              <option value="ALL">All Priorities</option>
              <option value="HIGH">High Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="LOW">Low Priority</option>
            </select>

            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-cyber-cyan"
            >
              <option value="ALL">All Categories</option>
              {CATEGORY_FILTERS.filter((c) => c !== 'ALL').map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

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
                Clear
              </Button>
            )}
          </div>
        </form>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs border-t border-slate-100 pt-3">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-2 flex-shrink-0">
            Status:
          </span>
          {STATUS_FILTERS.map((tab) => {
            const isActive = selectedStatus === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => {
                  setSelectedStatus(tab.value);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-cyber-cyan text-cyber-deep shadow-sm font-bold'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Complaints List / Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-card space-y-4">
        {isLoading ? (
          <TableSkeleton rows={5} />
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
            title={hasActiveFilters ? 'No complaints match your filters' : 'No complaints recorded yet'}
            description={
              hasActiveFilters
                ? 'Try adjusting your search terms or selecting "All" statuses to broaden your results.'
                : 'Whenever you see an issue in your village ward, report it using the button below.'
            }
            actionText={hasActiveFilters ? 'Reset Filters' : 'Submit a Complaint'}
            onAction={hasActiveFilters ? handleClearFilters : () => navigate('/citizen/complaints/new')}
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
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {complaints.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-3 font-mono font-bold text-cyber-blue">
                        {c.complaintNumber}
                      </td>
                      <td className="py-3.5 px-3">
                        <PriorityBadge priority={c.priority} size="sm" />
                      </td>
                      <td className="py-3.5 px-3">
                        <CategoryBadge category={c.category} size="sm" />
                      </td>
                      <td className="py-3.5 px-3 max-w-[220px] truncate text-slate-800">
                        {c.title}
                      </td>
                      <td className="py-3.5 px-3 text-slate-500 max-w-[150px] truncate">
                        {c.location}
                      </td>
                      <td className="py-3.5 px-3 text-slate-500 whitespace-nowrap">
                        {new Date(c.submittedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3.5 px-3">
                        <StatusBadge status={c.status} size="sm" />
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <Link to={`/citizen/complaints/${c.id}`}>
                          <Button variant="outline" size="sm" className="text-[11px] py-1 px-2.5">
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            View
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
              onPageChange={(newPage) => setPage(newPage)}
            />
          </>
        )}
      </div>
    </div>
  );
};
