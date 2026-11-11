import {
  User,
  Complaint,
  ComplaintPriority,
  NotificationItem,
  PortalStats,
  AdminDashboardData,
  ComplaintStatus,
} from '../types';
import { INITIAL_USERS, INITIAL_COMPLAINTS, INITIAL_NOTIFICATIONS } from './mockData';
import { normalizePriority } from '../components/common/PriorityBadge';

const STORAGE_USERS = 'gp_mock_users';
const STORAGE_COMPLAINTS = 'gp_mock_complaints_v2';
const LEGACY_STORAGE_COMPLAINTS = 'gp_mock_complaints';
const STORAGE_NOTIFICATIONS = 'gp_mock_notifications';
const STORAGE_CURRENT_USER = 'gp_mock_current_user';

function getStored<T>(key: string, fallback: T): T {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

function setStored<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.warn('LocalStorage save error:', e);
  }
}

function normalizeComplaintRecord(c: any): Complaint {
  return {
    ...c,
    priority: normalizePriority(c?.priority),
  };
}

// Initialize storage with seeds if first run
export function initMockStorage() {
  if (!localStorage.getItem(STORAGE_USERS)) {
    setStored(STORAGE_USERS, INITIAL_USERS);
  }
  if (!localStorage.getItem(STORAGE_COMPLAINTS)) {
    // Safely migrate legacy stored complaints if any, assigning MEDIUM default priority
    const legacy = localStorage.getItem(LEGACY_STORAGE_COMPLAINTS);
    if (legacy) {
      try {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed) && parsed.length > INITIAL_COMPLAINTS.length) {
          setStored(STORAGE_COMPLAINTS, parsed.map(normalizeComplaintRecord));
        } else {
          setStored(STORAGE_COMPLAINTS, INITIAL_COMPLAINTS);
        }
      } catch {
        setStored(STORAGE_COMPLAINTS, INITIAL_COMPLAINTS);
      }
    } else {
      setStored(STORAGE_COMPLAINTS, INITIAL_COMPLAINTS);
    }
  }
  if (!localStorage.getItem(STORAGE_NOTIFICATIONS)) {
    setStored(STORAGE_NOTIFICATIONS, INITIAL_NOTIFICATIONS);
  }
}

initMockStorage();

function getUsers(): (User & { password?: string })[] {
  return getStored(STORAGE_USERS, INITIAL_USERS);
}

function getComplaints(): Complaint[] {
  const list = getStored<any[]>(STORAGE_COMPLAINTS, INITIAL_COMPLAINTS);
  return list
    .map(normalizeComplaintRecord)
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
}

function getNotifications(): NotificationItem[] {
  return getStored(STORAGE_NOTIFICATIONS, INITIAL_NOTIFICATIONS);
}

function matchesStatusFilter(complaintStatus: string, rawStatus?: string): boolean {
  if (!rawStatus) return true;
  const trimmed = rawStatus.trim().toUpperCase();
  if (!trimmed || trimmed === 'ALL') return true;
  const tokens = trimmed.split(',').map((t) => t.trim()).filter(Boolean);
  if (tokens.includes('ALL')) return true;

  const allowed = new Set<string>();
  tokens.forEach((tok) => {
    if (tok === 'PENDING') {
      allowed.add('SUBMITTED');
      allowed.add('UNDER_REVIEW');
    } else if (tok === 'ACTIVE' || tok === 'IN_PROGRESS_GROUP') {
      allowed.add('ASSIGNED');
      allowed.add('IN_PROGRESS');
    } else {
      allowed.add(tok);
    }
  });

  return allowed.has(complaintStatus.toUpperCase());
}

function matchesPriorityFilter(complaintPriority: string, rawPriority?: string): boolean {
  if (!rawPriority) return true;
  const trimmed = rawPriority.trim().toUpperCase();
  if (!trimmed || trimmed === 'ALL') return true;
  const tokens = trimmed.split(',').map((t) => t.trim()).filter(Boolean);
  if (tokens.includes('ALL')) return true;
  return tokens.includes(normalizePriority(complaintPriority));
}

