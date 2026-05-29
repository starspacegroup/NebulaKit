const LOCAL_DEV_HOSTS = new Set(['localhost', '127.0.0.1']);

function isLocalDevHost(url: URL): boolean {
	return LOCAL_DEV_HOSTS.has(url.hostname);
}

export function isDevAuthSimulationEnabled(
	url: URL,
	platform: App.Platform | undefined
): boolean {
	const explicitOverride = platform?.env?.DEV_AUTH_BYPASS === 'true';
	if (explicitOverride) {
		return true;
	}

	const isTestMode = import.meta.env.MODE === 'test';
	if (isTestMode) {
		return false;
	}

	return import.meta.env.DEV && isLocalDevHost(url);
}
