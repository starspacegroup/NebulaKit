import {
	CHAT_MODELS,
	getConfiguredChatModels,
	getEnabledOpenAIKeys,
	selectDefaultChatModel
} from '$lib/services/openai-chat';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!platform?.env?.KV) throw error(503, 'Storage not available');

	const keys = await getEnabledOpenAIKeys(platform);
	const enabledIds = new Set(keys.flatMap(getConfiguredChatModels));
	const models = CHAT_MODELS.filter(({ id }) => enabledIds.has(id));

	return json({
		models,
		defaultModel: selectDefaultChatModel(models.map(({ id }) => id)) ?? null
	});
};
