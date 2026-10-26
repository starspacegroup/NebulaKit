import type { LandingPage } from './types';

/** Identity helper so a page file is type-checked against the schema. */
export const definePage = (page: LandingPage): LandingPage => page;
