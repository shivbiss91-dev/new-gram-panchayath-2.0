import { COMPLAINT_PRIORITIES, COMPLAINT_STATUSES } from '../validators/schemas';

export interface ComplaintFilterQuery {
  search?: string;
  status?: string;
  priority?: string;
  category?: string;
  department?: string;
  dateRange?: string;
}

const PRIORITY_SET = new Set<string>(COMPLAINT_PRIORITIES);
const STATUS_SET = new Set<string>(COMPLAINT_STATUSES);

export function expandStatusFilter(rawStatus?: string): string[] | null {
  if (!rawStatus) return null;
  const trimmed = rawStatus.trim().toUpperCase();
  if (!trimmed || trimmed === 'ALL') return null;

  const tokens = trimmed
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (tokens.length === 0 || tokens.includes('ALL')) return null;

  const expanded: string[] = [];
  for (const token of tokens) {
    if (token === 'PENDING') {
      expanded.push('SUBMITTED', 'UNDER_REVIEW');
    } else if (token === 'ACTIVE' || token === 'IN_PROGRESS_GROUP') {
      expanded.push('ASSIGNED', 'IN_PROGRESS');
    } else if (STATUS_SET.has(token)) {
      expanded.push(token);
    }
  }

  return Array.from(new Set(expanded));
}

export function expandPriorityFilter(rawPriority?: string): string[] | null {
  if (!rawPriority) return null;
  const trimmed = rawPriority.trim().toUpperCase();
  if (!trimmed || trimmed === 'ALL') return null;

  const tokens = trimmed
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  if (tokens.length === 0 || tokens.includes('ALL')) return null;

  const valid = tokens.filter((p) => PRIORITY_SET.has(p));
  return Array.from(new Set(valid));
}

export function buildComplaintWhere(
  query: ComplaintFilterQuery,
  baseWhere: Record<string, any> = {}
): Record<string, any> {
  const where: Record<string, any> = { ...baseWhere };

  const statuses = expandStatusFilter(query.status);
  if (statuses !== null) {
    if (statuses.length === 0) {
      where.status = '__NO_MATCH__';
    } else if (statuses.length === 1) {
      where.status = statuses[0];
    } else {
      where.status = { in: statuses };
    }
  }

  const priorities = expandPriorityFilter(query.priority);
  if (priorities !== null) {
    if (priorities.length === 0) {
      where.priority = '__NO_MATCH__';
    } else if (priorities.length === 1) {
      where.priority = priorities[0];
    } else {
      where.priority = { in: priorities };
    }
  }

  if (query.category && query.category !== 'ALL') {
    where.category = query.category;
  }

  if (query.department && query.department !== 'ALL') {
    if (query.department === 'UNASSIGNED') {
      where.assignedDepartment = null;
    } else {
      where.assignedDepartment = query.department;
    }
  }

  if (query.dateRange && query.dateRange !== 'ALL') {
    const now = new Date();
    const pastDate = new Date(now);
    if (query.dateRange === '7d') pastDate.setDate(now.getDate() - 7);
    else if (query.dateRange === '30d') pastDate.setDate(now.getDate() - 30);
    else if (query.dateRange === '90d' || query.dateRange === '3m') pastDate.setDate(now.getDate() - 90);
    else if (query.dateRange === '6m') pastDate.setMonth(now.getMonth() - 6);
    else if (query.dateRange === '1y') pastDate.setFullYear(now.getFullYear() - 1);

    where.submittedAt = { gte: pastDate };
  }

  if (query.search && query.search.trim() !== '') {
    const q = query.search.trim();
    where.OR = [
      { complaintNumber: { contains: q } },
      { title: { contains: q } },
      { description: { contains: q } },
      { location: { contains: q } },
      { category: { contains: q } },
      { assignedDepartment: { contains: q } },
      { assignedStaff: { contains: q } },
      { user: { name: { contains: q } } },
      { user: { mobile: { contains: q } } },
    ];
  }

  return where;
}
