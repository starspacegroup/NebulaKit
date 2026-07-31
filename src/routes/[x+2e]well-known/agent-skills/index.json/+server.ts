/**
 * GET /.well-known/agent-skills/index.json — Agent Skills Discovery index
 * (RFC v0.2.0, https://github.com/cloudflare/agent-skills-discovery-rfc).
 *
 * Each entry carries a `digest` computed from the exact bytes the matching
 * SKILL.md route will render for this same origin, so an agent can verify what
 * it downloaded. Because both sides render from src/lib/server/agent-skills.ts,
 * the digest cannot drift from the document.
 *
 * See the `[x+2e]well-known` note in ../api-catalog/+server.ts for why the
 * directory is named that way.
 */
import { AGENT_SKILLS, skillDigest } from '$lib/server/agent-skills';
import { absoluteUrl } from '$lib/agent-discovery';
import type { RequestHandler } from './$types';

/** Published schema for the discovery document. */
const SCHEMA_URL = 'https://schemas.agentskills.io/discovery/0.2.0/schema.json';

export const GET: RequestHandler = async ({ url }) => {
	const origin = url.origin;

	const skills = await Promise.all(
		AGENT_SKILLS.map(async (skill) => ({
			name: skill.name,
			// "skill-md" = a single Markdown document, as opposed to "archive".
			type: 'skill-md' as const,
			description: skill.description,
			url: absoluteUrl(origin, `/.well-known/agent-skills/${skill.name}/SKILL.md`),
			digest: await skillDigest(skill.render(origin))
		}))
	);

	return new Response(JSON.stringify({ $schema: SCHEMA_URL, skills }, null, '\t'), {
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			// Short TTL: the digests must not outlive an edit to a skill body.
			'Cache-Control': 'public, max-age=300'
		}
	});
};
