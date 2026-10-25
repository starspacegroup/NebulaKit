/**
 * The emails this site sends, as pure functions.
 *
 * Each returns `{ subject, html, text }` and reads nothing: no database, no
 * env, no fetch. The wording is testable without sending anything, and the
 * code that sends stays about sending.
 *
 * Two house rules are different here than in the rest of the app:
 * - Colours are inlined literals from `emailTheme` (site.config.ts), because
 *   email clients do not resolve CSS custom properties. The templates carry
 *   no hex values themselves.
 * - Layout is tables with inline styles, because Outlook renders with Word's
 *   engine.
 *
 * Every value that came from a person or a database row goes through
 * `escapeHtml`. The plain-text part goes with every email: HTML-only mail
 * scores as spam and some people read mail as text.
 */
import { formatMoney, type Order } from '@nebulakit/commerce';
import { emailTheme, site } from '$lib/site.config';

export type EmailTheme = { readonly [K in keyof typeof emailTheme]: string };

export interface RenderedEmail {
	subject: string;
	html: string;
	text: string;
}

/** Who is sending and how it should look. Defaults come from site.config. */
export interface EmailContext {
	theme?: EmailTheme;
	siteName?: string;
	siteUrl?: string;
}

export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/** Only http(s) links are ever put in an href; anything else is dropped. */
function safeHref(value: string): string | null {
	try {
		const url = new URL(value);
		return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
	} catch {
		return null;
	}
}

interface Resolved {
	theme: EmailTheme;
	siteName: string;
	siteUrl: string;
}

function resolve(ctx: EmailContext): Resolved {
	return {
		theme: ctx.theme ?? emailTheme,
		siteName: ctx.siteName ?? site.name,
		siteUrl: ctx.siteUrl ?? site.url
	};
}

interface LayoutParts {
	preheader: string;
	heading: string;
	/** Already-escaped HTML blocks. */
	body: string;
	cta?: { label: string; href: string };
}

function layout(ctx: Resolved, { preheader, heading, body, cta }: LayoutParts): string {
	const { theme, siteName, siteUrl } = ctx;
	const href = cta ? safeHref(cta.href) : null;
	const button =
		cta && href
			? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 4px"><tr><td style="background:${theme.accent};border-radius:6px"><a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 24px;color:${theme.onAccent};font-weight:600;font-size:15px;text-decoration:none">${escapeHtml(cta.label)}</a></td></tr></table>`
			: '';
	return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:0;background:${theme.background};font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:${theme.text}">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${theme.background}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${theme.surface};border-radius:8px;overflow:hidden">
<tr><td style="background:${theme.accent};padding:18px 28px;color:${theme.onAccent};font-size:18px;font-weight:700">${escapeHtml(siteName)}</td></tr>
<tr><td style="padding:28px;font-size:15px;line-height:1.55">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.25">${escapeHtml(heading)}</h1>
${body}${button}
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid ${theme.border};color:${theme.muted};font-size:12px;line-height:1.5">${escapeHtml(siteName)} &middot; <a href="${escapeHtml(safeHref(siteUrl) ?? '')}" style="color:${theme.muted}">${escapeHtml(siteUrl)}</a><br>You are receiving this because of an order or request made on this site.</td></tr>
</table></td></tr></table></body></html>`;
}

function paragraph(text: string): string {
	return `<p style="margin:0 0 14px">${escapeHtml(text)}</p>`;
}

function orderTable(ctx: Resolved, order: Order): string {
	const { theme } = ctx;
	const cell = `padding:8px 0;border-bottom:1px solid ${theme.border}`;
	const rows = order.items
		.map(
			(item) =>
				`<tr><td style="${cell}">${escapeHtml(item.name)} &times; ${item.quantity}</td><td align="right" style="${cell}">${escapeHtml(formatMoney(item.lineTotalCents, order.currency))}</td></tr>`
		)
		.join('');
	const extra = (label: string, cents: number) =>
		cents > 0
			? `<tr><td style="${cell};color:${theme.muted}">${label}</td><td align="right" style="${cell};color:${theme.muted}">${escapeHtml(formatMoney(cents, order.currency))}</td></tr>`
			: '';
	return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px">${rows}${extra('Shipping', order.shippingCents)}${extra('Tax', order.taxCents)}<tr><td style="padding:10px 0;font-weight:700">Total</td><td align="right" style="padding:10px 0;font-weight:700">${escapeHtml(formatMoney(order.totalCents, order.currency))}</td></tr></table>`;
}

