import {
	formatMessagesForOpenAI,
	getEnabledOpenAIKey,
	streamChatCompletion
} from '$lib/services/openai-chat';
import type { RequestEvent } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';

/**
 * POST /api/chat/stream
 * Stream chat responses from OpenAI
 */
export async function POST({ request, platform, locals }: RequestEvent) {
	// Check authentication
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	try {
		// Parse request body
		const body = await request.json();
		const { messages } = body;

		// Validate messages
		if (!Array.isArray(messages) || messages.length === 0) {
			throw error(400, 'Invalid messages format');
		}

		// Get enabled OpenAI key
		const aiKey = await getEnabledOpenAIKey(platform!);
		if (!aiKey) {
			throw error(503, 'No OpenAI API key configured');
		}

		// Format messages for OpenAI
		const formattedMessages = formatMessagesForOpenAI(messages);

		// Create a ReadableStream for Server-Sent Events
		const stream = new ReadableStream({
			async start(controller) {
				const encoder = new TextEncoder();

				try {
					// Stream chat completion
					for await (const chunk of streamChatCompletion(aiKey.apiKey, formattedMessages)) {
						// Send as SSE
						const data = `data: ${JSON.stringify({ content: chunk })}\n\n`;
						controller.enqueue(encoder.encode(data));
					}

					// Send done signal
					controller.enqueue(encoder.encode('data: [DONE]\n\n'));
				} catch (err) {
					console.error('Streaming error:', err);
					const errorData = `data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`;
					controller.enqueue(encoder.encode(errorData));
				} finally {
					controller.close();
				}
			}
		});

		// Return streaming response
		return new Response(stream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive'
			}
		});
	} catch (err: any) {
		console.error('Chat stream error:', err);
		if (err.status) {
			throw err;
		}
		throw error(500, 'Failed to stream chat response');
	}
}
