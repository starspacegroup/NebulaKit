/**
 * GET /.well-known/agent-skills/<name>/SKILL.md — one skill document.
 *
 * Rendered from src/lib/server/agent-skills.ts for the requesting origin, so
 * the bytes here are exactly the bytes the discovery index digested.
 */
import { findAgentSkill } from '$lib/server/agent-skills';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params, url }) => {
	const skill = findAgentSkill(params.skill);
	if (!skill) {
		throw error(404, 'No such skill');
	}

	return new Response(skill.render(url.origin), {
		headers: {
			'Content-Type': 'text/markdown; charset=utf-8',
			'Cache-Control': 'public, max-age=300'
		}
	});
};
