import {
	formatMessagesForOpenAI,
	getConfiguredChatModels,
	getEnabledOpenAIKey,
	selectDefaultChatModel,
	streamChatCompletion
} from '$lib/services/openai-chat';
import { calculateCost, getModelDisplayName } from '$lib/utils/cost';
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
		const { messages, model: requestedModel } = body;

		// Validate messages
		if (!Array.isArray(messages) || messages.length === 0) {
			throw error(400, 'Invalid messages format');
		}

		if (requestedModel !== undefined && (typeof requestedModel !== 'string' || !requestedModel)) {
			throw error(400, 'Invalid model');
		}

		let aiKey = await getEnabledOpenAIKey(platform!, requestedModel);
		if (!aiKey && requestedModel) {
			throw error(400, 'Unknown or disabled model');
		}
		if (!aiKey) throw error(503, 'No OpenAI API key configured');

		const configuredModels = getConfiguredChatModels(aiKey);
		const model = requestedModel || selectDefaultChatModel(configuredModels);
		if (!model) throw error(503, 'No chat models configured');

		// Format messages for OpenAI
		const formattedMessages = formatMessagesForOpenAI(messages);

		// Create a ReadableStream for Server-Sent Events
		const stream = new ReadableStream({
			async start(controller) {
				const encoder = new TextEncoder();

				try {
					// Stream chat completion with selected model
					for await (const chunk of streamChatCompletion(aiKey.apiKey, formattedMessages, {
						model
					})) {
						if (chunk.type === 'content' && chunk.content) {
							// Send content as SSE
							const data = `data: ${JSON.stringify({ content: chunk.content })}\n\n`;
							controller.enqueue(encoder.encode(data));
						} else if (chunk.type === 'usage' && chunk.usage) {
							// Calculate cost and send usage data
							const model = chunk.model || 'gpt-4o';
							const costResult = calculateCost(
								model,
								chunk.usage.promptTokens,
								chunk.usage.completionTokens
							);

							const usageData = `data: ${JSON.stringify({
								usage: {
									inputTokens: chunk.usage.promptTokens,
									outputTokens: chunk.usage.completionTokens,
									totalCost: costResult.totalCost,
									model: model,
									displayName: getModelDisplayName(model)
								}
							})}\n\n`;
							controller.enqueue(encoder.encode(usageData));
						}
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
