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

		// Use configured voice model or default
		const voiceModel = aiKey.voiceModel || 'gpt-4o-realtime-preview-2024-12-17';
		console.log('Creating realtime session with model:', voiceModel);

		// Create realtime session
		const session = await createRealtimeSession(aiKey.apiKey, voiceModel);
		console.log('Realtime session created, token length:', session.token?.length);
		console.log('Token prefix:', session.token?.substring(0, 30) + '...');

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
