/**
 * Test-environment shims for the module suites. Import this file for its side
 * effects. Each shim checks first whether the DOM already behaves, so it does
 * nothing on a newer happy-dom and a real browser never loads it.
 *
 * happy-dom 12 (the site) differs from happy-dom 20 (the template) in two ways
 * these suites hit:
 *  - `querySelector(':checked')` finds no selected <option>. Svelte 4 reads a
 *    bound <select> that way, so a change event left its value undefined.
 *  - `history.replaceState(…, '#x')` does not update `location.hash`.
 */

function supportsOptionChecked(): boolean {
	const probe = document.createElement('select');
	probe.innerHTML = '<option value="a">A</option><option value="b">B</option>';
	probe.options[1].selected = true;
	return probe.querySelector(':checked') === probe.options[1];
}

if (!supportsOptionChecked()) {
	const proto = HTMLSelectElement.prototype;
	const one = proto.querySelector;
	const all = proto.querySelectorAll;
	proto.querySelector = function (this: HTMLSelectElement, selector: string) {
		if (selector === ':checked') return Array.from(this.options).find((o) => o.selected) ?? null;
		return one.call(this, selector);
	} as typeof proto.querySelector;
	proto.querySelectorAll = function (this: HTMLSelectElement, selector: string) {
		if (selector === ':checked') {
			return Array.from(this.options).filter((o) => o.selected) as unknown as NodeListOf<Element>;
		}
		return all.call(this, selector);
	} as typeof proto.querySelectorAll;
}

function historyUpdatesHash(): boolean {
	const before = location.href;
	history.replaceState(null, '', '#probe');
	const ok = location.hash === '#probe';
	history.replaceState(null, '', before);
	return ok;
}

if (!historyUpdatesHash()) {
	for (const method of ['replaceState', 'pushState'] as const) {
		const original = history[method].bind(history);
		history[method] = (state: unknown, title: string, url?: string | URL | null) => {
			original(state, title, url);
			const hash = url == null ? null : new URL(String(url), location.href).hash;
			if (hash !== null && location.hash !== hash) location.hash = hash;
		};
	}
}
