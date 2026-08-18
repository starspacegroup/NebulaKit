import { requireAdmin } from '$lib/server/auth-guards';
import { isPiiRevealed, maskGeneric, PII_REVEAL_COOKIE } from '$lib/server/pii-mask';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals, fetch, cookies }) => {
	const viewer = requireAdmin(locals);

	const query = url.searchParams.get('q');
	if (!query || query.length < 2) {
		return json({ users: [] });
	}

	try {
		// Search GitHub for users
		const response = await fetch(
			`https://api.github.com/search/users?q=${encodeURIComponent(query)}&per_page=10`,
			{
				headers: {
					Accept: 'application/vnd.github.v3+json',
					'User-Agent': 'NebulaKit'
				}
			}
		);

		if (!response.ok) {
			throw error(response.status, 'GitHub API request failed');
		}

		const data = await response.json();

		const revealed = isPiiRevealed(viewer, cookies?.get(PII_REVEAL_COOKIE));
		const users = (data.items || []).map((user: any) => {
			const result = {
				login: user.login,
				id: user.id,
				avatar_url: user.avatar_url,
				html_url: user.html_url
			};
			return revealed
				? result
				: {
						...result,
						login: maskGeneric(String(result.login ?? '')),
						id: maskGeneric(String(result.id ?? '')),
						avatar_url: null,
						html_url: null
					};
		});

		return json({ users });
	} catch (err) {
		console.error('Failed to search GitHub users:', err);
		throw error(500, 'Failed to search GitHub users');
	}
};
