import { getConfiguredAuthProviders } from '$lib/utils/auth-provider-config';
import { isDevAuthSimulationEnabled } from '$lib/utils/dev-auth';
import { getUserAuthState, type OAuthAccountConnection } from '$lib/utils/user-auth-state';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, platform, url }) => {
	// Require authentication
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}

	let connectedAccounts: OAuthAccountConnection[] = [];
	let hasPassword = false;
	let loginEmails = [locals.user.email];

	if (platform?.env?.DB) {
		try {
			const authState = await getUserAuthState(
				platform.env.DB as any,
				locals.user.id,
				locals.user.email
			);
			connectedAccounts = authState.connectedAccounts;
			hasPassword = authState.hasPassword;
			loginEmails = authState.loginEmails;

			const hasGitHubConnection = connectedAccounts.some(
				(account) => account.provider === 'github'
			);
			const canRestoreLegacyGithubLink = /^\d+$/.test(locals.user.id);

			if (!hasGitHubConnection && canRestoreLegacyGithubLink) {
				const userRecord = await platform.env.DB.prepare(
					'SELECT github_login FROM users WHERE id = ?'
				)
					.bind(locals.user.id)
					.first<{ github_login: string | null }>();

				if (userRecord?.github_login) {
					await platform.env.DB.prepare(
						`INSERT INTO oauth_accounts (id, user_id, provider, provider_account_id, created_at)
						 VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`
					)
						.bind(crypto.randomUUID(), locals.user.id, 'github', locals.user.id)
						.run();

					connectedAccounts = [
						...connectedAccounts,
						{
							provider: 'github',
							provider_account_id: locals.user.id,
							created_at: new Date().toISOString()
						}
					];
				}
			} else if (!hasGitHubConnection) {
				const githubLogin = locals.user.githubLogin;

				if (githubLogin) {
					connectedAccounts = [
						...connectedAccounts,
						{
							provider: 'github',
							provider_account_id: githubLogin,
							created_at: new Date().toISOString()
						}
					];
				}
			}
		} catch (err) {
			console.error('[Profile] Failed to fetch auth state:', err);
		}
	}

	if (locals.user.isPretend && locals.user.simulatedConnections?.length) {
		const knownProviders = new Set(connectedAccounts.map((account) => account.provider));
		for (const provider of locals.user.simulatedConnections) {
			if (!knownProviders.has(provider)) {
				connectedAccounts = [
					...connectedAccounts,
					{
						provider,
						provider_account_id: locals.user.login,
						created_at: new Date().toISOString()
					}
				];
			}
		}
	}

	const devAuthSimulationEnabled = isDevAuthSimulationEnabled(url, platform);

	return {
		user: locals.user,
		connectedAccounts,
		hasPassword,
		loginEmails,
		configuredProviders: await getConfiguredAuthProviders(platform),
		devAuthSimulationEnabled
	};
};