function applyComplaintFilters(list: Complaint[], params: any = {}): Complaint[] {
  let filtered = [...list];

  if (params.status && params.status !== 'ALL') {
    filtered = filtered.filter((c) => matchesStatusFilter(c.status, params.status));
  }
  if (params.priority && params.priority !== 'ALL') {
    filtered = filtered.filter((c) => matchesPriorityFilter(c.priority, params.priority));
  }
  if (params.category && params.category !== 'ALL') {
    filtered = filtered.filter((c) => c.category === params.category);
  }
  if (params.department && params.department !== 'ALL') {
    if (params.department === 'UNASSIGNED') {
      filtered = filtered.filter((c) => !c.assignedDepartment);
    } else {
      filtered = filtered.filter((c) => c.assignedDepartment === params.department);
    }
  }
  if (params.dateRange && params.dateRange !== 'ALL') {
    const now = new Date();
    const pastDate = new Date(now);
    if (params.dateRange === '7d') pastDate.setDate(now.getDate() - 7);
    else if (params.dateRange === '30d') pastDate.setDate(now.getDate() - 30);
    else if (params.dateRange === '90d' || params.dateRange === '3m') pastDate.setDate(now.getDate() - 90);
    else if (params.dateRange === '6m') pastDate.setMonth(now.getMonth() - 6);
    else if (params.dateRange === '1y') pastDate.setFullYear(now.getFullYear() - 1);
    filtered = filtered.filter((c) => new Date(c.submittedAt).getTime() >= pastDate.getTime());
  }
  if (params.search && String(params.search).trim() !== '') {
    const q = String(params.search).trim().toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.complaintNumber.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        (c.assignedDepartment && c.assignedDepartment.toLowerCase().includes(q)) ||
        (c.assignedStaff && c.assignedStaff.toLowerCase().includes(q)) ||
        (c.user?.name && c.user.name.toLowerCase().includes(q)) ||
        (c.user?.mobile && c.user.mobile.toLowerCase().includes(q))
    );
  }

  return filtered;
}

