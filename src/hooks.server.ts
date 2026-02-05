import type { Handle } from '@sveltejs/kit';
import { paraglideMiddleware } from '$lib/paraglide/server';

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;

		return resolve(event, {
			transformPageChunk: ({ html }) => html.replace('%paraglide.lang%', locale)
		});
	});

export const handle: Handle = async ({ event, resolve }) => {
	const response = await handleParaglide({ event, resolve });

	// Set Cross-Origin headers
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
	response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');

	return response;
};
