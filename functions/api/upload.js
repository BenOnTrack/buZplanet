/**
 * Cloudflare Function to handle file uploads to R2
 * This runs server-side and keeps credentials secure
 */

export async function onRequestPost(context) {
	const { request, env } = context;

	try {
		// Get the file from the request
		const formData = await request.formData();
		const file = formData.get('file');

		if (!file) {
			return new Response(JSON.stringify({ error: 'No file provided' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Generate a unique filename
		const fileName = `uploads/${Date.now()}-${file.name}`;

		// Upload to R2 using the binding from wrangler.toml
		await env.cloudflare_bucket_mbtiles.put(fileName, file);

		return new Response(
			JSON.stringify({
				success: true,
				fileName,
				message: 'File uploaded successfully'
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	} catch (error) {
		console.error('Upload error:', error);
		return new Response(
			JSON.stringify({
				error: 'Upload failed',
				details: error.message
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
}
