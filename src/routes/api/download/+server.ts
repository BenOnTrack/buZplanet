import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, platform }) => {
	try {
		const fileName = url.searchParams.get('file');

		if (!fileName) {
			return new Response(JSON.stringify({ error: 'No file specified' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Check if R2 bucket is available
		if (!platform?.env?.cloudflare_bucket_mbtiles) {
			return new Response(JSON.stringify({ error: 'R2 bucket not available' }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		try {
			const object = await platform.env.cloudflare_bucket_mbtiles.get(fileName);

			if (!object) {
				return new Response(JSON.stringify({ error: 'File not found' }), {
					status: 404,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			return new Response(object.body, {
				headers: {
					'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
					'Content-Length': object.size.toString(),
					'Cache-Control': 'public, max-age=31536000',
					ETag: object.httpEtag || ''
				}
			});
		} catch (error) {
			console.error('R2 download error:', error);
			return new Response(
				JSON.stringify({
					error: 'Failed to download file',
					details: error instanceof Error ? error.message : 'Unknown error'
				}),
				{
					status: 500,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}
	} catch (error) {
		console.error('Download error:', error);
		return new Response(
			JSON.stringify({
				error: 'Download failed',
				details: error instanceof Error ? error.message : 'Unknown error'
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
};
