import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { adminApi } from '../../services/api';
import { Complaint, ComplaintPriority, ComplaintStatus } from '../../types';
import { useToast } from '../../context/ToastContext';
import { resolveComplaintImageUrl } from '../../utils/media';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  User,
  Clock,
  AlertTriangle,
  Briefcase,
  Star,
  Edit3,
  Image as ImageIcon,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  RotateCcw,
  Flag,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { StatusBadge } from '../../components/common/StatusBadge';
import { PriorityBadge, normalizePriority } from '../../components/common/PriorityBadge';
import { CategoryBadge } from '../../components/common/CategoryBadge';
import { Timeline } from '../../components/common/Timeline';
import { DetailSkeleton } from '../../components/common/SkeletonLoader';
import { ConfirmationDialog } from '../../components/common/ConfirmationDialog';

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

const ALLOWED_STATUSES: { label: string; value: ComplaintStatus }[] = [
  { label: 'Submitted (New)', value: 'SUBMITTED' },
  { label: 'Under Review', value: 'UNDER_REVIEW' },
  { label: 'Assigned', value: 'ASSIGNED' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Resolved', value: 'RESOLVED' },
  { label: 'Rejected', value: 'REJECTED' },
];

const VALID_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  SUBMITTED: ['UNDER_REVIEW', 'ASSIGNED', 'IN_PROGRESS', 'REJECTED'],
  UNDER_REVIEW: ['ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'],
  ASSIGNED: ['UNDER_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'],
  IN_PROGRESS: ['ASSIGNED', 'RESOLVED', 'REJECTED'],
  RESOLVED: ['UNDER_REVIEW', 'IN_PROGRESS'],
  REJECTED: ['UNDER_REVIEW', 'SUBMITTED'],
};

function isValidStatusTransition(current: ComplaintStatus, target: ComplaintStatus): boolean {
  if (current === target) return true;
  return VALID_TRANSITIONS[current]?.includes(target) ?? false;
}

const PRIORITY_OPTIONS: { label: string; value: ComplaintPriority; hint: string }[] = [
  { label: 'High', value: 'HIGH', hint: 'Critical safety hazard / urgent disruption' },
  { label: 'Medium', value: 'MEDIUM', hint: 'Standard repair within normal SLA' },
  { label: 'Low', value: 'LOW', hint: 'Routine upkeep & non-urgent work' },
];

