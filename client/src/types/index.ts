export type UserRole = 'CITIZEN' | 'ADMIN';

export type ComplaintStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'REJECTED';

export type ComplaintPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export type ComplaintCategory =
  | 'Road Issues'
  | 'Street Light Problems'
  | 'Water Supply Issues'
  | 'Drainage & Sanitation'
  | 'Waste Management'
  | 'Public Facilities'
  | 'Other';

export interface User {
  id: string;
  name: string;
  email: string;
  mobile: string;
  address: string;
  role: UserRole;
  createdAt: string;
  unreadNotificationsCount?: number;
  totalComplaintsCount?: number;
}

export interface ComplaintStatusHistory {
  id: string;
  complaintId: string;
  status: ComplaintStatus;
  remarks?: string | null;
  changedBy: string;
  createdAt: string;
}

export interface Feedback {
  id: string;
  complaintId: string;
  userId: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
}

export interface Complaint {
  id: string;
  complaintNumber: string;
  userId: string;
  category: ComplaintCategory;
  title: string;
  description: string;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  imageUrl?: string | null;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  assignedDepartment?: string | null;
  assignedStaff?: string | null;
  submittedAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  user?: {
    id?: string;
    name: string;
    email?: string;
    mobile?: string;
    address?: string;
  };
  statusHistory?: ComplaintStatusHistory[];
  feedback?: Feedback | null;
}

export interface NotificationItem {
  id: string;
  userId: string;
  complaintId?: string | null;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface PortalStats {
  totalComplaints: number;
  resolvedComplaints: number;
  inProgressComplaints: number;
  pendingComplaints: number;
  assignedComplaints: number;
  resolutionRate: number;
}

export interface AdminDashboardData {
  totalComplaints: number;
  submitted: number;
  underReview: number;
  pendingReview: number;
  assigned: number;
  inProgress: number;
  activeComplaints: number;
  resolved: number;
  rejected: number;
  totalCitizens: number;
  resolutionRate: number;
  priorityCounts: {
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
  highPriorityPending: number;
  mediumPriorityPending: number;
  lowPriorityPending: number;
  recentComplaints: Complaint[];
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  pagination?: Pagination;
  unreadCount?: number;
  token?: string;
  user?: User;
}
