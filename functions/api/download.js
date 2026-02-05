/**
 * Cloudflare Function to get/download files from R2
 * This runs server-side and keeps credentials secure
 */

export async function onRequestGet(context) {
	const { request, env } = context;

	try {
		// Check if R2 binding is available
		if (!env.cloudflare_bucket_mbtiles) {
			console.error('R2 bucket binding not found. Available env keys:', Object.keys(env));
			return new Response(
				JSON.stringify({
					error: 'R2 storage not configured',
					details: 'The cloudflare_bucket_mbtiles binding is not available'
				}),
				{
					status: 500,
					headers: {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*'
					}
				}
			);
		}

		const url = new URL(request.url);
		const fileName = url.searchParams.get('file');

		if (!fileName) {
			return new Response(JSON.stringify({ error: 'No file specified' }), {
				status: 400,
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*'
				}
			});
		}

		// Get the file from R2
		const object = await env.cloudflare_bucket_mbtiles.get(fileName);

		if (!object) {
			return new Response(JSON.stringify({ error: 'File not found' }), {
				status: 404,
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*'
				}
			});
		}

		// Return the file with appropriate headers
		return new Response(object.body, {
			headers: {
				'Content-Type': object.httpMetadata?.contentType || 'application/x-sqlite3',
				'Content-Length': object.size.toString(),
				'Cache-Control': 'public, max-age=31536000', // 1 year cache
				ETag: object.httpEtag || object.etag,
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Methods': 'GET, OPTIONS',
				'Access-Control-Allow-Headers': 'Content-Type'
			}
		});
	} catch (error) {
		console.error('Download error:', error);
		return new Response(
			JSON.stringify({
				error: 'Download failed',
				details: error.message
			}),
			{
				status: 500,
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*'
				}
			}
		);
	}
}

// Handle CORS preflight
export async function onRequestOptions() {
	return new Response(null, {
		status: 200,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type'
		}
	});
}
