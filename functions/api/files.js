/**
 * Cloudflare Function to list files from R2
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
					success: false,
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
		const prefix = url.searchParams.get('prefix') || '';
		const limit = parseInt(url.searchParams.get('limit') || '100');

		// List objects from R2
		const objects = await env.cloudflare_bucket_mbtiles.list({
			prefix,
			limit
		});

		const files = objects.objects.map((obj) => ({
			key: obj.key,
			size: obj.size,
			lastModified: obj.uploaded || obj.modified
		}));

		return new Response(
			JSON.stringify({
				success: true,
				files,
				truncated: objects.truncated
			}),
			{
				status: 200,
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'GET, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type'
				}
			}
		);
	} catch (error) {
		console.error('R2 list error:', error);
		return new Response(
			JSON.stringify({
				success: false,
				error: 'Failed to list files',
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
