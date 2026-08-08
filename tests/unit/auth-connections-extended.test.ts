import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Auth Connections API - Extended Branch Coverage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
	});

	describe('GET /api/auth/connections', () => {
		it('should require authentication', async () => {
			const mockEvent = {
				locals: {},
				platform: {}
			};

			const { GET } = await import('../../src/routes/api/auth/connections/+server');

			try {
				await GET(mockEvent as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(401);
			}
		});

		it('should return empty connections when DB is not available', async () => {
			const mockEvent = {
				locals: {
					user: { id: 'user-1' }
				},
				platform: {
					env: {}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/connections/+server');
			const response = await GET(mockEvent as any);
			const data = await response.json();

			expect(data.connections).toEqual([]);
		});

		it('should return 500 when database query fails', async () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const mockEvent = {
				locals: {
					user: { id: 'user-1' }
				},
				platform: {
					env: {
						DB: {
							prepare: vi.fn().mockReturnValue({
								bind: vi.fn().mockReturnValue({
									all: vi.fn().mockRejectedValue(new Error('DB Error'))
								})
							})
						}
					}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/connections/+server');

			try {
				await GET(mockEvent as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}

			consoleSpy.mockRestore();
		});

		it('should return connections from database', async () => {
			const mockConnections = [
				{ provider: 'github', provider_account_id: '12345', created_at: '2024-01-01' }
			];

			const mockEvent = {
				locals: {
					user: { id: 'user-1' }
				},
				platform: {
					env: {
						DB: {
							prepare: vi.fn().mockReturnValue({
								bind: vi.fn().mockReturnValue({
									all: vi.fn().mockResolvedValue({ results: mockConnections })
								})
							})
						}
					}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/connections/+server');
			const response = await GET(mockEvent as any);
			const data = await response.json();

			expect(data.connections).toEqual(mockConnections);
		});

		it('should include simulated connections for pretend users', async () => {
			const mockEvent = {
				locals: {
					user: {
						id: 'dev-1',
						login: 'dev-user',
						isPretend: true,
						simulatedConnections: ['discord']
					}
				},
				platform: {
					env: {}
				}
			};

			const { GET } = await import('../../src/routes/api/auth/connections/+server');
			const response = await GET(mockEvent as any);
			const data = await response.json();

			expect(data.connections).toHaveLength(1);
			expect(data.connections[0].provider).toBe('discord');
		});
	});

	describe('DELETE /api/auth/connections', () => {
		it('should require authentication', async () => {
			const mockEvent = {
				locals: {},
				platform: {},
				request: {
					json: vi.fn().mockResolvedValue({ provider: 'github' })
				}
			};

			const { DELETE } = await import('../../src/routes/api/auth/connections/+server');

			try {
				await DELETE(mockEvent as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(401);
			}
		});

		it('should require provider parameter', async () => {
			const mockEvent = {
				locals: {
					user: { id: 'user-1' }
				},
				platform: {
					env: {
						DB: {}
					}
				},
				request: {
					json: vi.fn().mockResolvedValue({})
				}
			};

			const { DELETE } = await import('../../src/routes/api/auth/connections/+server');

			try {
				await DELETE(mockEvent as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});

		it('should return 500 when database is not available', async () => {
			const mockEvent = {
				locals: {
					user: { id: 'user-1' }
				},
				platform: {
					env: {}
				},
				request: {
					json: vi.fn().mockResolvedValue({ provider: 'github' })
				}
			};

			const { DELETE } = await import('../../src/routes/api/auth/connections/+server');

			try {
				await DELETE(mockEvent as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});

		it('should not allow unlinking only connection without password', async () => {
			const mockEvent = {
				locals: {
					user: { id: 'user-1' }
				},
				platform: {
					env: {
						DB: {
							prepare: vi.fn().mockImplementation((sql: string) => {
								if (sql.includes('password_hash FROM users')) {
									return {
										bind: vi.fn().mockReturnValue({
											first: vi.fn().mockResolvedValue({ password_hash: null })
										})
									};
								}
								if (sql.includes('SELECT provider FROM oauth_accounts')) {
									return {
										bind: vi.fn().mockReturnValue({
											all: vi.fn().mockResolvedValue({ results: [{ provider: 'github' }] })
										})
									};
								}
								return {
									bind: vi.fn().mockReturnValue({ first: vi.fn(), all: vi.fn(), run: vi.fn() })
								};
							})
						}
					}
				},
				request: {
					json: vi.fn().mockResolvedValue({ provider: 'github' })
				}
			};

			const { DELETE } = await import('../../src/routes/api/auth/connections/+server');

			try {
				await DELETE(mockEvent as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(400);
				expect(err.body?.message).toContain('Cannot unlink');
			}
		});

		it('should allow unlinking when user has password', async () => {
			const mockEvent = {
				locals: {
					user: { id: 'user-1' }
				},
				platform: {
					env: {
						DB: {
							prepare: vi.fn().mockImplementation((sql: string) => {
								if (sql.includes('password_hash FROM users')) {
									return {
										bind: vi.fn().mockReturnValue({
											first: vi.fn().mockResolvedValue({ password_hash: 'hashed-password' })
										})
									};
								}
								if (sql.includes('SELECT provider FROM oauth_accounts')) {
									return {
										bind: vi.fn().mockReturnValue({
											all: vi.fn().mockResolvedValue({ results: [{ provider: 'github' }] })
										})
									};
								}
								if (sql.includes('DELETE FROM oauth_accounts')) {
									return {
										bind: vi.fn().mockReturnValue({
											run: vi.fn().mockResolvedValue({ success: true })
										})
									};
								}
								return {
									bind: vi.fn().mockReturnValue({ first: vi.fn(), all: vi.fn(), run: vi.fn() })
								};
							})
						}
					}
				},
				request: {
					json: vi.fn().mockResolvedValue({ provider: 'github' })
				}
			};

			const { DELETE } = await import('../../src/routes/api/auth/connections/+server');
			const response = await DELETE(mockEvent as any);
			const data = await response.json();

			expect(data.success).toBe(true);
		});

		it('should allow unlinking when user has multiple connections', async () => {
			const mockEvent = {
				locals: {
					user: { id: 'user-1' }
				},
				platform: {
					env: {
						DB: {
							prepare: vi.fn().mockImplementation((sql: string) => {
								if (sql.includes('password_hash FROM users')) {
									return {
										bind: vi.fn().mockReturnValue({
											first: vi.fn().mockResolvedValue({ password_hash: null })
										})
									};
								}
								if (sql.includes('SELECT provider FROM oauth_accounts')) {
									return {
										bind: vi.fn().mockReturnValue({
											all: vi.fn().mockResolvedValue({
												results: [{ provider: 'github' }, { provider: 'discord' }]
											})
										})
									};
								}
								if (sql.includes('DELETE FROM oauth_accounts')) {
									return {
										bind: vi.fn().mockReturnValue({
											run: vi.fn().mockResolvedValue({ success: true })
										})
									};
								}
								return {
									bind: vi.fn().mockReturnValue({ first: vi.fn(), all: vi.fn(), run: vi.fn() })
								};
							})
						}
					}
				},
				request: {
					json: vi.fn().mockResolvedValue({ provider: 'github' })
				}
			};

			const { DELETE } = await import('../../src/routes/api/auth/connections/+server');
			const response = await DELETE(mockEvent as any);
			const data = await response.json();

			expect(data.success).toBe(true);
		});

		it('should unlink simulated connections for pretend users, re-issuing a server session', async () => {
			// The updated pretend identity is stored server-side now, so the endpoint
			// needs the database — the cookie only carries the new opaque id.
			const inserted: Record<string, string> = {};
			const db = {
				prepare: (sql: string) => ({
					bind: (...args: unknown[]) => ({
						run: async () => {
							if (/^INSERT INTO sessions/i.test(sql)) {
								inserted.id = args[0] as string;
								inserted.data = args[3] as string;
							}
							return { success: true };
						}
					})
				})
			};

			const mockEvent = {
				locals: {
					user: {
						id: 'dev-1',
						login: 'dev-user',
						email: 'dev@example.dev',
						isPretend: true,
						isOwner: false,
						isAdmin: false,
						simulatedConnections: ['github', 'discord']
					}
				},
				platform: {
					env: { DB: db }
				},
				url: new URL('http://localhost/api/auth/connections'),
				request: {
					json: vi.fn().mockResolvedValue({ provider: 'discord' })
				}
			};

			const { DELETE } = await import('../../src/routes/api/auth/connections/+server');
			const response = await DELETE(mockEvent as any);
			const data = await response.json();

			expect(data.success).toBe(true);
			expect(data.connections).toEqual([{ provider: 'github' }]);
			expect(response.headers.get('Set-Cookie')).toContain(`session=${inserted.id}`);
			// The trusted payload — not the cookie — reflects the removed connection.
			expect(JSON.parse(inserted.data).simulatedConnections).toEqual(['github']);
		});

		it('should return 500 when delete operation fails', async () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const mockEvent = {
				locals: {
					user: { id: 'user-1' }
				},
				platform: {
					env: {
						DB: {
							prepare: vi.fn().mockImplementation((sql: string) => {
								if (sql.includes('password_hash FROM users')) {
									return {
										bind: vi.fn().mockReturnValue({
											first: vi.fn().mockResolvedValue({ password_hash: 'hashed-password' })
										})
									};
								}
								if (sql.includes('SELECT provider FROM oauth_accounts')) {
									return {
										bind: vi.fn().mockReturnValue({
											all: vi.fn().mockResolvedValue({ results: [{ provider: 'github' }] })
										})
									};
								}
								if (sql.includes('DELETE FROM oauth_accounts')) {
									return {
										bind: vi.fn().mockReturnValue({
											run: vi.fn().mockRejectedValue(new Error('Delete failed'))
										})
									};
								}
								return {
									bind: vi.fn().mockReturnValue({ first: vi.fn(), all: vi.fn(), run: vi.fn() })
								};
							})
						}
					}
				},
				request: {
					json: vi.fn().mockResolvedValue({ provider: 'github' })
				}
			};

			const { DELETE } = await import('../../src/routes/api/auth/connections/+server');

			try {
				await DELETE(mockEvent as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}

			consoleSpy.mockRestore();
		});
	});
});
