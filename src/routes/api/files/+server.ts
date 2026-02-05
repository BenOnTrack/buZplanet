import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, platform }) => {
	try {
		const prefix = url.searchParams.get('prefix') || '';
		const limit = parseInt(url.searchParams.get('limit') || '1000');

		console.log('=== FILES API DEBUG ===');
		console.log('URL:', url.href);
		console.log('Prefix:', prefix);
		console.log('Limit:', limit);
		console.log('Platform available:', !!platform);
		console.log('Platform.env available:', !!platform?.env);
		console.log('cloudflare_bucket_mbtiles available:', !!platform?.env?.cloudflare_bucket_mbtiles);

		if (!platform?.env?.cloudflare_bucket_mbtiles) {
			throw new Error('R2 bucket binding not available');
		}

		console.log('=== R2 BUCKET ACCESS ===');
		console.log('Attempting to list R2 objects...');
		console.log('Request params - prefix:', prefix, 'limit:', limit);

		const objects = await platform.env.cloudflare_bucket_mbtiles.list({
			prefix,
			limit
		});

		console.log('=== R2 RESPONSE ===');
		console.log('Total objects returned:', objects?.objects?.length || 0);
		console.log('Truncated:', objects?.truncated);

		// Filter for .mbtiles files only
		const mbtilesObjects = objects.objects.filter((obj: any) => {
			const isMbtiles = obj.key.toLowerCase().endsWith('.mbtiles');
			console.log(`File: ${obj.key}, is .mbtiles: ${isMbtiles}`);
			return isMbtiles;
		});

		console.log('=== FILTERING RESULTS ===');
		console.log('Files ending with .mbtiles:', mbtilesObjects.length);

		const files = mbtilesObjects.map((obj: any) => ({
			key: obj.key,
			size: obj.size,
			lastModified: obj.uploaded
		}));

		console.log('=== FINAL RESULT ===');
		console.log('File count:', files.length);

		const responseData = {
			success: true,
			files,
			truncated: objects.truncated,
			totalObjects: objects.objects?.length || 0,
			mbtilesCount: files.length,
			debugInfo: {
				hasR2: true,
				requestPrefix: prefix,
				requestLimit: limit
			}
		};

		return new Response(JSON.stringify(responseData), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		console.error('=== FILES API ERROR ===');
		console.error('Error details:', error);
		console.error('Error message:', error instanceof Error ? error.message : String(error));

		return new Response(
			JSON.stringify({
				error: 'Failed to list files',
				details: error instanceof Error ? error.message : 'Unknown error',
				timestamp: new Date().toISOString()
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
};
