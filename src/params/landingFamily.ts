import { LANDING, isLandingSegment } from '$lib/landing';
import type { ParamMatcher } from '@sveltejs/kit';

/** Matches configured landing family prefixes and their legacy names only. */
export const match: ParamMatcher = (param) => isLandingSegment(LANDING, param);
