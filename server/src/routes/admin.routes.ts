import { Router, Response } from 'express';
import prisma from '../database';
import { authenticate, requireRole } from '../middleware/auth';
import { AuthenticatedRequest, ComplaintStatus } from '../types';
import {
  updateStatusSchema,
  updatePrioritySchema,
  assignComplaintSchema,
  COMPLAINT_STATUSES,
  COMPLAINT_PRIORITIES,
} from '../validators/schemas';
import { buildComplaintWhere } from '../utils/complaintFilters';

const router = Router();

// Protect all admin endpoints
router.use(authenticate);
router.use(requireRole('ADMIN'));

// GET /api/admin/dashboard - High-level statistics and recent complaints
router.get('/dashboard', async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const [
      total,
      submitted,
      underReview,
      assigned,
      inProgress,
      resolved,
      rejected,
      highPriority,
      mediumPriority,
      lowPriority,
      highPriorityPending,
      mediumPriorityPending,
      lowPriorityPending,
      recentComplaints,
      totalCitizens,
    ] = await Promise.all([
      prisma.complaint.count(),
      prisma.complaint.count({ where: { status: 'SUBMITTED' } }),
      prisma.complaint.count({ where: { status: 'UNDER_REVIEW' } }),
      prisma.complaint.count({ where: { status: 'ASSIGNED' } }),
      prisma.complaint.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.complaint.count({ where: { status: 'RESOLVED' } }),
      prisma.complaint.count({ where: { status: 'REJECTED' } }),
      prisma.complaint.count({ where: { priority: 'HIGH' } }),
      prisma.complaint.count({ where: { priority: 'MEDIUM' } }),
      prisma.complaint.count({ where: { priority: 'LOW' } }),
      prisma.complaint.count({
        where: { priority: 'HIGH', status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
      }),
      prisma.complaint.count({
        where: { priority: 'MEDIUM', status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
      }),
      prisma.complaint.count({
        where: { priority: 'LOW', status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
      }),
      prisma.complaint.findMany({
        take: 6,
        orderBy: { submittedAt: 'desc' },
        include: {
          user: { select: { name: true, mobile: true } },
        },
      }),
      prisma.user.count({ where: { role: 'CITIZEN' } }),
    ]);

    const pendingReview = submitted + underReview;
    const activeComplaints = assigned + inProgress;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    res.json({
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
        priorityCounts: {
          HIGH: highPriority,
          MEDIUM: mediumPriority,
          LOW: lowPriority,
        },
        highPriorityPending,
        mediumPriorityPending,
        lowPriorityPending,
        recentComplaints,
      },
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to load dashboard metrics.' });
  }
});

// GET /api/admin/complaints - List all complaints with full filtering, search & pagination
router.get('/complaints', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      search,
      status,
      priority,
      category,
      department,
      dateRange,
      page = '1',
      limit = '10',
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * take;

    const where = buildComplaintWhere({
      search,
      status,
      priority,
      category,
      department,
      dateRange,
    });

    const [total, complaints] = await Promise.all([
      prisma.complaint.count({ where }),
      prisma.complaint.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        skip,
        take,
        include: {
          user: {
            select: { id: true, name: true, email: true, mobile: true, address: true },
          },
          feedback: {
            select: { rating: true, comment: true },
          },
        },
      }),
    ]);

    res.json({
      success: true,
      data: complaints,
      pagination: {
        total,
        page: pageNum,
        limit: take,
        totalPages: Math.ceil(total / take) || 1,
      },
    });
  } catch (error) {
    console.error('Admin complaints fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve complaints.' });
  }
});

// GET /api/admin/complaints/:id - Detail view for admin
router.get('/complaints/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const complaint = await prisma.complaint.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          select: { id: true, name: true, email: true, mobile: true, address: true },
        },
        statusHistory: {
          orderBy: { createdAt: 'asc' },
        },
        feedback: true,
      },
    });

    if (!complaint) {
      res.status(404).json({ success: false, message: 'Complaint not found.' });
      return;
    }

    res.json({
      success: true,
      data: complaint,
    });
  } catch (error) {
    console.error('Admin get complaint detail error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve complaint.' });
  }
});

// Helper for status transition validation
function isValidTransition(current: string, target: string): boolean {
  if (current === target) return true;
  const validTransitions: Record<string, string[]> = {
    SUBMITTED: ['UNDER_REVIEW', 'ASSIGNED', 'IN_PROGRESS', 'REJECTED'],
    UNDER_REVIEW: ['ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'],
    ASSIGNED: ['UNDER_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'],
    IN_PROGRESS: ['ASSIGNED', 'RESOLVED', 'REJECTED'],
    RESOLVED: ['UNDER_REVIEW', 'IN_PROGRESS'], // allow reopening if needed
    REJECTED: ['UNDER_REVIEW', 'SUBMITTED'],
  };
  return validTransitions[current]?.includes(target) ?? false;
}

