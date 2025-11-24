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

		// Check if user is the OAuth app owner
		// First try environment variable, then fall back to KV
		let appOwnerId = platform?.env?.GITHUB_OWNER_ID;

		// Try to fetch from KV if environment variable not set
		if (!appOwnerId && platform?.env?.KV) {
			try {
				const storedOwnerId = await platform.env.KV.get('github_owner_id');
				if (storedOwnerId) {
					appOwnerId = storedOwnerId;
				}
			} catch (err) {
				console.error('Failed to fetch owner ID from KV:', err);
			}
		}

		const isOwner = appOwnerId ? githubUser.id === parseInt(appOwnerId) : false;

		// Store or update user in database
		let isAdmin = false;
		if (platform?.env?.DB) {
			try {
				// Check if user exists
				const existingUser = await platform.env.DB.prepare(
					'SELECT id, is_admin FROM users WHERE id = ?'
				)
					.bind(githubUser.id.toString())
					.first<{ id: string; is_admin: number }>();

				if (existingUser) {
					// Update existing user
					isAdmin = existingUser.is_admin === 1;
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
				}
			} catch (dbErr) {
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

		// Store session in cookie (in production, store in D1/KV and use session ID)
		const sessionCookie = btoa(JSON.stringify(sessionData));

		cookies.set('session', sessionCookie, {
			path: '/',
			httpOnly: true,
			secure: url.protocol === 'https:',
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 7 // 7 days
		});

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
		console.log(
			`GitHub OAuth success: user=${githubUser.login}, id=${githubUser.id}, isOwner=${isOwner}, redirecting to ${redirectUrl}`
		);

		throw redirect(302, redirectUrl);
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
