const LOCAL_DEV_HOSTS = new Set(['localhost', '127.0.0.1']);

function isLocalDevHost(url: URL | undefined): boolean {
	// No URL means we cannot prove this is a local host — fail closed.
	return !!url && LOCAL_DEV_HOSTS.has(url.hostname);
}

export function isDevAuthSimulationEnabled(url: URL, platform: App.Platform | undefined): boolean {
	// The simulator mints a real owner/admin session server-side, so it must never
	// be reachable in production. Both the explicit override and the implicit
	// dev-mode path additionally require a local host — a stray DEV_AUTH_BYPASS on
	// a deployed environment can no longer hand out owner access from the internet.
	if (!isLocalDevHost(url)) {
		return false;
	}

	const explicitOverride = platform?.env?.DEV_AUTH_BYPASS === 'true';
	if (explicitOverride) {
		return true;
	}

	const isTestMode = import.meta.env.MODE === 'test';
	if (isTestMode) {
		return false;
	}

	return import.meta.env.DEV;
}
