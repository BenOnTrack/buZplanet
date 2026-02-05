/**
 * Debug endpoint to check R2 binding and environment
 */

export async function onRequestGet(context) {
	const { request, env } = context;

	try {
		const debugInfo = {
			timestamp: new Date().toISOString(),
			environment: {
				hasR2Binding: !!env.cloudflare_bucket_mbtiles,
				availableBindings: Object.keys(env),
				requestUrl: request.url,
				method: request.method
			},
			r2Test: null
		};

		if (env.cloudflare_bucket_mbtiles) {
			try {
				// Try to list one object to test R2 connectivity
				const testList = await env.cloudflare_bucket_mbtiles.list({ limit: 1 });
				debugInfo.r2Test = {
					success: true,
					objectCount: testList.objects.length,
					truncated: testList.truncated,
					firstObjectKey: testList.objects[0]?.key || null
				};
			} catch (r2Error) {
				debugInfo.r2Test = {
					success: false,
					error: r2Error.message
				};
			}
		}

		return new Response(JSON.stringify(debugInfo, null, 2), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Methods': 'GET, OPTIONS',
				'Access-Control-Allow-Headers': 'Content-Type'
			}
		});
	} catch (error) {
		return new Response(
			JSON.stringify({
				error: 'Debug endpoint failed',
				details: error.message,
				timestamp: new Date().toISOString()
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