export const mockService = {
  login: async (identifier: string, _password: string) => {
    initMockStorage();
    const users = getUsers();
    const cleanId = identifier.trim().toLowerCase();

    let user = users.find(
      (u) => u.email.toLowerCase() === cleanId || u.mobile === cleanId
    );

    if (!user && (cleanId.includes('admin') || cleanId.includes('officer'))) {
      user = users.find((u) => u.role === 'ADMIN');
    }

    if (!user) {
      user = users.find((u) => u.role === 'CITIZEN') || users[0];
    }

    const token = `mock-token-${user.id}-${Date.now()}`;
    localStorage.setItem(STORAGE_CURRENT_USER, JSON.stringify(user));

    return {
      success: true,
      token,
      user,
      message: 'Login successful (Demo Mode)',
    };
  },

  register: async (payload: any) => {
    initMockStorage();
    const users = getUsers();
    const newUser: User & { password?: string } = {
      id: `usr-cit-${Date.now()}`,
      name: payload.name || 'Citizen User',
      email: payload.email || `citizen${Date.now()}@example.com`,
      mobile: payload.mobile || '9800000000',
      address: payload.address || 'Gram Panchayat Area',
      role: 'CITIZEN',
      password: payload.password,
      createdAt: new Date().toISOString(),
      unreadNotificationsCount: 1,
      totalComplaintsCount: 0,
    };

    users.push(newUser);
    setStored(STORAGE_USERS, users);

    const token = `mock-token-${newUser.id}-${Date.now()}`;
    localStorage.setItem(STORAGE_CURRENT_USER, JSON.stringify(newUser));

    return {
      success: true,
      token,
      user: newUser,
      message: 'Registration successful (Demo Mode)',
    };
  },

  getProfile: async () => {
    initMockStorage();
    const stored = localStorage.getItem(STORAGE_CURRENT_USER);
    if (stored) {
      try {
        const user = JSON.parse(stored);
        return { success: true, data: user };
      } catch {}
    }
    const users = getUsers();
    return { success: true, data: users[1] || users[0] };
  },

  updateProfile: async (payload: any) => {
    initMockStorage();
    const users = getUsers();
    const current = await mockService.getProfile();
    const currentId = current.data?.id;

    const idx = users.findIndex((u) => u.id === currentId);
    if (idx !== -1) {
      users[idx] = { ...users[idx], ...payload };
      setStored(STORAGE_USERS, users);
      localStorage.setItem(STORAGE_CURRENT_USER, JSON.stringify(users[idx]));
      return { success: true, data: users[idx] };
    }
    return { success: true, data: { ...current.data, ...payload } };
  },

  getStats: async (): Promise<{ success: boolean; data: PortalStats }> => {
    initMockStorage();
    const list = getComplaints();
    const total = list.length;
    const resolved = list.filter((c) => c.status === 'RESOLVED').length;
    const inProgress = list.filter((c) => c.status === 'IN_PROGRESS').length;
    const assigned = list.filter((c) => c.status === 'ASSIGNED').length;
    const pending = list.filter((c) => ['SUBMITTED', 'UNDER_REVIEW'].includes(c.status)).length;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    return {
      success: true,
      data: {
        totalComplaints: total,
        resolvedComplaints: resolved,
        inProgressComplaints: inProgress,
        pendingComplaints: pending,
        assignedComplaints: assigned,
        resolutionRate,
      },
    };
  },

  trackComplaint: async (complaintNumber: string) => {
    initMockStorage();
    const list = getComplaints();
    const c = list.find(
      (item) => item.complaintNumber.toUpperCase() === complaintNumber.trim().toUpperCase()
    );

    if (!c) {
      throw new Error(`Complaint ${complaintNumber} not found.`);
    }

    return {
      success: true,
      data: c,
    };
  },

  getComplaints: async (params: any = {}) => {
    initMockStorage();
    let list = getComplaints();
    const profile = await mockService.getProfile();
    const currentUserId = profile.data?.id;

    if (profile.data?.role === 'CITIZEN') {
      list = list.filter((c) => c.userId === currentUserId || c.user?.email === profile.data?.email);
    }

    const filtered = applyComplaintFilters(list, params);
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Number(params.limit) || 10);
    const paginated = filtered.slice((page - 1) * limit, page * limit);

    return {
      success: true,
      data: paginated,
      pagination: {
        total: filtered.length,
        page,
        limit,
        totalPages: Math.ceil(filtered.length / limit) || 1,
      },
    };
  },

  getComplaintById: async (id: string) => {
    initMockStorage();
    const list = getComplaints();
    const c = list.find((item) => item.id === id || item.complaintNumber === id);
    if (!c) throw new Error('Complaint not found');
    return { success: true, data: c };
  },

  createComplaint: async (formData: FormData) => {
    initMockStorage();
    const list = getComplaints();
    const profile = await mockService.getProfile();
    const currentUser = profile.data;

    const year = new Date().getFullYear();
    const maxSeq = list.reduce((max, item) => {
      const m = item.complaintNumber.match(/^GP-\d{4}-(\d+)$/);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const complaintNumber = `GP-${year}-${String(maxSeq + 1).padStart(4, '0')}`;
    const newId = `cmp-${Date.now()}`;

    const title = (formData.get('title') as string) || 'Civic Issue';
    const category = (formData.get('category') as any) || 'Other';
    const description = (formData.get('description') as string) || '';
    const location = (formData.get('location') as string) || 'Ward Area';
    const priority = normalizePriority((formData.get('priority') as string) || 'MEDIUM');
    const latitude = formData.get('latitude') ? Number(formData.get('latitude')) : 18.5204;
    const longitude = formData.get('longitude') ? Number(formData.get('longitude')) : 73.8567;
    const rawFile = formData.get('image');
    const imageUrl =
      rawFile instanceof File && rawFile.size > 0
        ? URL.createObjectURL(rawFile)
        : null;

    const newComplaint: Complaint = {
      id: newId,
      complaintNumber,
      userId: currentUser?.id || 'usr-cit-1',
      category,
      title,
      description,
      location,
      latitude,
      longitude,
      imageUrl,
      priority,
      status: 'SUBMITTED',
      assignedDepartment: null,
      assignedStaff: null,
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      resolvedAt: null,
      user: {
        id: currentUser?.id,
        name: currentUser?.name || 'Citizen',
        email: currentUser?.email,
        mobile: currentUser?.mobile,
        address: currentUser?.address,
      },
      statusHistory: [
        {
          id: `sh-${Date.now()}`,
          complaintId: newId,
          status: 'SUBMITTED',
          remarks: 'Complaint submitted by citizen via Digital Portal.',
          changedBy: currentUser?.name || 'Citizen',
          createdAt: new Date().toISOString(),
        },
      ],
      feedback: null,
    };

    list.unshift(newComplaint);
    setStored(STORAGE_COMPLAINTS, list);

    return {
      success: true,
      data: newComplaint,
      message: 'Complaint submitted successfully.',
    };
  },

  submitFeedback: async (id: string, payload: { rating: number; comment?: string }) => {
    initMockStorage();
    const list = getComplaints();
    const idx = list.findIndex((c) => c.id === id || c.complaintNumber === id);
    if (idx !== -1) {
      list[idx].feedback = {
        id: `fb-${Date.now()}`,
        complaintId: list[idx].id,
        userId: list[idx].userId,
        rating: payload.rating,
        comment: payload.comment || null,
        createdAt: new Date().toISOString(),
      };
      setStored(STORAGE_COMPLAINTS, list);
    }
    return { success: true, message: 'Feedback recorded successfully.' };
  },

  // Admin APIs
  getAdminDashboard: async (): Promise<{ success: boolean; data: AdminDashboardData }> => {
    initMockStorage();
    const list = getComplaints();
    const users = getUsers();
    const total = list.length;
    const submitted = list.filter((c) => c.status === 'SUBMITTED').length;
    const underReview = list.filter((c) => c.status === 'UNDER_REVIEW').length;
    const pendingReview = submitted + underReview;
    const assigned = list.filter((c) => c.status === 'ASSIGNED').length;
    const inProgress = list.filter((c) => c.status === 'IN_PROGRESS').length;
    const activeComplaints = assigned + inProgress;
    const resolved = list.filter((c) => c.status === 'RESOLVED').length;
    const rejected = list.filter((c) => c.status === 'REJECTED').length;

    const priorityCounts = {
      HIGH: list.filter((c) => c.priority === 'HIGH').length,
      MEDIUM: list.filter((c) => c.priority === 'MEDIUM').length,
      LOW: list.filter((c) => c.priority === 'LOW').length,
    };

    const isPending = (c: Complaint) => c.status === 'SUBMITTED' || c.status === 'UNDER_REVIEW';
    const highPriorityPending = list.filter((c) => c.priority === 'HIGH' && isPending(c)).length;
    const mediumPriorityPending = list.filter((c) => c.priority === 'MEDIUM' && isPending(c)).length;
    const lowPriorityPending = list.filter((c) => c.priority === 'LOW' && isPending(c)).length;

    const totalCitizens = users.filter((u) => u.role === 'CITIZEN').length;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    return {
      success: true,
      data: {
        totalComplaints: total,
        submitted,
        underReview,
        pendingReview,
        assigned,
        inProgress,
        activeComplaints,
        resolved,
        rejected,
        totalCitizens,
        resolutionRate,
        priorityCounts,
        highPriorityPending,
        mediumPriorityPending,
        lowPriorityPending,
        recentComplaints: list.slice(0, 6),
      },
    };
  },

  getAdminComplaints: async (params: any = {}) => {
    initMockStorage();
    const filtered = applyComplaintFilters(getComplaints(), params);
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Number(params.limit) || 10);
    const paginated = filtered.slice((page - 1) * limit, page * limit);

    return {
      success: true,
      data: paginated,
      pagination: {
        total: filtered.length,
        page,
        limit,
        totalPages: Math.ceil(filtered.length / limit) || 1,
      },
    };
  },

  updatePriority: async (
    id: string,
    payload: { priority: ComplaintPriority; remarks?: string }
  ) => {
    initMockStorage();
    const list = getComplaints();
    const idx = list.findIndex((c) => c.id === id || c.complaintNumber === id);
    if (idx === -1) throw new Error('Complaint not found');

    const complaint = list[idx];
    const targetPriority = normalizePriority(payload.priority);
    const oldPriority = complaint.priority;
    complaint.priority = targetPriority;
    complaint.updatedAt = new Date().toISOString();

    if (!complaint.statusHistory) complaint.statusHistory = [];
    complaint.statusHistory.push({
      id: `sh-${Date.now()}`,
      complaintId: complaint.id,
      status: complaint.status,
      remarks: `Priority updated from ${oldPriority} to ${targetPriority}.${payload.remarks ? ` ${payload.remarks}` : ''}`,
      changedBy: 'Rajesh Shinde (Officer)',
      createdAt: new Date().toISOString(),
    });

    list[idx] = complaint;
    setStored(STORAGE_COMPLAINTS, list);
    return { success: true, data: complaint };
  },

  updateStatus: async (
    id: string,
    payload: { status: ComplaintStatus; priority?: ComplaintPriority; remarks?: string }
  ) => {
    initMockStorage();
    const list = getComplaints();
    const idx = list.findIndex((c) => c.id === id || c.complaintNumber === id);
    if (idx === -1) throw new Error('Complaint not found');

    const complaint = list[idx];
    const validTransitions: Record<string, string[]> = {
      SUBMITTED: ['UNDER_REVIEW', 'ASSIGNED', 'IN_PROGRESS', 'REJECTED'],
      UNDER_REVIEW: ['ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'],
      ASSIGNED: ['UNDER_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'],
      IN_PROGRESS: ['ASSIGNED', 'RESOLVED', 'REJECTED'],
      RESOLVED: ['UNDER_REVIEW', 'IN_PROGRESS'],
      REJECTED: ['UNDER_REVIEW', 'SUBMITTED'],
    };
    if (
      complaint.status !== payload.status &&
      !(validTransitions[complaint.status] || []).includes(payload.status)
    ) {
      throw new Error(`Invalid status transition from "${complaint.status}" to "${payload.status}".`);
    }

    complaint.status = payload.status;
    if (payload.priority) {
      complaint.priority = normalizePriority(payload.priority);
    }
    complaint.updatedAt = new Date().toISOString();
    if (payload.status === 'RESOLVED') {
      complaint.resolvedAt = new Date().toISOString();
    } else if (payload.status === 'REJECTED') {
      complaint.resolvedAt = null;
    }

    if (!complaint.statusHistory) complaint.statusHistory = [];
    complaint.statusHistory.push({
      id: `sh-${Date.now()}`,
      complaintId: complaint.id,
      status: payload.status,
      remarks: payload.remarks || `Status transitioned to ${payload.status}`,
      changedBy: 'Rajesh Shinde (Officer)',
      createdAt: new Date().toISOString(),
    });

    list[idx] = complaint;
    setStored(STORAGE_COMPLAINTS, list);
    return { success: true, data: complaint };
  },

  assignComplaint: async (
    id: string,
    payload: {
      assignedDepartment: string;
      assignedStaff: string;
      priority?: ComplaintPriority;
      remarks?: string;
    }
  ) => {
    initMockStorage();
    const list = getComplaints();
    const idx = list.findIndex((c) => c.id === id || c.complaintNumber === id);
    if (idx === -1) throw new Error('Complaint not found');

    const complaint = list[idx];
    complaint.assignedDepartment = payload.assignedDepartment;
    complaint.assignedStaff = payload.assignedStaff;
    if (payload.priority) {
      complaint.priority = normalizePriority(payload.priority);
    }
    if (complaint.status === 'SUBMITTED' || complaint.status === 'UNDER_REVIEW') {
      complaint.status = 'ASSIGNED';
    }
    complaint.updatedAt = new Date().toISOString();

    if (!complaint.statusHistory) complaint.statusHistory = [];
    complaint.statusHistory.push({
      id: `sh-${Date.now()}`,
      complaintId: complaint.id,
      status: complaint.status,
      remarks:
        payload.remarks || `Assigned to ${payload.assignedDepartment} (${payload.assignedStaff})`,
      changedBy: 'Rajesh Shinde (Officer)',
      createdAt: new Date().toISOString(),
    });

    list[idx] = complaint;
    setStored(STORAGE_COMPLAINTS, list);
    return { success: true, data: complaint };
  },

  getUsers: async (params: any = {}) => {
    initMockStorage();
    let users = getUsers().filter((u) => u.role === 'CITIZEN');
    if (params.search) {
      const q = params.search.toLowerCase();
      users = users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    return {
      success: true,
      data: users,
      pagination: {
        total: users.length,
        page: 1,
        limit: 10,
        totalPages: 1,
      },
    };
  },

  getAnalytics: async (timeRange = '30d') => {
    initMockStorage();
    const list = applyComplaintFilters(getComplaints(), { dateRange: timeRange });
    const categories: Record<string, number> = {
      'Road Issues': 0,
      'Street Light Problems': 0,
      'Water Supply Issues': 0,
      'Drainage & Sanitation': 0,
      'Waste Management': 0,
      'Public Facilities': 0,
      Other: 0,
    };
    const statuses: Record<string, number> = {
      SUBMITTED: 0,
      UNDER_REVIEW: 0,
      ASSIGNED: 0,
      IN_PROGRESS: 0,
      RESOLVED: 0,
      REJECTED: 0,
    };
    const priorities: Record<ComplaintPriority, number> = {
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    };

    const trendMap: Record<string, { date: string; submitted: number; resolved: number }> = {};

    list.forEach((c) => {
      categories[c.category] = (categories[c.category] || 0) + 1;
      statuses[c.status] = (statuses[c.status] || 0) + 1;
      priorities[c.priority] = (priorities[c.priority] || 0) + 1;

      const dateKey = new Date(c.submittedAt).toISOString().split('T')[0];
      if (!trendMap[dateKey]) {
        trendMap[dateKey] = { date: dateKey, submitted: 0, resolved: 0 };
      }
      trendMap[dateKey].submitted++;
      if (c.status === 'RESOLVED') trendMap[dateKey].resolved++;
    });

    const categoryData = Object.entries(categories).map(([category, count]) => ({ category, count }));
    const statusData = Object.entries(statuses).map(([statusKey, value]) => ({
      name: statusKey.replace('_', ' '),
      statusKey,
      value,
    }));
    const priorityData = (['HIGH', 'MEDIUM', 'LOW'] as ComplaintPriority[]).map((p) => ({
      priority: p,
      name: p.charAt(0) + p.slice(1).toLowerCase(),
      count: priorities[p] || 0,
    }));
    const trendData = Object.values(trendMap).sort((a, b) => a.date.localeCompare(b.date));

    return {
      success: true,
      data: {
        categoryData,
        statusData,
        priorityData,
        trendData,
        totalInRange: list.length,
      },
    };
  },

  getReports: async (params: { category?: string; priority?: string; dateRange?: string } = {}) => {
    initMockStorage();
    const list = applyComplaintFilters(getComplaints(), params);
    const total = list.length;
    const resolved = list.filter((c) => c.status === 'RESOLVED').length;
    const assigned = list.filter((c) => c.status === 'ASSIGNED').length;
    const inProgress = list.filter((c) => c.status === 'IN_PROGRESS').length;
    const pending = list.filter((c) => ['SUBMITTED', 'UNDER_REVIEW'].includes(c.status)).length;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    return {
      success: true,
      data: {
        total,
        resolved,
        assigned,
        inProgress,
        pending,
        priorityCounts: {
          HIGH: list.filter((c) => c.priority === 'HIGH').length,
          MEDIUM: list.filter((c) => c.priority === 'MEDIUM').length,
          LOW: list.filter((c) => c.priority === 'LOW').length,
        },
        resolutionRate,
        avgResolutionDays: 2.8,
      },
    };
  },

  exportCsv: async (params: any = {}): Promise<string> => {
    initMockStorage();
    const complaints = applyComplaintFilters(getComplaints(), params);

    const escapeCsv = (field: any) => {
      if (field === null || field === undefined) return '""';
      return `"${String(field).replace(/"/g, '""')}"`;
    };

    const headers = [
      'Complaint ID',
      'Priority',
      'Category',
      'Title',
      'Description',
      'Location',
      'Status',
      'Assigned Department',
      'Assigned Staff',
      'Citizen Name',
      'Citizen Mobile',
      'Submitted Date',
      'Resolved Date',
      'Resolution Days',
    ];

    const rows = complaints.map((c) => {
      let resolutionDays = '';
      if (c.resolvedAt) {
        resolutionDays = (
          (new Date(c.resolvedAt).getTime() - new Date(c.submittedAt).getTime()) /
          (1000 * 60 * 60 * 24)
        ).toFixed(1);
      }
      return [
        escapeCsv(c.complaintNumber),
        escapeCsv(c.priority || 'MEDIUM'),
        escapeCsv(c.category),
        escapeCsv(c.title),
        escapeCsv(c.description),
        escapeCsv(c.location),
        escapeCsv(c.status),
        escapeCsv(c.assignedDepartment || 'Unassigned'),
        escapeCsv(c.assignedStaff || 'Unassigned'),
        escapeCsv(c.user?.name || 'Citizen'),
        escapeCsv(c.user?.mobile || '-'),
        escapeCsv(c.submittedAt),
        escapeCsv(c.resolvedAt || 'N/A'),
        escapeCsv(resolutionDays),
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\r\n');
  },

  getNotifications: async () => {
    initMockStorage();
    const notifications = getNotifications();
    return {
      success: true,
      data: notifications,
    };
  },

  markNotificationRead: async (id: string) => {
    initMockStorage();
    const notifications = getNotifications();
    const idx = notifications.findIndex((n) => n.id === id);
    if (idx !== -1) {
      notifications[idx].read = true;
      setStored(STORAGE_NOTIFICATIONS, notifications);
    }
    return { success: true };
  },

  markAllNotificationsRead: async () => {
    initMockStorage();
    const notifications = getNotifications().map((n) => ({ ...n, read: true }));
    setStored(STORAGE_NOTIFICATIONS, notifications);
    return { success: true };
  },
};
