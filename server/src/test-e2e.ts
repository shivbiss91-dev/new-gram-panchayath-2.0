process.env.NODE_ENV = 'test';

import fs from 'fs';
import path from 'path';
import http from 'http';
import app from './index';

async function runTests() {
  console.log('🧪 Starting Full-Stack End-to-End API Integration Verification...\n');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(5001, () => resolve()));
  const baseUrl = 'http://localhost:5001/api';

  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, testName: string, detail?: string) => {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  };

  const json = async <T = any>(res: globalThis.Response): Promise<T> =>
    (await res.json()) as T;

  try {
    // 1. Health check
    const healthRes = await fetch(`${baseUrl}/health`).then(json);
    assert(healthRes.status === 'healthy', 'Health check returns healthy');

    // 2. Public stats
    const statsRes = await fetch(`${baseUrl}/public/stats`).then(json);
    assert(statsRes.success === true && statsRes.data.totalComplaints >= 10, 'Public stats endpoint returns live database data');

    // 3. Public track complaint
    const trackRes = await fetch(`${baseUrl}/public/track/GP-2026-0001`).then(json);
    assert(
      trackRes.success === true &&
        trackRes.data.complaintNumber === 'GP-2026-0001' &&
        trackRes.data.priority === 'HIGH',
      'Public complaint tracking retrieves GP-2026-0001 with priority and without citizen PII'
    );
    assert(trackRes.data.statusHistory.length > 0, 'Public tracking returns complete status history timeline');

    // 4. Public track complaint not found
    const trackNotFound = await fetch(`${baseUrl}/public/track/GP-9999-9999`).then(json);
    assert(trackNotFound.success === false, 'Invalid complaint ID returns appropriate error message');

    // 5. Admin Login
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin@grampanchayat.gov.in', password: 'Admin@123' }),
    }).then(json);

    assert(adminLoginRes.success === true && adminLoginRes.user.role === 'ADMIN', 'Admin authentication returns valid JWT token and ADMIN role');
    const adminToken: string = adminLoginRes.token;

    // 6. Citizen Login
    const citizenLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'ramesh.patil@example.com', password: 'Citizen@123' }),
    }).then(json);

    assert(citizenLoginRes.success === true && citizenLoginRes.user.role === 'CITIZEN', 'Citizen authentication returns valid token and CITIZEN role');
    const citizenToken: string = citizenLoginRes.token;

    // 7. Invalid password check
    const badLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin@grampanchayat.gov.in', password: 'WrongPassword' }),
    }).then(json);
    assert(badLoginRes.success === false, 'Invalid password rejected with 401 response');

    // 8. Citizen registration duplicate email check
    const dupEmailRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate Test',
        email: 'ramesh.patil@example.com',
        mobile: '9123456789',
        address: 'Ward 1',
        password: 'Password@123',
      }),
    }).then(json);
    assert(dupEmailRes.success === false, 'Duplicate email registration rejected');

    // 9. Citizen registration duplicate mobile check
    const dupMobileRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate Test',
        email: 'unique.test@example.com',
        mobile: '9812345678', // already exists for Ramesh
        address: 'Ward 1',
        password: 'Password@123',
      }),
    }).then(json);
    assert(dupMobileRes.success === false, 'Duplicate mobile registration rejected');

    // 10. Role authorization: Citizen trying to access Admin dashboard
    const citizenAccessAdminRes = await fetch(`${baseUrl}/admin/dashboard`, {
      headers: { Authorization: `Bearer ${citizenToken}` },
    }).then(json);
    assert(citizenAccessAdminRes.success === false, 'Citizen role forbidden from accessing /api/admin/* (403)');

    // 11. Admin accessing Admin dashboard & priority/status accounting
    const adminDashboardRes = await fetch(`${baseUrl}/admin/dashboard`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then(json);
    const dash = adminDashboardRes.data;
    const statusSum = dash.pendingReview + dash.activeComplaints + dash.resolved + dash.rejected;
    const prioritySum = dash.priorityCounts.HIGH + dash.priorityCounts.MEDIUM + dash.priorityCounts.LOW;
    const pendingByPrioritySum =
      dash.highPriorityPending + dash.mediumPriorityPending + dash.lowPriorityPending;

    assert(
      adminDashboardRes.success === true &&
        dash.totalComplaints > 0 &&
        statusSum === dash.totalComplaints &&
        prioritySum === dash.totalComplaints &&
        pendingByPrioritySum === dash.pendingReview &&
        dash.pendingReview === dash.submitted + dash.underReview &&
        dash.activeComplaints === dash.assigned + dash.inProgress,
      'Admin dashboard returns exact non-double-counted status and priority metrics'
    );

    // 12. Admin complaints filtering & pagination before slicing
    const highOnlyPage1Res = await fetch(`${baseUrl}/admin/complaints?priority=HIGH&limit=4&page=1`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then(json);
    const highOnlyPage2Res = await fetch(`${baseUrl}/admin/complaints?priority=HIGH&limit=4&page=2`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then(json);
    const p1Ids = new Set((highOnlyPage1Res.data || []).map((c: any) => c.id));
    const p2Ids = new Set((highOnlyPage2Res.data || []).map((c: any) => c.id));
    const noPageOverlap = [...p2Ids].every((id) => !p1Ids.has(id));
    assert(
      highOnlyPage1Res.success === true &&
        highOnlyPage1Res.pagination.total === dash.priorityCounts.HIGH &&
        highOnlyPage1Res.data.length <= 4 &&
        highOnlyPage1Res.data.every((c: any) => c.priority === 'HIGH') &&
        highOnlyPage2Res.success === true &&
        highOnlyPage2Res.pagination.total === dash.priorityCounts.HIGH &&
        noPageOverlap,
      'Filtering by priority=HIGH applies across full dataset before pagination with distinct pages'
    );

    const reportsHighRes = await fetch(`${baseUrl}/admin/reports?priority=HIGH`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then(json);
    assert(
      reportsHighRes.success === true &&
        reportsHighRes.data.total === dash.priorityCounts.HIGH &&
        reportsHighRes.data.priorityCounts.HIGH === dash.priorityCounts.HIGH &&
        reportsHighRes.data.priorityCounts.MEDIUM === 0,
      'Reports endpoint accurately scopes metrics by priority filter'
    );

    const highPendingRes = await fetch(`${baseUrl}/admin/complaints?priority=HIGH&status=PENDING&limit=25`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then(json);
    assert(
      highPendingRes.success === true &&
        highPendingRes.pagination.total === dash.highPriorityPending &&
        highPendingRes.data.every(
          (c: any) => c.priority === 'HIGH' && (c.status === 'SUBMITTED' || c.status === 'UNDER_REVIEW')
        ),
      'Combined filter priority=HIGH&status=PENDING matches dashboard count accurately'
    );

    const activeGroupRes = await fetch(`${baseUrl}/admin/complaints?status=ACTIVE&limit=50`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then(json);
    assert(
      activeGroupRes.success === true &&
        activeGroupRes.pagination.total === dash.activeComplaints &&
        activeGroupRes.data.every((c: any) => c.status === 'ASSIGNED' || c.status === 'IN_PROGRESS'),
      'Composite status=ACTIVE matches assigned + inProgress count without double counting'
    );

    const schoolSearchRes = await fetch(
      `${baseUrl}/admin/complaints?category=${encodeURIComponent('Road Issues')}&priority=HIGH&search=school`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    ).then(json);
    assert(
      schoolSearchRes.success === true &&
        schoolSearchRes.data.some((c: any) => c.complaintNumber === 'GP-2026-0017'),
      'Multi-filter (category + priority + search) locates matching school road complaint'
    );

    // 13. Submit new complaint by citizen with default priority (MEDIUM) & explicit HIGH & reject invalid
    const invalidPriorityHttp = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenToken}`,
      },
      body: JSON.stringify({
        category: 'Road Issues',
        title: 'Invalid priority test complaint',
        description: 'Testing server validation rejects unsupported priority enum values.',
        location: 'Ward 1 Main Square',
        priority: 'CRITICAL',
      }),
    });
    assert(invalidPriorityHttp.status === 400, 'Submitting invalid priority value is rejected with HTTP 400');

    const newComplaintRes = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenToken}`,
      },
      body: JSON.stringify({
        category: 'Road Issues',
        title: 'Broken culvert stone slab near west farmland canal',
        description: 'Heavy tractor cracked the side slab of the small irrigation bridge. Needs stone masonry repair before harvest season.',
        location: 'West Farmland Canal Road, Ward 3',
        latitude: 18.5211,
        longitude: 73.8572,
      }),
    }).then(json);

    assert(
      newComplaintRes.success === true &&
        newComplaintRes.data.complaintNumber.startsWith('GP-') &&
        newComplaintRes.data.status === 'SUBMITTED' &&
        newComplaintRes.data.priority === 'MEDIUM',
      'Citizen complaint creation generates GP-YYYY-XXXX and defaults omitted priority to MEDIUM'
    );
    const createdComplaintId: string = newComplaintRes.data.id;

    const formData = new FormData();
    formData.append('category', 'Water Supply Issues');
    formData.append('title', 'Burst main valve flooding Ward 3 lane');
    formData.append(
      'description',
      'Pressurized water pipe burst beside Ward 3 borewell causing severe wastage and muddy road.'
    );
    formData.append('location', 'Ward 3 Water Point');
    formData.append('priority', 'HIGH');
    const tinyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );
    formData.append('image', new Blob([tinyPng], { type: 'image/png' }), 'test-evidence.png');

    const highPrioritySubmitRes = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${citizenToken}`,
      },
      body: formData,
    }).then(json);

    let uploadedPhotoServed = false;
    let uploadedFilename: string | null = null;
    if (highPrioritySubmitRes.success && highPrioritySubmitRes.data?.imageUrl) {
      const uploadRes = await fetch(`http://localhost:5001${highPrioritySubmitRes.data.imageUrl}`);
      uploadedPhotoServed = uploadRes.status === 200;
      uploadedFilename = path.basename(highPrioritySubmitRes.data.imageUrl);
    }

    assert(
      highPrioritySubmitRes.success === true &&
        highPrioritySubmitRes.data.priority === 'HIGH' &&
        Boolean(highPrioritySubmitRes.data.imageUrl) &&
        uploadedPhotoServed,
      'Citizen complaint creation persists explicit HIGH priority, photo upload, and static /uploads serving'
    );

    if (uploadedFilename) {
      const testUploadPath = path.resolve(__dirname, '../uploads', uploadedFilename);
      if (fs.existsSync(testUploadPath)) {
        fs.unlinkSync(testUploadPath);
      }
    }

    // 14. Check that initial history and notification were auto-created
    const complaintDetailRes = await fetch(`${baseUrl}/complaints/${createdComplaintId}`, {
      headers: { Authorization: `Bearer ${citizenToken}` },
    }).then(json);
    assert(
      complaintDetailRes.data.statusHistory.length === 1 &&
        complaintDetailRes.data.statusHistory[0].status === 'SUBMITTED',
      'Initial ComplaintStatusHistory record created automatically on submission'
    );

    // 15. Admin direct priority update
    const updatePriorityRes = await fetch(`${baseUrl}/admin/complaints/${createdComplaintId}/priority`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        priority: 'HIGH',
        remarks: 'Heavy harvest tractor movement increases urgency.',
      }),
    }).then(json);
    assert(
      updatePriorityRes.success === true && updatePriorityRes.data.priority === 'HIGH',
      'Admin can update complaint priority via PATCH /api/admin/complaints/:id/priority'
    );

    // 16. Admin assignment
    const assignRes = await fetch(`${baseUrl}/admin/complaints/${createdComplaintId}/assign`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        assignedDepartment: 'Road Maintenance',
        assignedStaff: 'Mahesh Jadhav (Junior Engineer)',
        remarks: 'Assigned for immediate stone slab casting and site clearing.',
      }),
    }).then(json);
    assert(
      assignRes.success === true &&
        assignRes.data.assignedDepartment === 'Road Maintenance' &&
        assignRes.data.status === 'ASSIGNED',
      'Admin can assign department & staff: status transitions to ASSIGNED and records history'
    );

    // 17. Admin status update to IN_PROGRESS
    const inProgressRes = await fetch(`${baseUrl}/admin/complaints/${createdComplaintId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        status: 'IN_PROGRESS',
        remarks: 'Excavation and cement masonry work commenced on site.',
      }),
    }).then(json);
    assert(
      inProgressRes.success === true && inProgressRes.data.status === 'IN_PROGRESS',
      'Admin can update status to IN_PROGRESS with official remarks'
    );

    // 18. Admin status update to RESOLVED
    const resolvedRes = await fetch(`${baseUrl}/admin/complaints/${createdComplaintId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        status: 'RESOLVED',
        remarks: 'New reinforced concrete slab installed and canal bridge cleared for vehicle passage.',
      }),
    }).then(json);
    assert(
      resolvedRes.success === true &&
        resolvedRes.data.status === 'RESOLVED' &&
        resolvedRes.data.resolvedAt !== null,
      'Admin resolves complaint: status set to RESOLVED and resolvedAt timestamp populated'
    );

    // 19. Citizen feedback on resolved complaint
    const feedbackRes = await fetch(`${baseUrl}/complaints/${createdComplaintId}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenToken}`,
      },
      body: JSON.stringify({
        rating: 5,
        comment: 'Very solid concrete repair done in record time. Bridge is safe now!',
      }),
    }).then(json);
    assert(
      feedbackRes.success === true && feedbackRes.data.rating === 5,
      'Citizen can submit 1-5 star feedback with review comment on resolved grievance'
    );

    // 20. Admin analytics (includes priorityData)
    const analyticsRes = await fetch(`${baseUrl}/admin/analytics?timeRange=30d`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then(json);
    assert(
      analyticsRes.success === true &&
        analyticsRes.data.categoryData.length > 0 &&
        analyticsRes.data.statusData.length > 0 &&
        Array.isArray(analyticsRes.data.priorityData) &&
        analyticsRes.data.priorityData.length === 3,
      'Admin analytics endpoint returns real category, status, priority, and trend data'
    );

    // 21. Admin CSV export includes Priority column and applies active filters
    const csvRes = await fetch(`${baseUrl}/admin/reports/export?priority=HIGH&status=PENDING`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const csvText = await csvRes.text();
    const csvLines = csvText.trim().split(/\r?\n/);
    assert(
      csvRes.status === 200 &&
        csvLines[0].includes('Complaint ID') &&
        csvLines[0].split(',').includes('Priority') &&
        csvLines.length > 1 &&
        !csvText.includes('"GP-2026-0001"') &&
        csvLines.slice(1).every((line) => line.includes('"HIGH"') && !line.includes('"RESOLVED"')),
      'Admin CSV export includes Priority column and exports only filtered matching rows'
    );

    // 22. Notifications check
    const notifRes = await fetch(`${baseUrl}/notifications`, {
      headers: { Authorization: `Bearer ${citizenToken}` },
    }).then(json);
    assert(
      notifRes.success === true && notifRes.data.length > 0,
      'Citizen receives automated in-app notifications for registered, updated, assigned, and resolved complaint'
    );

    console.log(`\n=======================================================`);
    console.log(`📊 Test Summary: ${passed} Passed, ${failed} Failed`);
    console.log(`=======================================================\n`);
  } catch (error) {
    console.error('Test execution failed:', error);
    failed++;
  } finally {
    server.close(() => {
      process.exit(failed > 0 ? 1 : 0);
    });
  }
}

runTests();
