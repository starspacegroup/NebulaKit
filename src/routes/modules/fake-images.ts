/**
 * Placeholder pictures for the module demos. Inline SVG data URIs, so nothing
 * is fetched, drawn at the 4:3 ratio the product components crop to so a real
 * photo swaps in without the layout moving.
 */
export type Scene = 'mug' | 'tote' | 'box' | 'top' | 'side' | 'front';

const SHAPES: Record<Scene, string> = {
	mug: '<path d="M130 110h120v100a30 30 0 0 1-30 30h-60a30 30 0 0 1-30-30z" fill="#fff"/><path d="M250 130h20a25 25 0 0 1 0 50h-20" fill="none" stroke="#fff" stroke-width="14"/><ellipse cx="190" cy="110" rx="60" ry="10" fill="#0003"/>',
	front: '<path d="M130 110h120v100a30 30 0 0 1-30 30h-60a30 30 0 0 1-30-30z" fill="#fff"/><path d="M250 130h20a25 25 0 0 1 0 50h-20" fill="none" stroke="#fff" stroke-width="14"/><ellipse cx="190" cy="110" rx="60" ry="10" fill="#0003"/>',
	side: '<path d="M110 120h130v90a30 30 0 0 1-30 30h-70a30 30 0 0 1-30-30z" fill="#fff"/><path d="M240 140h40a25 25 0 0 1 0 50h-40" fill="none" stroke="#fff" stroke-width="14"/>',
	top: '<circle cx="200" cy="150" r="80" fill="#fff"/><circle cx="200" cy="150" r="62" fill="#0004"/><path d="M280 150h40" stroke="#fff" stroke-width="14" stroke-linecap="round"/>',
	tote: '<path d="M140 120h120l12 130H128z" fill="#fff"/><path d="M165 120v-25a35 35 0 0 1 70 0v25" fill="none" stroke="#fff" stroke-width="12"/>',
	box: '<path d="M110 120l90-35 90 35v110l-90 35-90-35z" fill="#fff"/><path d="M110 120l90 35 90-35M200 155v110" fill="none" stroke="#0004" stroke-width="8"/>'
};

/** A 400x300 picture: a tinted gradient with a simple drawn subject. */
export function picture(scene: Scene, hue: number): string {
	const svg =
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">` +
		`<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
		`<stop offset="0" stop-color="hsl(${hue} 55% 68%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360} 50% 42%)"/>` +
		`</linearGradient></defs><rect width="400" height="300" fill="url(#g)"/>` +
		`<ellipse cx="200" cy="262" rx="100" ry="10" fill="#0003"/>${SHAPES[scene]}</svg>`;
	return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** A square avatar with initials, for people in the demos. */
export function avatar(name: string, hue: number): string {
	const initials = name
		.split(/\s+/)
		.map((w) => w[0])
		.slice(0, 2)
		.join('')
		.toUpperCase();
	const svg =
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="hsl(${hue} 50% 45%)"/>` +
		`<text x="48" y="60" font-size="36" text-anchor="middle" fill="#fff" font-family="sans-serif" font-weight="600">${initials}</text></svg>`;
	return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