// PATCH /api/admin/complaints/:id/priority - Update complaint priority
router.patch('/complaints/:id/priority', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = updatePrioritySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.errors[0]?.message || 'Invalid priority value',
      });
      return;
    }

    const { priority: targetPriority, remarks } = parsed.data;

    const complaint = await prisma.complaint.findUnique({
      where: { id: req.params.id },
    });

    if (!complaint) {
      res.status(404).json({ success: false, message: 'Complaint not found.' });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const modified = await tx.complaint.update({
        where: { id: complaint.id },
        data: { priority: targetPriority },
      });

      await tx.complaintStatusHistory.create({
        data: {
          complaintId: complaint.id,
          status: complaint.status,
          remarks: `Priority updated from ${complaint.priority} to ${targetPriority}.${remarks ? ` ${remarks}` : ''}`,
          changedBy: req.user?.name || 'Administrator',
        },
      });

      if (complaint.priority !== targetPriority) {
        await tx.notification.create({
          data: {
            userId: complaint.userId,
            complaintId: complaint.id,
            title: `Complaint Priority Updated: ${targetPriority}`,
            message: `Your complaint (${complaint.complaintNumber}) priority was updated to ${targetPriority}.${remarks ? ` Remarks: ${remarks}` : ''}`,
          },
        });
      }

      return modified;
    });

    res.json({
      success: true,
      message: `Priority updated to ${targetPriority}.`,
      data: updated,
    });
  } catch (error) {
    console.error('Update complaint priority error:', error);
    res.status(500).json({ success: false, message: 'Failed to update complaint priority.' });
  }
});

// PATCH /api/admin/complaints/:id/status - Update complaint status & add remark
router.patch('/complaints/:id/status', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = updateStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.errors[0]?.message || 'Invalid status data',
      });
      return;
    }

    const { status: targetStatus, priority: targetPriority, remarks } = parsed.data;

    const complaint = await prisma.complaint.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });

    if (!complaint) {
      res.status(404).json({ success: false, message: 'Complaint not found.' });
      return;
    }

    if (!isValidTransition(complaint.status, targetStatus)) {
      res.status(400).json({
        success: false,
        message: `Invalid status transition from "${complaint.status}" to "${targetStatus}".`,
      });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const isResolved = targetStatus === 'RESOLVED';
      const resolvedAt = isResolved ? new Date() : (targetStatus === 'REJECTED' ? null : complaint.resolvedAt);

      const modified = await tx.complaint.update({
        where: { id: complaint.id },
        data: {
          status: targetStatus,
          ...(targetPriority ? { priority: targetPriority } : {}),
          resolvedAt,
        },
      });

      const priorityNote =
        targetPriority && targetPriority !== complaint.priority
          ? ` Priority changed to ${targetPriority}.`
          : '';

      // Status history entry
      await tx.complaintStatusHistory.create({
        data: {
          complaintId: complaint.id,
          status: targetStatus,
          remarks: `${remarks || `Status updated to ${targetStatus} by Administrator.`}${priorityNote}`.trim(),
          changedBy: req.user?.name || 'Administrator',
        },
      });

      // Notification for citizen
      await tx.notification.create({
        data: {
          userId: complaint.userId,
          complaintId: complaint.id,
          title: `Complaint Status Updated: ${targetStatus.replace('_', ' ')}`,
          message: `Your complaint (${complaint.complaintNumber}) is now marked as ${targetStatus.replace('_', ' ')}.${remarks ? ` Remarks: ${remarks}` : ''}`,
        },
      });

      return modified;
    });

    res.json({
      success: true,
      message: `Status successfully updated to ${targetStatus}.`,
      data: updated,
    });
  } catch (error) {
    console.error('Update complaint status error:', error);
    res.status(500).json({ success: false, message: 'Failed to update complaint status.' });
  }
});

