import { createRealtimeSession, getEnabledOpenAIKey } from '$lib/services/openai-chat';
import type { RequestEvent } from '@sveltejs/kit';
import { error, json } from '@sveltejs/kit';

/**
 * POST /api/chat/voice/session
 * Create ephemeral token for OpenAI Realtime API (voice chat)
 */
export async function POST({ request, platform, locals }: RequestEvent) {
	// Check authentication
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	try {
		// Get enabled OpenAI key
		const aiKey = await getEnabledOpenAIKey(platform!);
		if (!aiKey) {
			throw error(503, 'No OpenAI API key configured');
		}

		// Check if voice chat is enabled
		if (!aiKey.voiceEnabled) {
			throw error(403, 'Voice chat is not enabled');
		}

		// Admin configuration stores an ordered array; retain the singular field only
		// for keys already persisted by older releases.
		const voiceModel =
			aiKey.voiceModels?.[0] || aiKey.voiceModel || 'gpt-4o-realtime-preview-2024-12-17';

		// Create realtime session
		const session = await createRealtimeSession(aiKey.apiKey, voiceModel);

		return json({
			token: session.token,
			model: voiceModel
		});
	} catch (err: any) {
		console.error('Voice session error:', err);
		console.error('Error details:', err.message, err.status);
		if (err.status) {
			throw err;
		}
		throw error(500, 'Failed to create voice session');
	}
}
