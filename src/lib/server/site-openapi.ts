/**
 * The site API's OpenAPI document, served at /api/v1/openapi.json.
 *
 * Written by hand and kept honest by tests/unit/site-api-openapi.test.ts,
 * which fails when a route under src/routes/api/v1 exports a method this
 * document does not describe (or the reverse).
 */
import { API_SCOPES } from '@nebulakit/security';
import { site } from '$lib/site.config';
import { TEMPLATE_VERSION } from './site-info';

type Op = { summary: string; scope: string | null; body?: string };

const OPERATIONS: Record<string, Record<string, Op>> = {
	'/api/v1/site': {
		get: { summary: 'Site identity, versions and update choices', scope: 'site:read' }
	},
	'/api/v1/site/updates': {
		get: { summary: 'Feature updates this site takes', scope: 'site:read' },
		put: {
			summary: 'Choose feature updates (security updates are forced)',
			scope: 'site:admin',
			body: 'UpdatePreferences'
		}
	},
	'/api/v1/products': {
		get: { summary: 'Active products (?all=1 with products:read includes inactive)', scope: null },
		post: { summary: 'Create a product', scope: 'products:write', body: 'ProductInput' }
	},
	'/api/v1/products/{id}': {
		get: { summary: 'One product by id or slug', scope: null },
		patch: { summary: 'Update a product', scope: 'products:write', body: 'ProductInput' },
		delete: { summary: 'Delete a product', scope: 'products:write' }
	},
	'/api/v1/checkout': {
		post: {
			summary: 'Place an order; prices come from the catalog, never the body',
			scope: null,
			body: 'Checkout'
		}
	},
	'/api/v1/checkout/quote': {
		post: {
			summary: 'Price a cart without ordering, regional pricing included',
			scope: null,
			body: 'Quote'
		}
	},
	'/api/v1/pricing': {
		get: { summary: 'Regional (purchasing-power) pricing settings', scope: 'pricing:read' },
		put: {
			summary: 'Change regional pricing settings; a partial body is merged',
			scope: 'pricing:write',
			body: 'RegionalPricing'
		}
	},
	'/api/v1/pricing/preview': {
		get: {
			summary: 'What a buyer in ?country= would pay (optional ?priceCents=)',
			scope: 'pricing:read'
		}
	},
	'/api/v1/orders': {
		get: { summary: 'Orders, newest first (?status=&limit=)', scope: 'orders:read' }
	},
	'/api/v1/orders/{id}': {
		get: { summary: 'One order with its lines', scope: 'orders:read' },
		patch: {
			summary: 'Move an order to its next status',
			scope: 'orders:write',
			body: 'OrderPatch'
		}
	},
	'/api/v1/orders/{id}/status': {
		get: {
			summary:
				'Public: only { status } for an order id, so a returning shopper can wait for payment',
			scope: null
		}
	},
	'/api/v1/pages': {
		get: { summary: 'Published pages (drafts too with pages:read)', scope: null }
	},
	'/api/v1/pages/{slug}': {
		get: { summary: 'One page document', scope: null },
		put: { summary: 'Create or replace a page', scope: 'pages:write', body: 'PageInput' },
		delete: { summary: 'Delete a page', scope: 'pages:write' }
	},
	'/api/v1/pages/{slug}/revisions': {
		get: { summary: "A page's saved revisions, newest first", scope: 'pages:read' }
	},
	'/api/v1/pages/{slug}/revisions/{id}': {
		get: { summary: 'One revision with its document', scope: 'pages:read' },
		post: { summary: 'Put a revision back as the page', scope: 'pages:write' }
	},
	'/api/v1/webhooks/stripe': {
		post: {
			summary:
				'Stripe checkout events: completed, async succeeded/failed, expired (Stripe-Signature, not an API key; 503 until configured)',
			scope: null
		}
	}
};