// PATCH /api/admin/complaints/:id/assign - Assign department and staff
router.patch('/complaints/:id/assign', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = assignComplaintSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.errors[0]?.message || 'Invalid assignment details',
      });
      return;
    }

    const { assignedDepartment, assignedStaff, priority: targetPriority, remarks } = parsed.data;

    const complaint = await prisma.complaint.findUnique({
      where: { id: req.params.id },
    });

    if (!complaint) {
      res.status(404).json({ success: false, message: 'Complaint not found.' });
      return;
    }

    // If currently SUBMITTED or UNDER_REVIEW, transition automatically to ASSIGNED
    const newStatus =
      complaint.status === 'SUBMITTED' || complaint.status === 'UNDER_REVIEW'
        ? 'ASSIGNED'
        : complaint.status;

    const updated = await prisma.$transaction(async (tx) => {
      const modified = await tx.complaint.update({
        where: { id: complaint.id },
        data: {
          assignedDepartment,
          assignedStaff,
          ...(targetPriority ? { priority: targetPriority } : {}),
          status: newStatus,
        },
      });

      const priorityNote =
        targetPriority && targetPriority !== complaint.priority
          ? ` Priority set to ${targetPriority}.`
          : '';

      await tx.complaintStatusHistory.create({
        data: {
          complaintId: complaint.id,
          status: newStatus,
          remarks: `Assigned to ${assignedDepartment} (${assignedStaff}).${priorityNote} ${remarks || ''}`.trim(),
          changedBy: req.user?.name || 'Administrator',
        },
      });

      await tx.notification.create({
        data: {
          userId: complaint.userId,
          complaintId: complaint.id,
          title: 'Staff / Department Assigned',
          message: `Your complaint ${complaint.complaintNumber} has been assigned to ${assignedDepartment} (${assignedStaff}).`,
        },
      });

      return modified;
    });

    res.json({
      success: true,
      message: 'Complaint successfully assigned.',
      data: updated,
    });
  } catch (error) {
    console.error('Assign complaint error:', error);
    res.status(500).json({ success: false, message: 'Failed to assign complaint.' });
  }
});

// GET /api/admin/users - Registered citizens list with search and pagination
router.get('/users', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { search, page = '1', limit = '10' } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * take;

    const where: any = { role: 'CITIZEN' };

    if (search && search.trim() !== '') {
      const q = search.trim();
      where.OR = [
        { name: { contains: q } },
        { email: { contains: q } },
        { mobile: { contains: q } },
        { address: { contains: q } },
      ];
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          name: true,
          email: true,
          mobile: true,
          address: true,
          createdAt: true,
          _count: {
            select: { complaints: true },
          },
        },
      }),
    ]);

    const formattedUsers = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      mobile: u.mobile,
      address: u.address,
      createdAt: u.createdAt,
      complaintCount: u._count.complaints,
      status: 'Active',
    }));

    res.json({
      success: true,
      data: formattedUsers,
      pagination: {
        total,
        page: pageNum,
        limit: take,
        totalPages: Math.ceil(total / take) || 1,
      },
    });
  } catch (error) {
    console.error('Admin users fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve users.' });
  }
});

// GET /api/admin/analytics - Real database analytics for charts
router.get('/analytics', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { timeRange = '30d' } = req.query as { timeRange?: string };

    const now = new Date();
    let startDate = new Date();
    if (timeRange === '7d') startDate.setDate(now.getDate() - 7);
    else if (timeRange === '30d') startDate.setDate(now.getDate() - 30);
    else if (timeRange === '3m') startDate.setMonth(now.getMonth() - 3);
    else if (timeRange === '6m') startDate.setMonth(now.getMonth() - 6);
    else if (timeRange === '1y') startDate.setFullYear(now.getFullYear() - 1);
    else startDate.setDate(now.getDate() - 30);

    const complaints = await prisma.complaint.findMany({
      where: { submittedAt: { gte: startDate } },
      select: {
        id: true,
        category: true,
        status: true,
        priority: true,
        submittedAt: true,
        resolvedAt: true,
      },
      orderBy: { submittedAt: 'asc' },
    });

    // 1. Category Distribution
    const categoryCounts: Record<string, number> = {};
    const defaultCategories = [
      'Road Issues',
      'Street Light Problems',
      'Water Supply Issues',
      'Drainage & Sanitation',
      'Waste Management',
      'Public Facilities',
      'Other',
    ];
    defaultCategories.forEach((c) => (categoryCounts[c] = 0));

    complaints.forEach((c) => {
      categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
    });

    const categoryData = Object.entries(categoryCounts).map(([name, count]) => ({
      category: name,
      count,
    }));

    // 2. Status Distribution
    const statusCounts: Record<string, number> = {};
    COMPLAINT_STATUSES.forEach((s) => (statusCounts[s] = 0));
    complaints.forEach((c) => {
      statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
    });

    const statusData = Object.entries(statusCounts).map(([name, value]) => ({
      name: name.replace('_', ' '),
      statusKey: name,
      value,
    }));

    // 3. Priority Distribution
    const priorityCounts: Record<string, number> = {};
    COMPLAINT_PRIORITIES.forEach((p) => (priorityCounts[p] = 0));
    complaints.forEach((c) => {
      const p = COMPLAINT_PRIORITIES.includes(c.priority as any) ? c.priority : 'MEDIUM';
      priorityCounts[p] = (priorityCounts[p] || 0) + 1;
    });

    const priorityData = COMPLAINT_PRIORITIES.map((p) => ({
      priority: p,
      name: p.charAt(0) + p.slice(1).toLowerCase(),
      count: priorityCounts[p] || 0,
    }));

    // 4. Trend over time (grouped by date)
    const trendMap: Record<string, { date: string; submitted: number; resolved: number }> = {};

    complaints.forEach((c) => {
      const dateKey = c.submittedAt.toISOString().split('T')[0];
      if (!trendMap[dateKey]) {
        trendMap[dateKey] = { date: dateKey, submitted: 0, resolved: 0 };
      }
      trendMap[dateKey].submitted++;
      if (c.status === 'RESOLVED') {
        trendMap[dateKey].resolved++;
      }
    });

    const trendData = Object.values(trendMap).sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      success: true,
      data: {
        categoryData,
        statusData,
        priorityData,
        trendData,
        totalInRange: complaints.length,
      },
    });
  } catch (error) {
    console.error('Admin analytics error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate analytics.' });
  }
});

