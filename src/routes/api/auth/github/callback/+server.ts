import { mergeAccounts } from '$lib/services/account-merge';
import { findUserByEmailOrAlias } from '$lib/utils/auth-identity';
import { buildSessionCookieHeader } from '$lib/utils/session';
import { isRedirect, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// GET - Handle GitHub OAuth callback
export const GET: RequestHandler = async ({ url, cookies, platform }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');

	if (!code) {
		throw redirect(302, '/auth/login?error=no_code');
	}

	try {
		// Fetch GitHub OAuth configuration from env or KV
		let clientId = platform?.env?.GITHUB_CLIENT_ID;
		let clientSecret = platform?.env?.GITHUB_CLIENT_SECRET;

		// Try to fetch from KV if environment variables not set
		if ((!clientId || !clientSecret) && platform?.env?.KV) {
			try {
				const stored = await platform.env.KV.get('auth_config:github');
				if (stored) {
					const config = JSON.parse(stored);
					clientId = config.clientId;
					clientSecret = config.clientSecret;
				}
			} catch (err) {
				console.error('Failed to fetch from KV:', err);
			}
		}

		if (!clientId || !clientSecret) {
			console.error('GitHub OAuth not configured - missing clientId or clientSecret');
			throw redirect(302, '/auth/login?error=not_configured');
		}

		const callbackUrl = `${url.origin}/api/auth/github/callback`;

		// Exchange code for access token
		const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json'
			},
			body: JSON.stringify({
				client_id: clientId,
				client_secret: clientSecret,
				code,
				redirect_uri: callbackUrl
			})
		});

		if (!tokenResponse.ok) {
			const errorText = await tokenResponse.text();
			console.error('Failed to exchange code for token:', tokenResponse.status, errorText);
			throw redirect(302, '/auth/login?error=token_exchange_failed');
		}

		const tokenData = await tokenResponse.json();
		const accessToken = tokenData.access_token;

		if (!accessToken) {
			console.error('No access token in response:', tokenData);
			throw redirect(302, '/auth/login?error=no_access_token');
		}

		// Fetch user info from GitHub
		const userResponse = await fetch('https://api.github.com/user', {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				Accept: 'application/vnd.github.v3+json',
				'User-Agent': 'NebulaKit'
			}
		});

		if (!userResponse.ok) {
			const errorText = await userResponse.text();
			console.error('Failed to fetch user info:', userResponse.status, errorText);
			throw redirect(302, '/auth/login?error=user_fetch_failed');
		}

		const githubUser = await userResponse.json();

		// Check for linking mode - if user is already logged in
		const existingSessionCookie = cookies.get('session');
		let existingUser = null;
		let isLinkingMode = false;

		if (existingSessionCookie) {
			try {
				let base64 = existingSessionCookie;
				if (base64.includes('-') || base64.includes('_')) {
					base64 = base64.replace(/-/g, '+').replace(/_/g, '/');
				}
				while (base64.length % 4) {
					base64 += '=';
				}
				existingUser = JSON.parse(atob(base64));
				isLinkingMode = true;
			} catch {
				// Invalid session, treat as new login
			}
		}

		// Check if user is the OAuth app owner
		// First try environment variable, then fall back to KV
		let appOwnerId = platform?.env?.GITHUB_OWNER_ID;
		let appOwnerUsername: string | null = null;

		// If env var is not a valid numeric ID, clear it to fall back to KV
		if (appOwnerId && isNaN(parseInt(appOwnerId))) {
			// It might be a username, store it for comparison
			appOwnerUsername = appOwnerId;
			appOwnerId = undefined;
		}

		// Try to fetch from KV if environment variable not set
		if (!appOwnerId && platform?.env?.KV) {
			try {
				const storedOwnerId = await platform.env.KV.get('github_owner_id');
				if (storedOwnerId) {
					appOwnerId = storedOwnerId;
				}
				// Also get username for fallback comparison
				if (!appOwnerUsername) {
					const storedUsername = await platform.env.KV.get('github_owner_username');
					if (storedUsername) {
						appOwnerUsername = storedUsername;
					}
				}
			} catch (err) {
				console.error('Failed to fetch owner ID from KV:', err);
			}
		}

		// Check if user is owner by ID or username
		let isOwner = false;
		if (appOwnerId) {
			isOwner = githubUser.id === parseInt(appOwnerId);
			console.log(
				`[Auth] Owner check by ID: githubUser.id=${githubUser.id}, appOwnerId=${appOwnerId}, match=${isOwner}`
			);
		}
		if (!isOwner && appOwnerUsername) {
			isOwner = githubUser.login.toLowerCase() === appOwnerUsername.toLowerCase();
			console.log(
				`[Auth] Owner check by username: githubUser.login=${githubUser.login}, appOwnerUsername=${appOwnerUsername}, match=${isOwner}`
			);
		}
		if (!appOwnerId && !appOwnerUsername) {
			console.warn('[Auth] No owner ID or username configured - isOwner will be false');
		}

		// Store or update user in database
		let isAdmin = false;
		if (platform?.env?.DB) {
			try {
				// Handle linking mode - user is already logged in and wants to link GitHub
				if (isLinkingMode && existingUser) {
					// Check if this GitHub account is already linked to another user
					const existingOAuth = await platform.env.DB.prepare(
						'SELECT user_id FROM oauth_accounts WHERE provider = ? AND provider_account_id = ?'
					)
						.bind('github', githubUser.id.toString())
						.first<{ user_id: string }>();

					if (existingOAuth && existingOAuth.user_id !== existingUser.id) {
						// GitHub account is linked to a different user - merge the accounts
						console.log(
							`[Auth] Merging accounts: ${existingOAuth.user_id} into ${existingUser.id}`
						);
						await mergeAccounts(platform.env.DB, existingOAuth.user_id, existingUser.id);
						// After merge, the oauth_account now belongs to existingUser, so we can continue
					}

					// Link the account if not already linked
					if (!existingOAuth) {
						await platform.env.DB.prepare(
							`INSERT INTO oauth_accounts (id, user_id, provider, provider_account_id, access_token, created_at)
							VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
						)
							.bind(
								crypto.randomUUID(),
								existingUser.id,
								'github',
								githubUser.id.toString(),
								accessToken
							)
							.run();

						// Also update user's GitHub info
						await platform.env.DB.prepare(
							`UPDATE users SET github_login = ?, github_avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
						)
							.bind(githubUser.login, githubUser.avatar_url, existingUser.id)
							.run();
					}

					// Redirect back to profile with success
					return new Response(null, {
						status: 302,
						headers: {
							Location: new URL('/profile?linked=github', url.origin).toString()
						}
					});
				}

				// Check if this GitHub account is already linked to a user
				const linkedAccount = await platform.env.DB.prepare(
					'SELECT user_id FROM oauth_accounts WHERE provider = ? AND provider_account_id = ?'
				)
					.bind('github', githubUser.id.toString())
					.first<{ user_id: string }>();

				if (linkedAccount) {
					// Log in as the linked user
					const linkedUser = await platform.env.DB.prepare('SELECT * FROM users WHERE id = ?')
						.bind(linkedAccount.user_id)
						.first<{
							id: string;
							email: string;
							name: string;
							github_login: string;
							github_avatar_url: string;
							is_admin: number;
						}>();

					if (linkedUser) {
						const sessionData = {
							id: linkedUser.id,
							login: linkedUser.github_login || githubUser.login,
							name: linkedUser.name || githubUser.name,
							email: linkedUser.email || githubUser.email,
							avatarUrl: linkedUser.github_avatar_url || githubUser.avatar_url,
							isOwner: false,
							isAdmin: linkedUser.is_admin === 1
						};

						const sessionCookie = btoa(JSON.stringify(sessionData))
							.replace(/\+/g, '-')
							.replace(/\//g, '_')
							.replace(/=+$/, '');

						const isSecure = url.protocol === 'https:';
						const cookieParts = [
							`session=${sessionCookie}`,
							'Path=/',
							'HttpOnly',
							'SameSite=Lax',
							`Max-Age=${60 * 60 * 24 * 7}`
						];
						if (isSecure) {
							cookieParts.push('Secure');
						}

						const redirectUrl = linkedUser.is_admin === 1 ? '/admin' : '/';

						return new Response(null, {
							status: 302,
							headers: {
								Location: new URL(redirectUrl, url.origin).toString(),
								'Set-Cookie': cookieParts.join('; ')
							}
						});
					}
				}

				const matchedUser = await findUserByEmailOrAlias(platform.env.DB, githubUser.email);
				const existingUserRecord = await platform.env.DB.prepare(
					'SELECT id, is_admin FROM users WHERE id = ?'
				)
					.bind(githubUser.id.toString())
					.first<{ id: string; is_admin: number }>();

				if (matchedUser) {
					if (existingUserRecord && existingUserRecord.id !== matchedUser.id) {
						await mergeAccounts(platform.env.DB, existingUserRecord.id, matchedUser.id);
					}

					const existingOAuthRecord = await platform.env.DB.prepare(
						'SELECT id FROM oauth_accounts WHERE user_id = ? AND provider = ?'
					)
						.bind(matchedUser.id, 'github')
						.first<{ id: string }>();

					if (!existingOAuthRecord) {
						await platform.env.DB.prepare(
							`INSERT INTO oauth_accounts (id, user_id, provider, provider_account_id, access_token, created_at)
							VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
						)
							.bind(
								crypto.randomUUID(),
								matchedUser.id,
								'github',
								githubUser.id.toString(),
								accessToken
							)
							.run();
					}

					await platform.env.DB.prepare(
						`UPDATE users SET github_login = ?, github_avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
					)
						.bind(githubUser.login, githubUser.avatar_url, matchedUser.id)
						.run();

					const redirectUrl = matchedUser.is_admin === 1 || isOwner ? '/admin' : '/';
					return new Response(null, {
						status: 302,
						headers: {
							Location: new URL(redirectUrl, url.origin).toString(),
							'Set-Cookie': buildSessionCookieHeader(
								{
									id: matchedUser.id,
									login: githubUser.login,
									email: matchedUser.email,
									name: matchedUser.name || githubUser.name || githubUser.login,
									avatarUrl: githubUser.avatar_url,
									isOwner,
									isAdmin: matchedUser.is_admin === 1 || isOwner,
									githubLogin: githubUser.login
								},
								url
							)
						}
					});
				}

				if (existingUserRecord) {
					// Update existing user
					isAdmin = existingUserRecord.is_admin === 1;
					await platform.env.DB.prepare(
						`UPDATE users 
							SET name = ?, github_login = ?, github_avatar_url = ?, updated_at = CURRENT_TIMESTAMP 
							WHERE id = ?`
					)
						.bind(
							githubUser.name,
							githubUser.login,
							githubUser.avatar_url,
							githubUser.id.toString()
						)
						.run();

					// Ensure oauth_accounts record exists for existing users
					// (handles users created before oauth_accounts was implemented)
					const existingOAuthRecord = await platform.env.DB.prepare(
						'SELECT id FROM oauth_accounts WHERE user_id = ? AND provider = ?'
					)
						.bind(githubUser.id.toString(), 'github')
						.first<{ id: string }>();

					if (!existingOAuthRecord) {
						await platform.env.DB.prepare(
							`INSERT INTO oauth_accounts (id, user_id, provider, provider_account_id, access_token, created_at)
							VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
						)
							.bind(
								crypto.randomUUID(),
								githubUser.id.toString(),
								'github',
								githubUser.id.toString(),
								accessToken
							)
							.run();
					}
				} else {
					// Create new user (owner is automatically admin)
					isAdmin = isOwner;
					await platform.env.DB.prepare(
						`INSERT INTO users (id, email, name, github_login, github_avatar_url, is_admin, created_at) 
							VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
					)
						.bind(
							githubUser.id.toString(),
							githubUser.email || `${githubUser.login}@github.local`,
							githubUser.name,
							githubUser.login,
							githubUser.avatar_url,
							isAdmin ? 1 : 0
						)
						.run();

					// Also create OAuth account record for GitHub
					await platform.env.DB.prepare(
						`INSERT INTO oauth_accounts (id, user_id, provider, provider_account_id, access_token, created_at)
						VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
					)
						.bind(
							crypto.randomUUID(),
							githubUser.id.toString(),
							'github',
							githubUser.id.toString(),
							accessToken
						)
						.run();
				}
			} catch (dbErr) {
				// Re-throw redirects
				if (isRedirect(dbErr)) {
					throw dbErr;
				}
				console.error('Database error:', dbErr);
				// Continue with auth even if DB fails
			}
		}

		// Create session
		const sessionData = {
			id: githubUser.id.toString(),
			login: githubUser.login,
			name: githubUser.name,
			email: githubUser.email,
			avatarUrl: githubUser.avatar_url,
			isOwner,
			isAdmin
		};

		// Store session in cookie using URL-safe base64 encoding
		// Replace +, /, = with URL-safe characters to avoid cookie parsing issues
		const sessionCookie = btoa(JSON.stringify(sessionData))
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=+$/, '');

		// Track first admin login to lock setup page
		if (isOwner && platform?.env?.KV) {
			const hasLoggedInBefore = await platform.env.KV.get('admin_first_login_completed');
			if (!hasLoggedInBefore) {
				await platform.env.KV.put('admin_first_login_completed', 'true');
				console.log('✓ Admin first login completed - setup page is now locked');
			}
		}

		// Log GITHUB_OWNER_ID for debugging
		if (!appOwnerId) {
			console.warn(
				'GITHUB_OWNER_ID not set - all users will have isOwner=false. Set GITHUB_OWNER_ID in wrangler.toml to enable admin access.'
			);
		}

		// Redirect to admin if owner, otherwise to home
		const redirectUrl = isOwner ? '/admin' : '/';

		// Build the absolute redirect URL
		const absoluteRedirectUrl = new URL(redirectUrl, url.origin).toString();

		// Build cookie string manually for proper handling
		const isSecure = url.protocol === 'https:';
		const cookieParts = [
			`session=${sessionCookie}`,
			'Path=/',
			'HttpOnly',
			'SameSite=Lax',
			`Max-Age=${60 * 60 * 24 * 7}` // 7 days
		];
		if (isSecure) {
			cookieParts.push('Secure');
		}

		// Return a redirect response with the cookie header set explicitly
		// This ensures the cookie is properly sent with the redirect
		return new Response(null, {
			status: 302,
			headers: {
				Location: absoluteRedirectUrl,
				'Set-Cookie': cookieParts.join('; ')
			}
		});
	} catch (err) {
		// Re-throw redirects immediately (they are intentional flow control, not errors)
		if (isRedirect(err)) {
			throw err;
		}
		// Log actual errors only
		console.error('GitHub OAuth callback error:', err);
		throw redirect(302, '/auth/login?error=oauth_failed');
	}
};
