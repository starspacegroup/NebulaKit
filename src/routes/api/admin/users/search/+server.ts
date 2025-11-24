import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals, fetch }) => {
	// Check if user is authenticated and is admin
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	if (!locals.user.isOwner && !locals.user.isAdmin) {
		throw error(403, 'Forbidden');
	}

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

		return json({
			users: (data.items || []).map((user: any) => ({
				login: user.login,
				id: user.id,
				avatar_url: user.avatar_url,
				html_url: user.html_url
			}))
		});
	} catch (err) {
		console.error('Failed to search GitHub users:', err);
		throw error(500, 'Failed to search GitHub users');
	}
};
