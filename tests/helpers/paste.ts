import { fireEvent } from '@testing-library/svelte';

/**
 * Paste text into a field the way a browser reports it: a cancelable
 * `beforeinput` of type `insertFromPaste`, carrying the text in `data`. (A
 * `paste` listener that calls preventDefault is what Lighthouse's
 * "prevents pasting" audit flags, so the OTP cells do not use one.)
 */
export function pasteInto(el: Element, text: string | null) {
	return fireEvent(
		el,
		new InputEvent('beforeinput', {
			inputType: 'insertFromPaste',
			data: text,
			bubbles: true,
			cancelable: true
		})
	);
}
