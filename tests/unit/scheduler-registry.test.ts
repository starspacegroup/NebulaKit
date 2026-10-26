/**
 * The schedule is written in three places: the job registry, the cron Worker's
 * `wrangler.toml` triggers, and the Worker's cron-to-path map. A job on a cron
 * nothing fires never runs, and a trigger nothing claims wakes the Worker for
 * no reason. These tests make drift a failure rather than a silent outage.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CRON_PATHS } from '../../cron-worker/src/index';
import { isValidCron } from '../../src/lib/server/scheduler/cron';
import {
	getScheduledJob,
	registeredCrons,
	SCHEDULED_JOBS
} from '../../src/lib/server/scheduler/registry';

const root = process.cwd();

/** The crons of the top-level `[triggers]` table, parsed from the file that gets deployed. */
export function cronsIn(tomlPath: string): string[] {
	const lines = readFileSync(resolve(root, tomlPath), 'utf8').split('\n');
	const start = lines.findIndex((line) => line.trim() === '[triggers]');
	if (start === -1) return [];
	const rest = lines.slice(start + 1);
	const next = rest.findIndex((line) => line.startsWith('['));
	const table = (next === -1 ? rest : rest.slice(0, next))
		.filter((line) => !line.trim().startsWith('#'))
		.join('\n');
	const crons = /crons\s*=\s*\[([\s\S]*?)\]/.exec(table);
	return crons ? [...crons[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort() : [];
}

describe('the job registry', () => {
	it('registers jobs with unique ids, crons and paths', () => {
		expect(SCHEDULED_JOBS.length).toBeGreaterThan(0);
		for (const key of ['id', 'cron', 'path'] as const) {
			const values = SCHEDULED_JOBS.map((job) => job[key]);
			expect(new Set(values).size, key).toBe(values.length);
		}
	});

	it('describes every job and gives it a usable timeout and cron', () => {
		for (const job of SCHEDULED_JOBS) {
			expect(job.description, job.id).toBeTruthy();
			expect(job.timeoutMs, job.id).toBeGreaterThan(0);
			expect(isValidCron(job.cron), `${job.id}: ${job.cron}`).toBe(true);
			expect(job.path, job.id).toMatch(/^\/api\/cron\/[a-z0-9-]+$/);
		}
	});

	it('looks a job up by id', () => {
		expect(getScheduledJob(SCHEDULED_JOBS[0].id)).toBe(SCHEDULED_JOBS[0]);
		expect(getScheduledJob('no-such-job')).toBeUndefined();
	});

	it('has a real POST route file for every registered path', async () => {
		for (const job of SCHEDULED_JOBS) {
			const file = resolve(root, 'src/routes', `.${job.path}`, '+server.ts');
			expect(existsSync(file), `${job.id}: no route file at ${file}`).toBe(true);
			const module = await import(/* @vite-ignore */ file);
			expect(typeof module.POST, `${job.id}: route has no POST`).toBe('function');
		}
	});

	it('has no cron route that is missing from the registry', () => {
		// The other direction: a /api/cron/* route nothing schedules is dead code.
		const dir = resolve(root, 'src/routes/api/cron');
		const routes = readdirSync(dir, { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => `/api/cron/${entry.name}`)
			.sort();
		expect(routes).toEqual(SCHEDULED_JOBS.map((job) => job.path).sort());
	});
});

describe('the registry, the cron Worker triggers and the Worker path map', () => {
	it('agree exactly on which crons exist', () => {
		const triggers = cronsIn('cron-worker/wrangler.toml');
		expect(triggers.length).toBeGreaterThan(0);
		expect(triggers).toEqual(registeredCrons());
		expect(Object.keys(CRON_PATHS).sort()).toEqual(registeredCrons());
	});

	it('map each cron to the path of the job that owns it', () => {
		for (const job of SCHEDULED_JOBS) {
			expect(CRON_PATHS[job.cron], job.id).toBe(job.path);
		}
	});

	it('reads the right table: the parser sees nothing in a file with no triggers', () => {
		// Pages rejects [triggers], so the app's own wrangler.toml must not have
		// one. This also proves cronsIn is not vacuously passing.
		expect(cronsIn('wrangler.toml')).toEqual([]);
	});
});