// GET /api/admin/reports - Performance metrics & resolution time
router.get('/reports', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { category, priority, dateRange } = req.query as Record<string, string>;
    const where = buildComplaintWhere({ category, priority, dateRange });

    const [total, resolved, assigned, inProgress, pending, highPriority, mediumPriority, lowPriority] = await Promise.all([
      prisma.complaint.count({ where }),
      prisma.complaint.count({ where: { AND: [where, { status: 'RESOLVED' }] } }),
      prisma.complaint.count({ where: { AND: [where, { status: 'ASSIGNED' }] } }),
      prisma.complaint.count({ where: { AND: [where, { status: 'IN_PROGRESS' }] } }),
      prisma.complaint.count({ where: { AND: [where, { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } }] } }),
      prisma.complaint.count({ where: { AND: [where, { priority: 'HIGH' }] } }),
      prisma.complaint.count({ where: { AND: [where, { priority: 'MEDIUM' }] } }),
      prisma.complaint.count({ where: { AND: [where, { priority: 'LOW' }] } }),
    ]);

    // Average resolution time for resolved complaints
    const resolvedComplaints = await prisma.complaint.findMany({
      where: {
        AND: [
          where,
          {
            status: 'RESOLVED',
            resolvedAt: { not: null },
          },
        ],
      },
      select: {
        submittedAt: true,
        resolvedAt: true,
      },
    });

    let avgResolutionDays = 0;
    if (resolvedComplaints.length > 0) {
      const totalDurationMs = resolvedComplaints.reduce((acc, c) => {
        if (c.resolvedAt) {
          return acc + (c.resolvedAt.getTime() - c.submittedAt.getTime());
        }
        return acc;
      }, 0);
      avgResolutionDays = Number((totalDurationMs / (resolvedComplaints.length * 1000 * 60 * 60 * 24)).toFixed(1));
    }

    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    res.json({
      success: true,
      data: {
        total,
        resolved,
        assigned,
        inProgress,
        pending,
        priorityCounts: {
          HIGH: highPriority,
          MEDIUM: mediumPriority,
          LOW: lowPriority,
        },
        resolutionRate,
        avgResolutionDays,
      },
    });
  } catch (error) {
    console.error('Admin reports error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate reports.' });
  }
});

// GET /api/admin/reports/export - Export complaints to CSV
router.get('/reports/export', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { category, status, priority, department, search, dateRange } = req.query as Record<string, string>;
    const where = buildComplaintWhere({
      category,
      status,
      priority,
      department,
      search,
      dateRange,
    });

    const complaints = await prisma.complaint.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      include: {
        user: { select: { name: true, mobile: true, email: true } },
      },
    });

    // Helper to sanitize CSV field
    const escapeCsv = (field: any) => {
      if (field === null || field === undefined) return '""';
      const str = String(field).replace(/"/g, '""');
      return `"${str}"`;
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
          (c.resolvedAt.getTime() - c.submittedAt.getTime()) /
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
        escapeCsv(c.user.name),
        escapeCsv(c.user.mobile),
        escapeCsv(c.submittedAt.toISOString()),
        escapeCsv(c.resolvedAt ? c.resolvedAt.toISOString() : 'N/A'),
        escapeCsv(resolutionDays),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=gram_panchayat_complaints_${new Date().toISOString().slice(0, 10)}.csv`
    );
    res.status(200).send(csvContent);
  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({ success: false, message: 'Failed to export CSV report.' });
  }
});

export default router;
