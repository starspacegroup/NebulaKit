import { mergeAccounts } from '$lib/services/account-merge';
import { findUserByEmailOrAlias, resolveOwnerStatus } from '$lib/utils/auth-identity';
import { createAuthSession } from '$lib/utils/db';
import { buildSessionCookieHeader } from '$lib/utils/session';
import { consumeOAuthState } from '$lib/server/oauth-state';
import { isRedirect, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// GET - Handle Discord OAuth callback
export const GET: RequestHandler = async ({ url, cookies, platform }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');

	if (!code) {
		throw redirect(302, '/auth/login?error=no_code');
	}

	// Reject callbacks we did not initiate. Without this an attacker can feed a
	// victim a callback URL carrying the attacker's code and bind the victim's
	// session — or, in linking mode, the victim's account — to the attacker's
	// identity.
	if (!consumeOAuthState(cookies, 'discord', state)) {
		throw redirect(302, '/auth/login?error=invalid_state');
	}

	try {
		// Fetch Discord OAuth configuration from env or KV
		let clientId = platform?.env?.DISCORD_CLIENT_ID;
		let clientSecret = platform?.env?.DISCORD_CLIENT_SECRET;

		// Try to fetch from KV if environment variables not set
		if ((!clientId || !clientSecret) && platform?.env?.KV) {
			try {
				const stored = await platform.env.KV.get('auth_config:discord');
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
			console.error('Discord OAuth not configured - missing clientId or clientSecret');
			throw redirect(302, '/auth/login?error=not_configured');
		}

		const callbackUrl = `${url.origin}/api/auth/discord/callback`;

		// Exchange code for access token
		const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: new URLSearchParams({
				client_id: clientId,
				client_secret: clientSecret,
				code,
				grant_type: 'authorization_code',
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

		// Fetch user info from Discord
		const userResponse = await fetch('https://discord.com/api/users/@me', {
			headers: {
				Authorization: `Bearer ${accessToken}`
			}
		});

		if (!userResponse.ok) {
			const errorText = await userResponse.text();
			console.error('Failed to fetch user info:', userResponse.status, errorText);
			throw redirect(302, '/auth/login?error=user_fetch_failed');
		}

		const discordUser = await userResponse.json();

		// Build avatar URL
		const avatarUrl = discordUser.avatar
			? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
			: `https://cdn.discordapp.com/embed/avatars/${parseInt(discordUser.discriminator || '0') % 5}.png`;

		// Generate unique user ID with discord prefix
		const userId = `discord_${discordUser.id}`;

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

		// Store or update user in database
		let isAdmin = false;
		if (platform?.env?.DB) {
			try {
				if (isLinkingMode && existingUser) {
					// Link Discord account to existing user
					// First check if this Discord account is already linked to another user
					const existingOAuth = await platform.env.DB.prepare(
						'SELECT user_id FROM oauth_accounts WHERE provider = ? AND provider_account_id = ?'
					)
						.bind('discord', discordUser.id)
						.first<{ user_id: string }>();

					if (existingOAuth && existingOAuth.user_id !== existingUser.id) {
						// Discord account is linked to a different user - merge the accounts
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
							.bind(crypto.randomUUID(), existingUser.id, 'discord', discordUser.id, accessToken)
							.run();
					}

					// Redirect back to profile with success
					return new Response(null, {
						status: 302,
						headers: {
							Location: new URL('/profile?linked=discord', url.origin).toString()
						}
					});
				}

				// Check if this Discord account is already linked to a user
				const linkedAccount = await platform.env.DB.prepare(
					'SELECT user_id FROM oauth_accounts WHERE provider = ? AND provider_account_id = ?'
				)
					.bind('discord', discordUser.id)
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
						const isOwner = await resolveOwnerStatus(platform, linkedUser);

						const sessionData = {
							id: linkedUser.id,
							login: linkedUser.github_login || discordUser.username,
							name: linkedUser.name,
							email: linkedUser.email,
							avatarUrl: linkedUser.github_avatar_url || avatarUrl,
							isOwner,
							isAdmin: linkedUser.is_admin === 1 || isOwner
						};

						const sessionCookie = await createAuthSession(platform.env.DB, sessionData);

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

						return new Response(null, {
							status: 302,
							headers: {
								Location: new URL('/', url.origin).toString(),
								'Set-Cookie': cookieParts.join('; ')
							}
						});
					}
				}

				const matchedUser = await findUserByEmailOrAlias(platform.env.DB, discordUser.email);
				const existingUserRecord = await platform.env.DB.prepare(
					'SELECT id, is_admin FROM users WHERE id = ?'
				)
					.bind(userId)
					.first<{ id: string; is_admin: number }>();

				if (matchedUser) {
					if (existingUserRecord && existingUserRecord.id !== matchedUser.id) {
						await mergeAccounts(platform.env.DB, existingUserRecord.id, matchedUser.id);
					}

					const existingOAuthRecord = await platform.env.DB.prepare(
						'SELECT id FROM oauth_accounts WHERE user_id = ? AND provider = ?'
					)
						.bind(matchedUser.id, 'discord')
						.first<{ id: string }>();

					if (!existingOAuthRecord) {
						await platform.env.DB.prepare(
							`INSERT INTO oauth_accounts (id, user_id, provider, provider_account_id, access_token, created_at)
							VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
						)
							.bind(crypto.randomUUID(), matchedUser.id, 'discord', discordUser.id, accessToken)
							.run();
					}

					const isOwner = await resolveOwnerStatus(platform, matchedUser);
					const matchedSessionId = await createAuthSession(platform.env.DB, {
						id: matchedUser.id,
						login: matchedUser.github_login || discordUser.username,
						email: matchedUser.email,
						name: matchedUser.name || discordUser.global_name || discordUser.username,
						avatarUrl: matchedUser.github_avatar_url || avatarUrl,
						isOwner,
						isAdmin: matchedUser.is_admin === 1 || isOwner,
						githubLogin: matchedUser.github_login || undefined
					});
					return new Response(null, {
						status: 302,
						headers: {
							Location: new URL(
								isOwner || matchedUser.is_admin === 1 ? '/admin' : '/',
								url.origin
							).toString(),
							'Set-Cookie': buildSessionCookieHeader(matchedSessionId, url)
						}
					});
				}

				if (existingUserRecord) {
					// Update existing user
					isAdmin = existingUserRecord.is_admin === 1;
					await platform.env.DB.prepare(
						`UPDATE users 
						SET name = ?, updated_at = CURRENT_TIMESTAMP 
						WHERE id = ?`
					)
						.bind(discordUser.global_name || discordUser.username, userId)
						.run();

					// Ensure Discord oauth_account record exists for existing users
					const existingDiscordOAuth = await platform.env.DB.prepare(
						'SELECT id FROM oauth_accounts WHERE user_id = ? AND provider = ?'
					)
						.bind(userId, 'discord')
						.first();

					if (!existingDiscordOAuth) {
						await platform.env.DB.prepare(
							`INSERT INTO oauth_accounts (id, user_id, provider, provider_account_id, access_token, created_at)
							VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
						)
							.bind(crypto.randomUUID(), userId, 'discord', discordUser.id, accessToken)
							.run();
					}
				} else {
					// Create new user
					await platform.env.DB.prepare(
						`INSERT INTO users (id, email, name, created_at) 
						VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
					)
						.bind(
							userId,
							discordUser.email || `${discordUser.username}@discord.local`,
							discordUser.global_name || discordUser.username
						)
						.run();

					// Also create OAuth account record for Discord
					await platform.env.DB.prepare(
						`INSERT INTO oauth_accounts (id, user_id, provider, provider_account_id, access_token, created_at)
						VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
					)
						.bind(crypto.randomUUID(), userId, 'discord', discordUser.id, accessToken)
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

		// Create session. Fail closed if the store is unreachable rather than
		// issuing a cookie the hooks would reject.
		if (!platform?.env?.DB) {
			throw redirect(302, '/auth/login?error=oauth_failed');
		}

		const sessionData = {
			id: userId,
			login: discordUser.username,
			name: discordUser.global_name || discordUser.username,
			email: discordUser.email,
			avatarUrl,
			isOwner: false, // Discord-only users can't be owner (owner is GitHub ID based)
			isAdmin
		};

		// Store the trusted payload server-side; the cookie carries only the id.
		const sessionCookie = await createAuthSession(platform.env.DB, sessionData);

		// Redirect to home
		const redirectUrl = '/';
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

		return new Response(null, {
			status: 302,
			headers: {
				Location: absoluteRedirectUrl,
				'Set-Cookie': cookieParts.join('; ')
			}
		});
	} catch (err) {
		// Re-throw redirects immediately
		if (isRedirect(err)) {
			throw err;
		}
		// Log actual errors only
		console.error('Discord OAuth callback error:', err);
		throw redirect(302, '/auth/login?error=oauth_failed');
	}
};
