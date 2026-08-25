import { webcrypto } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockError = vi.fn((status: number, message: string) => {
	const err = new Error(message) as Error & { status: number; body: { message: string } };
	err.status = status;
	err.body = { message };
	throw err;
});

vi.mock('@sveltejs/kit', () => ({
	error: (status: number, message: string) => mockError(status, message),
	json: (data: unknown, init?: ResponseInit) =>
		new Response(JSON.stringify(data), {
			...init,
			headers: { 'Content-Type': 'application/json', ...init?.headers }
		})
}));

vi.mock('../../src/lib/services/account-merge', () => ({
	mergeAccounts: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../src/lib/utils/db', async () => {
	const actual =
		await vi.importActual<typeof import('../../src/lib/utils/db')>('../../src/lib/utils/db');
	return {
		...actual,
		createSession: vi.fn(async (_db: unknown, userId: string) => ({
			id: 'stored-session-digest',
			token: 'opaque-session-token',
			user_id: userId,
			expires_at: new Date('2099-01-01T00:00:00.000Z')
		}))
	};
});

describe('Password Auth APIs', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
		vi.stubGlobal('crypto', webcrypto as Crypto);
		vi.stubEnv('DEV', true);
	});

	it('rejects signup when the database is unavailable', async () => {
		const { POST } = await import('../../src/routes/api/auth/signup/+server');

		await expect(
			POST({
				platform: {},
				request: new Request('http://localhost/api/auth/signup', {
					method: 'POST',
					body: JSON.stringify({})
				}),
				url: new URL('http://localhost/api/auth/signup')
			} as any)
		).rejects.toMatchObject({ status: 500, body: { message: 'Database not available' } });
	});

	it('rejects signup validation errors before inserting a user', async () => {
		const { POST } = await import('../../src/routes/api/auth/signup/+server');

		const prepare = vi.fn();

		await expect(
			POST({
				platform: { env: { DB: { prepare } } },
				request: new Request('http://localhost/api/auth/signup', {
					method: 'POST',
					body: JSON.stringify({
						name: 'New User',
						email: 'new@example.com',
						password: 'short',
						confirmPassword: 'different'
					})
				}),
				url: new URL('http://localhost/api/auth/signup')
			} as any)
		).rejects.toMatchObject({ status: 400, body: { message: 'Passwords do not match.' } });

		expect(prepare).not.toHaveBeenCalled();
	});

	it('rejects signup when required fields are missing', async () => {
		const { POST } = await import('../../src/routes/api/auth/signup/+server');

		await expect(
			POST({
				platform: { env: { DB: { prepare: vi.fn() } } },
				request: new Request('http://localhost/api/auth/signup', {
					method: 'POST',
					body: JSON.stringify({ name: '', email: '', password: '', confirmPassword: '' })
				}),
				url: new URL('http://localhost/api/auth/signup')
			} as any)
		).rejects.toMatchObject({
			status: 400,
			body: { message: 'Name, email, password, and confirmation are required.' }
		});
	});

	it('rejects signup when payload values are not strings', async () => {
		const { POST } = await import('../../src/routes/api/auth/signup/+server');

		await expect(
			POST({
				platform: { env: { DB: { prepare: vi.fn() } } },
				request: new Request('http://localhost/api/auth/signup', {
					method: 'POST',
					body: JSON.stringify({ name: 1, email: 2, password: 3, confirmPassword: 4 })
				}),
				url: new URL('http://localhost/api/auth/signup')
			} as any)
		).rejects.toMatchObject({
			status: 400,
			body: { message: 'Name, email, password, and confirmation are required.' }
		});
	});

	it('rejects signup when the password is too weak', async () => {
		const { POST } = await import('../../src/routes/api/auth/signup/+server');

		await expect(
			POST({
				platform: { env: { DB: { prepare: vi.fn() } } },
				request: new Request('http://localhost/api/auth/signup', {
					method: 'POST',
					body: JSON.stringify({
						name: 'New User',
						email: 'new@example.com',
						password: 'short',
						confirmPassword: 'short'
					})
				}),
				url: new URL('http://localhost/api/auth/signup')
			} as any)
		).rejects.toMatchObject({
			status: 400,
			body: { message: 'Password must be at least 10 characters long.' }
		});
	});

	it('rejects signup when the email already exists', async () => {
		const { POST } = await import('../../src/routes/api/auth/signup/+server');

		await expect(
			POST({
				platform: {
					env: {
						DB: {
							prepare: vi.fn().mockReturnValue({
								bind: vi.fn().mockReturnValue({
									run: vi.fn().mockResolvedValue({ success: true }),
									first: vi.fn().mockResolvedValue({ id: 'existing-user' })
								})
							})
						}
					}
				},
				request: new Request('http://localhost/api/auth/signup', {
					method: 'POST',
					body: JSON.stringify({
						name: 'New User',
						email: 'new@example.com',
						password: 'StrongPass123!',
						confirmPassword: 'StrongPass123!'
					})
				}),
				url: new URL('http://localhost/api/auth/signup')
			} as any)
		).rejects.toMatchObject({
			status: 409,
			body: { message: 'An account with that email already exists.' }
		});
	});

	it('signs up with email and password and sets a session cookie', async () => {
		const { POST } = await import('../../src/routes/api/auth/signup/+server');

		const runMock = vi.fn().mockResolvedValue({ success: true });
		const firstMock = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
			id: 'user-1',
			email: 'new@example.com',
			name: 'New User',
			github_login: null,
			github_avatar_url: null,
			is_admin: 0
		});

		const mockEvent = {
			url: new URL('http://localhost/api/auth/signup'),
			platform: {
				env: {
					DB: {
						prepare: vi.fn().mockImplementation((sql: string) => ({
							bind: vi.fn().mockReturnValue({
								first: firstMock,
								run: runMock
							})
						}))
					}
				}
			},
			request: new Request('http://localhost/api/auth/signup', {
				method: 'POST',
				body: JSON.stringify({
					name: 'New User',
					email: 'new@example.com',
					password: 'StrongPass123!',
					confirmPassword: 'StrongPass123!'
				})
			})
		};

		const response = await POST(mockEvent as any);
		const payload = await response.json();

		expect(response.status).toBe(201);
		expect(payload.success).toBe(true);
		expect(response.headers.get('set-cookie')).toContain('session=');
		expect(runMock).toHaveBeenCalled();
	});

	it('logs in with an email alias and sets a session cookie', async () => {
		const { hashPassword } = await import('../../src/lib/utils/passwords');
		const { POST } = await import('../../src/routes/api/auth/login/+server');

		const passwordHash = await hashPassword('StrongPass123!');

		const mockEvent = {
			url: new URL('http://localhost/api/auth/login'),
			platform: {
				env: {
					DB: {
						prepare: vi.fn().mockImplementation(() => ({
							bind: vi.fn().mockReturnValue({
								run: vi.fn().mockResolvedValue({ success: true }),
								first: vi.fn().mockResolvedValue({
									id: 'user-1',
									email: 'primary@example.com',
									name: 'Primary User',
									github_login: null,
									github_avatar_url: null,
									is_admin: 0,
									password_hash: passwordHash
								})
							})
						}))
					}
				}
			},
			request: new Request('http://localhost/api/auth/login', {
				method: 'POST',
				body: JSON.stringify({
					email: 'alias@example.com',
					password: 'StrongPass123!'
				})
			})
		};

		const response = await POST(mockEvent as any);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(response.headers.get('set-cookie')).toContain('session=');
	});

	it('rejects login when required credentials are missing', async () => {
		const { POST } = await import('../../src/routes/api/auth/login/+server');

		await expect(
			POST({
				platform: { env: { DB: { prepare: vi.fn() } } },
				request: new Request('http://localhost/api/auth/login', {
					method: 'POST',
					body: JSON.stringify({ email: '', password: '' })
				}),
				url: new URL('http://localhost/api/auth/login')
			} as any)
		).rejects.toMatchObject({ status: 400, body: { message: 'Email and password are required.' } });
	});

	it('rejects login when the database is unavailable', async () => {
		const { POST } = await import('../../src/routes/api/auth/login/+server');

		await expect(
			POST({
				platform: {},
				request: new Request('http://localhost/api/auth/login', {
					method: 'POST',
					body: JSON.stringify({ email: 'user@example.com', password: 'StrongPass123!' })
				}),
				url: new URL('http://localhost/api/auth/login')
			} as any)
		).rejects.toMatchObject({ status: 500, body: { message: 'Database not available' } });
	});

	it('rejects login when the account has no password login configured', async () => {
		const { POST } = await import('../../src/routes/api/auth/login/+server');

		await expect(
			POST({
				platform: {
					env: {
						DB: {
							prepare: vi.fn().mockReturnValue({
								bind: vi.fn().mockReturnValue({
									run: vi.fn().mockResolvedValue({ success: true }),
									first: vi.fn().mockResolvedValue({
										id: 'user-1',
										email: 'primary@example.com',
										name: 'Primary User',
										github_login: null,
										github_avatar_url: null,
										is_admin: 0,
										password_hash: null
									})
								})
							})
						}
					}
				},
				request: new Request('http://localhost/api/auth/login', {
					method: 'POST',
					body: JSON.stringify({ email: 'primary@example.com', password: 'StrongPass123!' })
				}),
				url: new URL('http://localhost/api/auth/login')
			} as any)
		).rejects.toMatchObject({ status: 401, body: { message: 'Invalid email or password.' } });
	});

	it('logs in as owner when the configured owner username matches github login', async () => {
		const { hashPassword } = await import('../../src/lib/utils/passwords');
		const { POST } = await import('../../src/routes/api/auth/login/+server');

		const passwordHash = await hashPassword('StrongPass123!');
		const response = await POST({
			platform: {
				env: {
					DB: {
						prepare: vi.fn().mockReturnValue({
							bind: vi.fn().mockReturnValue({
								run: vi.fn().mockResolvedValue({ success: true }),
								first: vi.fn().mockResolvedValue({
									id: 'user-1',
									email: 'primary@example.com',
									name: 'Primary User',
									github_login: 'owner-user',
									github_avatar_url: null,
									is_admin: 0,
									password_hash: passwordHash
								})
							})
						})
					},
					GITHUB_OWNER_ID: 'owner-user'
				}
			},
			request: new Request('http://localhost/api/auth/login', {
				method: 'POST',
				body: JSON.stringify({ email: 'primary@example.com', password: 'StrongPass123!' })
			}),
			url: new URL('https://localhost/api/auth/login')
		} as any);

		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.redirectTo).toBe('/admin');
		expect(response.headers.get('set-cookie')).toContain('Secure');
	});

	it('logs in as owner when the numeric owner id matches the user id', async () => {
		const { hashPassword } = await import('../../src/lib/utils/passwords');
		const { POST } = await import('../../src/routes/api/auth/login/+server');

		const passwordHash = await hashPassword('StrongPass123!');
		const prepare = vi.fn().mockReturnValue({
			bind: vi.fn().mockReturnValue({
				run: vi.fn().mockResolvedValue({ success: true }),
				first: vi.fn().mockResolvedValue({
					id: '123',
					email: 'primary@example.com',
					name: 'Primary User',
					github_login: null,
					github_avatar_url: null,
					is_admin: 0,
					password_hash: passwordHash
				})
			})
		});

		const response = await POST({
			platform: { env: { DB: { prepare }, GITHUB_OWNER_ID: '123' } },
			request: new Request('http://localhost/api/auth/login', {
				method: 'POST',
				body: JSON.stringify({ email: 'primary@example.com', password: 'StrongPass123!' })
			}),
			url: new URL('http://localhost/api/auth/login')
		} as any);

		const payload = await response.json();

		expect(payload.redirectTo).toBe('/admin');
		// One prepare for the user lookup, one for the server-side session INSERT.
		expect(prepare).toHaveBeenCalledTimes(2);
	});

	it('logs in as owner when the numeric owner id matches the linked github account', async () => {
		const { hashPassword } = await import('../../src/lib/utils/passwords');
		const { POST } = await import('../../src/routes/api/auth/login/+server');

		const passwordHash = await hashPassword('StrongPass123!');
		const prepare = vi.fn().mockImplementation((sql: string) => ({
			bind: vi.fn().mockReturnValue({
				run: vi.fn().mockResolvedValue({ success: true }),
				first: vi.fn().mockResolvedValue(
					sql.includes('FROM users u')
						? {
								id: 'user-1',
								email: 'primary@example.com',
								name: 'Primary User',
								github_login: null,
								github_avatar_url: null,
								is_admin: 0,
								password_hash: passwordHash
							}
						: { provider_account_id: '999' }
				)
			})
		}));

		const response = await POST({
			platform: { env: { DB: { prepare }, GITHUB_OWNER_ID: '999' } },
			request: new Request('http://localhost/api/auth/login', {
				method: 'POST',
				body: JSON.stringify({ email: 'primary@example.com', password: 'StrongPass123!' })
			}),
			url: new URL('http://localhost/api/auth/login')
		} as any);

		const payload = await response.json();

		expect(payload.redirectTo).toBe('/admin');
	});

	it('falls back to a non-owner login when KV owner lookup fails', async () => {
		const { hashPassword } = await import('../../src/lib/utils/passwords');
		const { POST } = await import('../../src/routes/api/auth/login/+server');

		const passwordHash = await hashPassword('StrongPass123!');

		const response = await POST({
			platform: {
				env: {
					DB: {
						prepare: vi.fn().mockReturnValue({
							bind: vi.fn().mockReturnValue({
								run: vi.fn().mockResolvedValue({ success: true }),
								first: vi.fn().mockResolvedValue({
									id: 'user-1',
									email: 'primary@example.com',
									name: 'Primary User',
									github_login: null,
									github_avatar_url: null,
									is_admin: 0,
									password_hash: passwordHash
								})
							})
						})
					},
					KV: {
						get: vi.fn().mockRejectedValue(new Error('KV failure'))
					}
				}
			},
			request: new Request('http://localhost/api/auth/login', {
				method: 'POST',
				body: JSON.stringify({ email: 'primary@example.com', password: 'StrongPass123!' })
			}),
			url: new URL('http://localhost/api/auth/login')
		} as any);

		const payload = await response.json();

		expect(payload.redirectTo).toBe('/');
	});

	it('logs in as owner when KV provides the owner username', async () => {
		const { hashPassword } = await import('../../src/lib/utils/passwords');
		const { POST } = await import('../../src/routes/api/auth/login/+server');

		const passwordHash = await hashPassword('StrongPass123!');

		const response = await POST({
			platform: {
				env: {
					DB: {
						prepare: vi.fn().mockReturnValue({
							bind: vi.fn().mockReturnValue({
								run: vi.fn().mockResolvedValue({ success: true }),
								first: vi.fn().mockResolvedValue({
									id: 'user-1',
									email: 'primary@example.com',
									name: 'Primary User',
									github_login: 'kv-owner',
									github_avatar_url: null,
									is_admin: 0,
									password_hash: passwordHash
								})
							})
						})
					},
					KV: {
						get: vi
							.fn()
							.mockImplementation((key: string) =>
								key === 'github_owner_username' ? 'kv-owner' : null
							)
					}
				}
			},
			request: new Request('http://localhost/api/auth/login', {
				method: 'POST',
				body: JSON.stringify({ email: 'primary@example.com', password: 'StrongPass123!' })
			}),
			url: new URL('http://localhost/api/auth/login')
		} as any);

		const payload = await response.json();

		expect(payload.redirectTo).toBe('/admin');
	});

	it('falls back to a non-owner login when github link lookup throws', async () => {
		const { hashPassword } = await import('../../src/lib/utils/passwords');
		const { POST } = await import('../../src/routes/api/auth/login/+server');

		const passwordHash = await hashPassword('StrongPass123!');
		const prepare = vi.fn().mockImplementation((sql: string) => ({
			bind: vi.fn().mockReturnValue({
				run: vi.fn().mockResolvedValue({ success: true }),
				first: sql.includes('FROM users u')
					? vi.fn().mockResolvedValue({
							id: 'user-1',
							email: 'primary@example.com',
							name: 'Primary User',
							github_login: null,
							github_avatar_url: null,
							is_admin: 0,
							password_hash: passwordHash
						})
					: vi.fn().mockRejectedValue(new Error('lookup failed'))
			})
		}));

		const response = await POST({
			platform: { env: { DB: { prepare }, GITHUB_OWNER_ID: '999' } },
			request: new Request('http://localhost/api/auth/login', {
				method: 'POST',
				body: JSON.stringify({ email: 'primary@example.com', password: 'StrongPass123!' })
			}),
			url: new URL('http://localhost/api/auth/login')
		} as any);

		const payload = await response.json();

		expect(payload.redirectTo).toBe('/');
	});

	it('rejects login when the password does not verify', async () => {
		const { hashPassword } = await import('../../src/lib/utils/passwords');
		const { POST } = await import('../../src/routes/api/auth/login/+server');

		const passwordHash = await hashPassword('StrongPass123!');

		await expect(
			POST({
				platform: {
					env: {
						DB: {
							prepare: vi.fn().mockImplementation((sql: string) => ({
								bind: vi.fn().mockReturnValue({
									run: vi.fn().mockResolvedValue({ success: true }),
									first: vi.fn().mockResolvedValue(
										sql.includes('FROM users u')
											? {
													id: 'user-1',
													email: 'primary@example.com',
													name: 'Primary User',
													github_login: null,
													github_avatar_url: null,
													is_admin: 0,
													password_hash: passwordHash
												}
											: null
									)
								})
							}))
						}
					}
				},
				request: new Request('http://localhost/api/auth/login', {
					method: 'POST',
					body: JSON.stringify({ email: 'primary@example.com', password: 'WrongPass123!' })
				}),
				url: new URL('http://localhost/api/auth/login')
			} as any)
		).rejects.toMatchObject({ status: 401, body: { message: 'Invalid email or password.' } });
	});

	it('sets a password for the authenticated user', async () => {
		const { POST } = await import('../../src/routes/api/auth/password/+server');

		const runMock = vi.fn().mockResolvedValue({ success: true });
		const mockEvent = {
			locals: {
				user: { id: 'user-1', email: 'user@example.com' }
			},
			platform: {
				env: {
					DB: {
						prepare: vi.fn().mockImplementation(() => ({
							bind: vi.fn().mockReturnValue({
								run: runMock,
								first: vi.fn().mockResolvedValue({ password_hash: null })
							})
						}))
					}
				}
			},
			request: new Request('http://localhost/api/auth/password', {
				method: 'POST',
				body: JSON.stringify({
					password: 'EvenStronger123!',
					confirmPassword: 'EvenStronger123!'
				})
			})
		};

		const response = await POST(mockEvent as any);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(runMock).toHaveBeenCalled();
	});

	it('rejects password updates when the user is not authenticated', async () => {
		const { POST } = await import('../../src/routes/api/auth/password/+server');

		await expect(
			POST({
				locals: {},
				platform: { env: { DB: { prepare: vi.fn() } } },
				request: new Request('http://localhost/api/auth/password', {
					method: 'POST',
					body: JSON.stringify({
						password: 'EvenStronger123!',
						confirmPassword: 'EvenStronger123!'
					})
				})
			} as any)
		).rejects.toMatchObject({ status: 401, body: { message: 'Unauthorized' } });
	});

	it('rejects password updates when the database is unavailable', async () => {
		const { POST } = await import('../../src/routes/api/auth/password/+server');

		await expect(
			POST({
				locals: { user: { id: 'user-1', email: 'user@example.com' } },
				platform: {},
				request: new Request('http://localhost/api/auth/password', {
					method: 'POST',
					body: JSON.stringify({
						password: 'EvenStronger123!',
						confirmPassword: 'EvenStronger123!'
					})
				})
			} as any)
		).rejects.toMatchObject({ status: 500, body: { message: 'Database not available' } });
	});

	it('rejects invalid password updates before writing to the database', async () => {
		const { POST } = await import('../../src/routes/api/auth/password/+server');
		const prepare = vi.fn();

		await expect(
			POST({
				locals: { user: { id: 'user-1', email: 'user@example.com' } },
				platform: { env: { DB: { prepare } } },
				request: new Request('http://localhost/api/auth/password', {
					method: 'POST',
					body: JSON.stringify({ password: 'short', confirmPassword: 'short' })
				})
			} as any)
		).rejects.toMatchObject({
			status: 400,
			body: { message: 'Password must be at least 10 characters long.' }
		});

		expect(prepare).not.toHaveBeenCalled();
	});

	it('rejects password updates when the confirmation is missing', async () => {
		const { POST } = await import('../../src/routes/api/auth/password/+server');

		await expect(
			POST({
				locals: { user: { id: 'user-1', email: 'user@example.com' } },
				platform: { env: { DB: { prepare: vi.fn() } } },
				request: new Request('http://localhost/api/auth/password', {
					method: 'POST',
					body: JSON.stringify({ password: 'EvenStronger123!', confirmPassword: '' })
				})
			} as any)
		).rejects.toMatchObject({
			status: 400,
			body: { message: 'Password and confirmation are required.' }
		});
	});

	it('rejects password updates when payload values are not strings', async () => {
		const { POST } = await import('../../src/routes/api/auth/password/+server');

		await expect(
			POST({
				locals: { user: { id: 'user-1', email: 'user@example.com' } },
				platform: { env: { DB: { prepare: vi.fn() } } },
				request: new Request('http://localhost/api/auth/password', {
					method: 'POST',
					body: JSON.stringify({ password: 123, confirmPassword: 456 })
				})
			} as any)
		).rejects.toMatchObject({
			status: 400,
			body: { message: 'Password and confirmation are required.' }
		});
	});

	it('rejects password updates when the confirmation does not match', async () => {
		const { POST } = await import('../../src/routes/api/auth/password/+server');

		await expect(
			POST({
				locals: { user: { id: 'user-1', email: 'user@example.com' } },
				platform: { env: { DB: { prepare: vi.fn() } } },
				request: new Request('http://localhost/api/auth/password', {
					method: 'POST',
					body: JSON.stringify({
						password: 'EvenStronger123!',
						confirmPassword: 'DifferentPass123!'
					})
				})
			} as any)
		).rejects.toMatchObject({ status: 400, body: { message: 'Passwords do not match.' } });
	});

	it('merges another password account into the current user', async () => {
		const { hashPassword } = await import('../../src/lib/utils/passwords');
		const { mergeAccounts } = await import('../../src/lib/services/account-merge');
		const { POST } = await import('../../src/routes/api/auth/merge/+server');

		const passwordHash = await hashPassword('MergePass123!');

		const mockEvent = {
			locals: {
				user: { id: 'target-user', email: 'target@example.com' }
			},
			platform: {
				env: {
					DB: {
						prepare: vi.fn().mockImplementation((sql: string) => ({
							bind: vi.fn().mockReturnValue({
								run: vi.fn().mockResolvedValue({ success: true }),
								first: vi.fn().mockResolvedValue(
									sql.includes('FROM users u')
										? {
												id: 'source-user',
												email: 'source@example.com',
												name: 'Source User',
												github_login: null,
												github_avatar_url: null,
												is_admin: 0,
												password_hash: passwordHash
											}
										: null
								),
								all: vi.fn().mockResolvedValue({ results: [] })
							})
						}))
					}
				}
			},
			request: new Request('http://localhost/api/auth/merge', {
				method: 'POST',
				body: JSON.stringify({
					email: 'source@example.com',
					password: 'MergePass123!'
				})
			})
		};

		const response = await POST(mockEvent as any);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(mergeAccounts).toHaveBeenCalledWith(
			mockEvent.platform.env.DB,
			'source-user',
			'target-user'
		);
	});

	it('rejects merges when the source account is the current account', async () => {
		const { hashPassword } = await import('../../src/lib/utils/passwords');
		const { POST } = await import('../../src/routes/api/auth/merge/+server');

		const passwordHash = await hashPassword('MergePass123!');

		await expect(
			POST({
				locals: { user: { id: 'target-user', email: 'target@example.com' } },
				platform: {
					env: {
						DB: {
							prepare: vi.fn().mockReturnValue({
								bind: vi.fn().mockReturnValue({
									run: vi.fn().mockResolvedValue({ success: true }),
									first: vi.fn().mockResolvedValue({
										id: 'target-user',
										email: 'target@example.com',
										name: 'Target User',
										github_login: null,
										github_avatar_url: null,
										is_admin: 0,
										password_hash: passwordHash
									})
								})
							})
						}
					}
				},
				request: new Request('http://localhost/api/auth/merge', {
					method: 'POST',
					body: JSON.stringify({ email: 'target@example.com', password: 'MergePass123!' })
				})
			} as any)
		).rejects.toMatchObject({
			status: 400,
			body: { message: 'You are already signed in to that account.' }
		});
	});

	it('rejects merges when the source credentials are invalid', async () => {
		const { POST } = await import('../../src/routes/api/auth/merge/+server');

		await expect(
			POST({
				locals: { user: { id: 'target-user', email: 'target@example.com' } },
				platform: {
					env: {
						DB: {
							prepare: vi.fn().mockReturnValue({
								bind: vi.fn().mockReturnValue({
									run: vi.fn().mockResolvedValue({ success: true }),
									first: vi.fn().mockResolvedValue(null)
								})
							})
						}
					}
				},
				request: new Request('http://localhost/api/auth/merge', {
					method: 'POST',
					body: JSON.stringify({ email: 'source@example.com', password: 'bad-pass' })
				})
			} as any)
		).rejects.toMatchObject({ status: 401, body: { message: 'Invalid email or password.' } });
	});

	it('rejects merges when the user is not authenticated', async () => {
		const { POST } = await import('../../src/routes/api/auth/merge/+server');

		await expect(
			POST({
				locals: {},
				platform: { env: { DB: { prepare: vi.fn() } } },
				request: new Request('http://localhost/api/auth/merge', {
					method: 'POST',
					body: JSON.stringify({ email: 'source@example.com', password: 'MergePass123!' })
				})
			} as any)
		).rejects.toMatchObject({ status: 401, body: { message: 'Unauthorized' } });
	});

	it('rejects merges when the database is unavailable', async () => {
		const { POST } = await import('../../src/routes/api/auth/merge/+server');

		await expect(
			POST({
				locals: { user: { id: 'target-user', email: 'target@example.com' } },
				platform: {},
				request: new Request('http://localhost/api/auth/merge', {
					method: 'POST',
					body: JSON.stringify({ email: 'source@example.com', password: 'MergePass123!' })
				})
			} as any)
		).rejects.toMatchObject({ status: 500, body: { message: 'Database not available' } });
	});

	it('rejects merges when required fields are missing', async () => {
		const { POST } = await import('../../src/routes/api/auth/merge/+server');

		await expect(
			POST({
				locals: { user: { id: 'target-user', email: 'target@example.com' } },
				platform: { env: { DB: { prepare: vi.fn() } } },
				request: new Request('http://localhost/api/auth/merge', {
					method: 'POST',
					body: JSON.stringify({ email: '', password: '' })
				})
			} as any)
		).rejects.toMatchObject({
			status: 400,
			body: { message: 'Email and password are required to merge an account.' }
		});
	});

	it('rejects merges when payload values are not strings', async () => {
		const { POST } = await import('../../src/routes/api/auth/merge/+server');

		await expect(
			POST({
				locals: { user: { id: 'target-user', email: 'target@example.com' } },
				platform: { env: { DB: { prepare: vi.fn() } } },
				request: new Request('http://localhost/api/auth/merge', {
					method: 'POST',
					body: JSON.stringify({ email: 123, password: 456 })
				})
			} as any)
		).rejects.toMatchObject({
			status: 400,
			body: { message: 'Email and password are required to merge an account.' }
		});
	});
});
import '../helpers/server-response';