export const AdminComplaintDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { success, error: toastError } = useToast();

  const backTarget = (location.state as { from?: string } | null)?.from || '/admin/complaints';

  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [imageLoadError, setImageLoadError] = useState(false);

  // Priority update state
  const [newPriority, setNewPriority] = useState<ComplaintPriority>('MEDIUM');
  const [priorityRemarks, setPriorityRemarks] = useState('');
  const [isUpdatingPriority, setIsUpdatingPriority] = useState(false);

  // Status Update Modal / Form State
  const [newStatus, setNewStatus] = useState<ComplaintStatus>('IN_PROGRESS');
  const [statusRemarks, setStatusRemarks] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  // Assignment Modal / Form State
  const [assignDept, setAssignDept] = useState('Road Maintenance');
  const [assignStaff, setAssignStaff] = useState(DEFAULT_STAFF['Road Maintenance'] || '');
  const [assignPriority, setAssignPriority] = useState<ComplaintPriority>('MEDIUM');
  const [assignRemarks, setAssignRemarks] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);

  const fetchComplaint = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setLoadError(null);
    setImageLoadError(false);
    try {
      const res = await adminApi.getComplaintById(id);
      if (res.success && res.data) {
        const record = res.data;
        const normalizedP = normalizePriority(record.priority);
        setComplaint({ ...record, priority: normalizedP });
        setNewPriority(normalizedP);
        setAssignPriority(normalizedP);
        setNewStatus(record.status);

        if (record.assignedDepartment) {
          setAssignDept(record.assignedDepartment);
          setAssignStaff(record.assignedStaff || DEFAULT_STAFF[record.assignedDepartment] || '');
        } else {
          setAssignDept('Road Maintenance');
          setAssignStaff(record.assignedStaff || DEFAULT_STAFF['Road Maintenance'] || '');
        }
      } else {
        setLoadError(res.message || 'Complaint not found.');
      }
    } catch (err: any) {
      setLoadError(err.message || 'Failed to retrieve complaint details.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchComplaint();
  }, [fetchComplaint]);

  const handlePriorityUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaint) return;

    setIsUpdatingPriority(true);
    try {
      const res = await adminApi.updatePriority(complaint.id, {
        priority: newPriority,
        remarks: priorityRemarks.trim() || undefined,
      });
      if (res.success) {
        success(`Priority updated to ${newPriority}!`);
        setPriorityRemarks('');
        fetchComplaint();
      } else {
        toastError(res.message || 'Failed to update priority.');
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to update priority.');
    } finally {
      setIsUpdatingPriority(false);
    }
  };

  const executeStatusTransition = async (target: ComplaintStatus, remarksText: string) => {
    if (!complaint) return;
    setIsUpdatingStatus(true);
    try {
      const res = await adminApi.updateStatus(complaint.id, {
        status: target,
        remarks: remarksText.trim(),
      });
      if (res.success) {
        success(`Status successfully changed to ${target.replace('_', ' ')}!`);
        setStatusRemarks('');
        setConfirmDialogOpen(false);
        fetchComplaint();
      } else {
        toastError(res.message || 'Failed to update status.');
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to update status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleStatusUpdate = () => executeStatusTransition(newStatus, statusRemarks);

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaint) return;
    if (!assignStaff.trim()) {
      toastError('Please enter the name of the assigned engineer or staff member.');
      return;
    }

    setIsAssigning(true);
    try {
      const res = await adminApi.assignComplaint(complaint.id, {
        assignedDepartment: assignDept,
        assignedStaff: assignStaff.trim(),
        priority: assignPriority,
        remarks: assignRemarks.trim(),
      });
      if (res.success) {
        success(`Complaint assigned to ${assignDept} (${assignStaff})!`);
        setAssignModalOpen(false);
        setAssignRemarks('');
        fetchComplaint();
      } else {
        toastError(res.message || 'Failed to assign complaint.');
      }
    } catch (err: any) {
      toastError(err.message || 'Assignment failed.');
    } finally {
      setIsAssigning(false);
    }
  };

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (loadError || !complaint) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 max-w-2xl mx-auto">
        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-800">Unable to Load Complaint Details</h3>
        <p className="text-xs text-slate-500 mt-1 mb-5">
          {loadError || 'The requested complaint record does not exist.'}
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchComplaint}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Retry
          </Button>
          <Link to={backTarget}>
            <Button variant="outline" size="sm">
              Back to Complaints
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const resolvedImageUrl = resolveComplaintImageUrl(complaint.imageUrl);
  const canMoveToReview = complaint.status === 'SUBMITTED';
  const canAssign = complaint.status !== 'RESOLVED' && complaint.status !== 'REJECTED';
  const canMoveInProgress =
    complaint.status === 'SUBMITTED' ||
    complaint.status === 'UNDER_REVIEW' ||
    complaint.status === 'ASSIGNED';
  const canResolve =
    complaint.status === 'UNDER_REVIEW' ||
    complaint.status === 'ASSIGNED' ||
    complaint.status === 'IN_PROGRESS';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Navigation & Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={backTarget}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-cyber-blue transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Complaints List</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {canMoveToReview && (
            <Button
              size="sm"
              variant="outline"
              disabled={isUpdatingStatus}
              onClick={() =>
                executeStatusTransition('UNDER_REVIEW', 'Taken up for administrative review.')
              }
            >
              Mark Under Review
            </Button>
          )}

          {canAssign && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setAssignPriority(normalizePriority(complaint.priority));
                setAssignModalOpen(true);
              }}
              leftIcon={<Briefcase className="w-4 h-4 text-cyber-blue" />}
            >
              {complaint.assignedDepartment ? 'Reassign Team' : 'Assign Department'}
            </Button>
          )}

          {canMoveInProgress && (
            <Button
              size="sm"
              variant="secondary"
              disabled={isUpdatingStatus}
              onClick={() =>
                executeStatusTransition('IN_PROGRESS', 'Field work moved into active progress.')
              }
              leftIcon={<RefreshCw className="w-3.5 h-3.5 text-cyber-cyan" />}
            >
              Move to In Progress
            </Button>
          )}

          {canResolve && (
            <Button
              size="sm"
              variant="primary"
              disabled={isUpdatingStatus}
              onClick={() => {
                setNewStatus('RESOLVED');
                setConfirmDialogOpen(true);
              }}
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
            >
              Mark Resolved
            </Button>
          )}
        </div>
      </div>

      {/* Main Dossier Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-card space-y-6">
        {/* Header Bar */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-6">
          <div>
            <div className="flex flex-wrap items-center gap-2.5 mb-2">
              <span className="font-mono text-base font-extrabold text-cyber-blue bg-cyan-50 px-3 py-1 rounded-xl border border-cyan-100">
                {complaint.complaintNumber}
              </span>
              <PriorityBadge priority={complaint.priority} size="md" showPriorityWord />
              <StatusBadge status={complaint.status} size="md" />
              <CategoryBadge category={complaint.category} />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-2">
              {complaint.title}
            </h1>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 text-right min-w-[190px]">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Department Assigned
            </span>
            <span className="text-xs font-bold text-slate-800 block mt-0.5">
              {complaint.assignedDepartment || (
                <span className="text-amber-600 font-semibold italic">Unassigned</span>
              )}
            </span>
            {complaint.assignedStaff && (
              <span className="text-[11px] text-slate-500 block">
                Staff: {complaint.assignedStaff}
              </span>
            )}
          </div>
        </div>

        {/* Citizen Information Card */}
        <div className="bg-cyber-dark/5 p-4 rounded-2xl border border-cyber-cyan/20 space-y-2">
          <div className="flex items-center justify-between border-b border-cyber-cyan/15 pb-2">
            <span className="text-xs font-bold text-cyber-deep flex items-center gap-1.5">
              <User className="w-4 h-4 text-cyber-blue" />
              Citizen Contact Details
            </span>
            <span className="text-[11px] text-slate-500">Registered Citizen</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
            <div>
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Name</span>
              <span className="font-bold text-slate-800">{complaint.user?.name || 'Citizen'}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Mobile</span>
              <span className="font-bold text-slate-800">{complaint.user?.mobile || '-'}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Ward Address</span>
              <span className="font-medium text-slate-700 truncate block">
                {complaint.user?.address || '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Location, Dates & Photo Indicator */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs text-slate-600 bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
          <div className="flex items-center gap-2.5">
            <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Site Location</span>
              <span className="font-semibold text-slate-800">{complaint.location}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Submitted At</span>
              <span className="font-semibold text-slate-800">
                {new Date(complaint.submittedAt).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Resolution Date</span>
              <span className="font-semibold text-slate-800">
                {complaint.resolvedAt
                  ? new Date(complaint.resolvedAt).toLocaleDateString()
                  : 'Pending'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <ImageIcon
              className={`w-4 h-4 flex-shrink-0 ${
                resolvedImageUrl ? 'text-emerald-600' : 'text-slate-400'
              }`}
            />
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Site Photo</span>
              <span className="font-semibold text-slate-800">
                {resolvedImageUrl ? 'Attached' : 'Not Provided'}
              </span>
            </div>
          </div>
        </div>

        {/* Problem Description */}
        <div>
          <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">
            Description
          </h3>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            {complaint.description}
          </div>
        </div>

        {/* Uploaded Evidence Photo */}
        {resolvedImageUrl && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                Citizen Photo Evidence
              </h3>
              <a
                href={resolvedImageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-bold text-cyber-blue hover:underline"
              >
                <span>Open Full Image</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <div className="rounded-2xl overflow-hidden border border-slate-200 max-w-lg bg-slate-100 shadow-sm">
              {imageLoadError ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  Attached image could not be previewed ({resolvedImageUrl}).
                </div>
              ) : (
                <img
                  src={resolvedImageUrl}
                  alt={`Evidence for ${complaint.complaintNumber}`}
                  onError={() => setImageLoadError(true)}
                  className="w-full h-auto object-cover max-h-96"
                />
              )}
            </div>
          </div>
        )}

        {/* Priority Management Control */}
        <form
          onSubmit={handlePriorityUpdate}
          className="bg-slate-50/70 p-6 rounded-2xl border border-slate-200 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Flag className="w-4 h-4 text-cyber-blue" />
              <h3 className="text-sm font-extrabold text-slate-900">
                Complaint Priority Level
              </h3>
            </div>
            <PriorityBadge priority={complaint.priority} size="sm" showPriorityWord />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {PRIORITY_OPTIONS.map((opt) => {
              const selected = newPriority === opt.value;
              const styleMap: Record<ComplaintPriority, string> = {
                HIGH: selected
                  ? 'border-red-500 bg-red-50 text-red-800 ring-1 ring-red-400'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-red-300',
                MEDIUM: selected
                  ? 'border-amber-500 bg-amber-50 text-amber-900 ring-1 ring-amber-400'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-amber-300',
                LOW: selected
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-400'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300',
              };
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setNewPriority(opt.value)}
                  className={`p-3 rounded-xl border text-left transition-all ${styleMap[opt.value]}`}
                >
                  <span className="text-xs font-extrabold block">{opt.label}</span>
                  <span className="text-[11px] opacity-80 block mt-0.5">{opt.hint}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Priority Note (Optional)
              </label>
              <input
                type="text"
                value={priorityRemarks}
                onChange={(e) => setPriorityRemarks(e.target.value)}
                placeholder="e.g. Escalated to High due to school traffic hazard..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-cyber-cyan"
              />
            </div>

            <Button
              type="submit"
              size="sm"
              variant="outline"
              isLoading={isUpdatingPriority}
              disabled={newPriority === complaint.priority && !priorityRemarks.trim()}
            >
              Update Priority
            </Button>
          </div>
        </form>

        {/* ADMIN STATUS UPDATE CONTROL */}
        <div className="bg-slate-50/70 p-6 rounded-2xl border border-slate-200 space-y-4">
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-cyber-blue" />
            <h3 className="text-sm font-extrabold text-slate-900">
              Update Complaint Status & Administrative Remarks
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Target Status *
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as ComplaintStatus)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-cyber-cyan"
              >
                {ALLOWED_STATUSES.map((st) => {
                  const allowed = isValidStatusTransition(complaint.status, st.value);
                  return (
                    <option key={st.value} value={st.value} disabled={!allowed}>
                      {st.label}
                      {!allowed ? ' (Requires intermediate step)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Official Remarks
              </label>
              <input
                type="text"
                value={statusRemarks}
                onChange={(e) => setStatusRemarks(e.target.value)}
                placeholder="e.g. Site surveyed by JE, bitumen mix work completed, line tested..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-cyber-cyan"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              size="sm"
              variant="primary"
              onClick={() => {
                if (newStatus === 'RESOLVED' || newStatus === 'REJECTED') {
                  setConfirmDialogOpen(true);
                } else {
                  handleStatusUpdate();
                }
              }}
              isLoading={isUpdatingStatus}
            >
              Update Status
            </Button>
          </div>
        </div>

        {/* Timeline Component */}
        <div className="pt-4 border-t border-slate-100">
          <Timeline currentStatus={complaint.status} history={complaint.statusHistory} />
        </div>

        {/* Citizen Feedback View if present */}
        {complaint.feedback && (
          <div className="pt-6 border-t border-slate-200">
            <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-200 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Citizen Feedback & Satisfaction Rating
              </span>
              <div className="flex items-center gap-1.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${
                      i < complaint.feedback!.rating
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-300'
                    }`}
                  />
                ))}
                <span className="text-xs font-bold text-slate-800 ml-2">
                  {complaint.feedback.rating}/5 Stars
                </span>
              </div>
              {complaint.feedback.comment && (
                <p className="text-xs text-slate-700 italic">"{complaint.feedback.comment}"</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Dialog for Status Change */}
      <ConfirmationDialog
        isOpen={confirmDialogOpen}
        title={newStatus === 'RESOLVED' ? 'Mark as Resolved?' : 'Reject / Close Complaint?'}
        message={
          newStatus === 'RESOLVED'
            ? 'Are you sure you want to certify this grievance as Resolved? This will notify the citizen and invite feedback.'
            : 'Are you sure you want to reject this complaint? Please ensure official remarks clearly state the jurisdiction reason.'
        }
        confirmText={newStatus === 'RESOLVED' ? 'Yes, Mark Resolved' : 'Yes, Close Grievance'}
        variant={newStatus === 'REJECTED' ? 'danger' : 'primary'}
        isLoading={isUpdatingStatus}
        onConfirm={handleStatusUpdate}
        onCancel={() => setConfirmDialogOpen(false)}
      />

      {/* Modal Dialog for Department Assignment */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-cyber-blue" />
                <span>Assign Responsible Team</span>
              </h3>
              <button
                type="button"
                onClick={() => setAssignModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Department / Division *
                </label>
                <select
                  value={assignDept}
                  onChange={(e) => {
                    const nextDept = e.target.value;
                    setAssignDept(nextDept);
                    setAssignStaff(DEFAULT_STAFF[nextDept] || '');
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-cyber-cyan"
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Responsible Staff / Engineer Name *
                </label>
                <input
                  type="text"
                  value={assignStaff}
                  onChange={(e) => setAssignStaff(e.target.value)}
                  placeholder="e.g. Mahesh Jadhav (Junior Engineer)"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-cyber-cyan"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Dispatch Priority
                </label>
                <select
                  value={assignPriority}
                  onChange={(e) => setAssignPriority(e.target.value as ComplaintPriority)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-cyber-cyan"
                >
                  <option value="HIGH">High Priority</option>
                  <option value="MEDIUM">Medium Priority</option>
                  <option value="LOW">Low Priority</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Work Order / Assignment Remarks
                </label>
                <input
                  type="text"
                  value={assignRemarks}
                  onChange={(e) => setAssignRemarks(e.target.value)}
                  placeholder="e.g. Priority dispatch with repair crew"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-cyber-cyan"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAssignModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" isLoading={isAssigning}>
                  Confirm Assignment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
