import http from 'node:http';

const PORT = 8787;
const HOST = '127.0.0.1';

const server = http.createServer((req, res) => {
	if (req.method !== 'POST' || req.url !== '/api/greet') {
		res.statusCode = 404;
		res.setHeader('content-type', 'application/json');
		res.end(JSON.stringify({ error: 'Not found' }));
		return;
	}

	let body = '';

	req.on('data', (chunk) => {
		body += chunk;
	});

	req.on('end', () => {
		try {
			const parsed = body ? JSON.parse(body) : {};
			const name = typeof parsed.name === 'string' ? parsed.name.trim() || 'world' : 'world';
			const message = `hello ${name}`;

			res.statusCode = 200;
			res.setHeader('content-type', 'application/json');
			res.end(JSON.stringify({ message, runtime: 'local' }));
		} catch {
			res.statusCode = 400;
			res.setHeader('content-type', 'application/json');
			res.end(JSON.stringify({ error: 'Invalid JSON request body' }));
		}
	});
});

server.listen(PORT, HOST, () => {
	console.log(`Local API running at http://${HOST}:${PORT}`);
});
