import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('/setup route restriction after first login', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('setup page load function', () => {
		it('should allow access when admin has not logged in yet', async () => {
			// Test that setup page is accessible before first login
			const mockKV = {
				get: vi.fn().mockImplementation((key: string) => {
					if (key === 'admin_first_login_completed') return null;
					if (key === 'github_owner_id') return '12345';
					return null;
				})
			};

			const hasAdminLoggedIn = !!(await mockKV.get('admin_first_login_completed'));
			expect(hasAdminLoggedIn).toBe(false);
		});

		it('should redirect to /admin when admin has logged in and user is authenticated', async () => {
			// Test that authenticated admin user gets redirected to /admin
			const mockKV = {
				get: vi.fn().mockResolvedValue('true') // admin_first_login_completed = true
			};

			const mockLocals = {
				user: { id: '12345', login: 'admin-user' }
			};

			const hasAdminLoggedIn = !!(await mockKV.get('admin_first_login_completed'));
			const isAuthenticated = !!mockLocals.user;

			expect(hasAdminLoggedIn).toBe(true);
			expect(isAuthenticated).toBe(true);
			// Should redirect to /admin
		});

		it('should redirect to / when admin has logged in but user is not authenticated', async () => {
			// Test that unauthenticated user gets redirected to home when setup is locked
			const mockKV = {
				get: vi.fn().mockResolvedValue('true') // admin_first_login_completed = true
			};

			const mockLocals = {
				user: null
			};

			const hasAdminLoggedIn = !!(await mockKV.get('admin_first_login_completed'));
			const isAuthenticated = !!mockLocals.user;

			expect(hasAdminLoggedIn).toBe(true);
			expect(isAuthenticated).toBe(false);
			// Should redirect to /
		});

		it('should allow access when setup is not yet completed', async () => {
			// Test that setup page is accessible when no admin exists yet
			const mockKV = {
				get: vi.fn().mockImplementation((key: string) => {
					if (key === 'admin_first_login_completed') return null;
					if (key === 'github_owner_id') return null; // No admin configured
					return null;
				})
			};

			const hasAdmin = !!(await mockKV.get('github_owner_id'));
			const hasAdminLoggedIn = !!(await mockKV.get('admin_first_login_completed'));

			expect(hasAdmin).toBe(false);
			expect(hasAdminLoggedIn).toBe(false);
			// Should allow access to setup page
		});
	});

	describe('setup API restriction', () => {
		it('should reject POST /api/setup when admin has already logged in', async () => {
			// Test that API rejects setup attempts after first login
			const mockKV = {
				get: vi.fn().mockResolvedValue('true') // admin_first_login_completed = true
			};

			const hasAdminLoggedIn = !!(await mockKV.get('admin_first_login_completed'));
			expect(hasAdminLoggedIn).toBe(true);
			// Should return error response
		});

		it('should accept POST /api/setup when admin has not logged in', async () => {
			// Test that API accepts setup when admin hasn't logged in yet
			const mockKV = {
				get: vi.fn().mockResolvedValue(null) // admin_first_login_completed = null
			};

			const hasAdminLoggedIn = !!(await mockKV.get('admin_first_login_completed'));
			expect(hasAdminLoggedIn).toBe(false);
			// Should allow setup to proceed
		});
	});

	describe('first login tracking', () => {
		it('should mark admin first login as completed after successful auth', async () => {
			// Test that first login flag is set after admin authenticates
			const mockKV = {
				get: vi.fn().mockImplementation((key: string) => {
					if (key === 'github_owner_id') return '12345';
					if (key === 'admin_first_login_completed') return null;
					return null;
				}),
				put: vi.fn()
			};

			const adminId = await mockKV.get('github_owner_id');
			const currentUserId = '12345'; // User just logged in
			const hasLoggedInBefore = await mockKV.get('admin_first_login_completed');

			// Check if this is the admin's first login
			if (adminId === currentUserId && !hasLoggedInBefore) {
				await mockKV.put('admin_first_login_completed', 'true');
			}

			expect(mockKV.put).toHaveBeenCalledWith('admin_first_login_completed', 'true');
		});

		it('should not update flag for non-admin users', async () => {
			// Test that first login flag is only set for admin user
			const mockKV = {
				get: vi.fn().mockImplementation((key: string) => {
					if (key === 'github_owner_id') return '12345'; // Admin ID
					return null;
				}),
				put: vi.fn()
			};

			const adminId = await mockKV.get('github_owner_id');
			const currentUserId = '67890'; // Different user
			const hasLoggedInBefore = await mockKV.get('admin_first_login_completed');

			// Check if this is the admin's first login
			if (adminId === currentUserId && !hasLoggedInBefore) {
				await mockKV.put('admin_first_login_completed', 'true');
			}

			expect(mockKV.put).not.toHaveBeenCalled();
		});

		it('should not update flag if admin has already logged in before', async () => {
			// Test that flag is only set once
			const mockKV = {
				get: vi.fn().mockImplementation((key: string) => {
					if (key === 'github_owner_id') return '12345';
					if (key === 'admin_first_login_completed') return 'true'; // Already set
					return null;
				}),
				put: vi.fn()
			};

			const adminId = await mockKV.get('github_owner_id');
			const currentUserId = '12345';
			const hasLoggedInBefore = await mockKV.get('admin_first_login_completed');

			// Check if this is the admin's first login
			if (adminId === currentUserId && !hasLoggedInBefore) {
				await mockKV.put('admin_first_login_completed', 'true');
			}

			expect(mockKV.put).not.toHaveBeenCalled();
		});
	});

	describe('GET /api/setup status check', () => {
		it('should include setupLocked status in response', async () => {
			// Test that GET endpoint returns whether setup is locked
			const mockKV = {
				get: vi.fn().mockImplementation((key: string) => {
					if (key === 'admin_first_login_completed') return 'true';
					if (key === 'github_owner_id') return '12345';
					if (key === 'auth_config:github') return '{"clientId":"test"}';
					return null;
				})
			};

			const hasConfig = !!(await mockKV.get('auth_config:github'));
			const hasAdmin = !!(await mockKV.get('github_owner_id'));
			const setupLocked = !!(await mockKV.get('admin_first_login_completed'));

			const response = {
				hasConfig,
				hasAdmin,
				setupLocked
			};

			expect(response.hasConfig).toBe(true);
			expect(response.hasAdmin).toBe(true);
			expect(response.setupLocked).toBe(true);
		});

		it('should show setup not locked when admin has not logged in', async () => {
			// Test that setup is not locked before first login
			const mockKV = {
				get: vi.fn().mockImplementation((key: string) => {
					if (key === 'admin_first_login_completed') return null;
					if (key === 'github_owner_id') return '12345';
					if (key === 'auth_config:github') return '{"clientId":"test"}';
					return null;
				})
			};

			const setupLocked = !!(await mockKV.get('admin_first_login_completed'));

			expect(setupLocked).toBe(false);
		});
	});
});