function orderLines(order: Order): string[] {
	const lines = order.items.map(
		(item) => `${item.name} x ${item.quantity}  ${formatMoney(item.lineTotalCents, order.currency)}`
	);
	if (order.shippingCents > 0)
		lines.push(`Shipping  ${formatMoney(order.shippingCents, order.currency)}`);
	if (order.taxCents > 0) lines.push(`Tax  ${formatMoney(order.taxCents, order.currency)}`);
	lines.push(`Total  ${formatMoney(order.totalCents, order.currency)}`);
	return lines;
}

/** Order references are shown short; the full id is in the log. */
export function shortOrderRef(orderId: string): string {
	return orderId.replace(/-/g, '').slice(0, 8).toUpperCase();
}

/** Sent once, when an order becomes paid. */
export function orderReceipt(order: Order, context: EmailContext = {}): RenderedEmail {
	const ctx = resolve(context);
	const ref = shortOrderRef(order.id);
	const subject = `Your ${ctx.siteName} receipt (order ${ref})`;
	const intro = `Thank you. We received your payment for order ${ref}.`;
	const html = layout(ctx, {
		preheader: intro,
		heading: 'Thank you for your order',
		body: paragraph(intro) + orderTable(ctx, order)
	});
	const text = [intro, '', ...orderLines(order), '', `${ctx.siteName} ${ctx.siteUrl}`].join('\n');
	return { subject, html, text };
}

export interface ShippedDetails {
	/** A tracking link; only http(s) links are used. */
	trackingUrl?: string | null;
	/** A carrier reference or tracking number, shown as text. */
	reference?: string | null;
}

/** Sent when an order is marked shipped. */
export function orderShipped(
	order: Order,
	details: ShippedDetails = {},
	context: EmailContext = {}
): RenderedEmail {
	const ctx = resolve(context);
	const ref = shortOrderRef(order.id);
	const subject = `Your ${ctx.siteName} order ${ref} has shipped`;
	const intro = `Order ${ref} is on its way.`;
	const parts = [paragraph(intro)];
	const textLines = [intro];
	if (details.reference) {
		parts.push(paragraph(`Tracking reference: ${details.reference}`));
		textLines.push(`Tracking reference: ${details.reference}`);
	}
	const href = details.trackingUrl ? safeHref(details.trackingUrl) : null;
	if (href) textLines.push(`Track it: ${href}`);
	const html = layout(ctx, {
		preheader: intro,
		heading: 'Your order has shipped',
		body: parts.join('') + orderTable(ctx, order),
		cta: href ? { label: 'Track your order', href } : undefined
	});
	return { subject, html, text: [...textLines, '', ...orderLines(order)].join('\n') };
}

export interface NoticeContent {
	subject: string;
	heading: string;
	/** Plain paragraphs; escaped here. */
	paragraphs: string[];
	cta?: { label: string; href: string };
}

/**
 * A generic message: a heading, some paragraphs and an optional button.
 * Enough for a password reset or "your account changed" without a new
 * template each time.
 */
export function notice(content: NoticeContent, context: EmailContext = {}): RenderedEmail {
	const ctx = resolve(context);
	const href = content.cta ? safeHref(content.cta.href) : null;
	const html = layout(ctx, {
		preheader: content.paragraphs[0] ?? content.heading,
		heading: content.heading,
		body: content.paragraphs.map((p) => paragraph(p)).join(''),
		cta: content.cta && href ? { label: content.cta.label, href } : undefined
	});
	const text = [
		content.heading,
		'',
		...content.paragraphs,
		...(content.cta && href ? ['', `${content.cta.label}: ${href}`] : []),
		'',
		`${ctx.siteName} ${ctx.siteUrl}`
	].join('\n');
	return { subject: content.subject, html, text };
}