export function siteOpenApi() {
	const paths: Record<string, Record<string, unknown>> = {};
	for (const [path, ops] of Object.entries(OPERATIONS)) {
		paths[path] = {};
		for (const [method, op] of Object.entries(ops)) {
			paths[path][method] = {
				summary: op.summary,
				...(op.scope
					? { security: [{ bearer: [op.scope] }], 'x-required-scope': op.scope }
					: { security: [] }),
				...(op.body
					? {
							requestBody: {
								required: true,
								content: {
									'application/json': { schema: { $ref: `#/components/schemas/${op.body}` } }
								}
							}
						}
					: {}),
				responses: {
					'2XX': { description: 'Success' },
					'4XX': { description: '{ error, details? }' }
				}
			};
		}
	}
	return {
		openapi: '3.1.0',
		info: {
			title: `${site.name} site API`,
			version: TEMPLATE_VERSION,
			description:
				'Everything this site does is reachable here: shop, pages, settings. Keys are issued by the owner at /admin/api-keys; send them as `Authorization: Bearer nk_…`. `site:admin` implies every scope.'
		},
		paths,
		components: {
			securitySchemes: {
				bearer: { type: 'http', scheme: 'bearer', description: `Scopes: ${API_SCOPES.join(', ')}` }
			},
			schemas: {
				UpdatePreferences: {
					type: 'object',
					required: ['autoApplyFeatures', 'optedIn'],
					properties: {
						autoApplyFeatures: { type: 'boolean' },
						optedIn: { type: 'array', items: { type: 'string' } }
					}
				},
				ProductInput: {
					type: 'object',
					required: ['slug', 'name', 'priceCents'],
					properties: {
						slug: { type: 'string' },
						name: { type: 'string' },
						description: { type: 'string' },
						priceCents: { type: 'integer', minimum: 0 },
						currency: { type: 'string' },
						imageUrl: { type: ['string', 'null'] },
						type: { enum: ['physical', 'digital'] },
						printfulVariantId: { type: ['integer', 'null'] },
						active: { type: 'boolean' }
					}
				},
				Checkout: {
					type: 'object',
					required: ['email', 'lines'],
					properties: {
						email: { type: 'string' },
						lines: {
							type: 'array',
							items: {
								type: 'object',
								properties: { productId: { type: 'string' }, quantity: { type: 'integer' } }
							}
						},
						shippingAddress: { type: 'object' }
					}
				},
				Quote: {
					type: 'object',
					required: ['lines'],
					properties: {
						lines: {
							type: 'array',
							items: {
								type: 'object',
								properties: { productId: { type: 'string' }, quantity: { type: 'integer' } }
							}
						},
						shippingCountry: { type: 'string', description: 'ISO 3166-1 alpha-2' }
					}
				},
				RegionalPricing: {
					type: 'object',
					description:
						'Prices only ever go down. Off by default. An order takes the least generous of the request, billing and shipping countries.',
					properties: {
						enabled: { type: 'boolean' },
						strength: { type: 'number', minimum: 0, maximum: 1 },
						maxDiscount: { type: 'number', minimum: 0, maximum: 0.9 },
						scope: { enum: ['digital', 'all'] },
						overrides: {
							type: 'object',
							description: 'Country code to multiplier, 0.1 to 1 (0.6 = 40% off, 1 = full price)',
							additionalProperties: { type: 'number', minimum: 0.1, maximum: 1 }
						}
					}
				},
				OrderPatch: {
					type: 'object',
					required: ['status'],
					properties: {
						status: {
							enum: ['pending', 'paid', 'fulfilling', 'shipped', 'delivered', 'cancelled']
						},
						paymentReference: { type: 'string' },
						fulfillmentReference: { type: 'string' }
					}
				},
				PageInput: {
					type: 'object',
					required: ['title', 'document'],
					properties: {
						title: { type: 'string' },
						published: { type: 'boolean' },
						document: {
							type: 'object',
							description:
								'Page document, format version 2: { version: 2, blocks: [{ id, type, props, children?, hide? }] }. Section, Columns and Column blocks hold other blocks in children; version 1 documents are accepted and upgraded.'
						}
					}
				}
			}
		}
	};
}

export const SITE_API_OPERATIONS = OPERATIONS;
