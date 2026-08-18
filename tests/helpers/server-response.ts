import { Response as UndiciResponse } from 'undici';

// happy-dom correctly hides Set-Cookie from browser JavaScript. Route-handler
// tests run on the server side and need the raw header, so those suites import
// this helper to opt into Undici's server Response implementation.
Object.defineProperty(globalThis, 'Response', {
	configurable: true,
	writable: true,
	value: UndiciResponse
});
