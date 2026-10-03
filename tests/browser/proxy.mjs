// Local test-only proxy. No real credentials or production endpoints.
import http from 'node:http';
http.createServer((request, response) => {
  response.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:4174');
  response.setHeader('Access-Control-Allow-Headers', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  response.setHeader('Access-Control-Expose-Headers', 'Content-Range');
  if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return; }
  if (!request.url.startsWith('/rest/v1/')) { response.writeHead(404); response.end(); return; }
  const headers = { ...request.headers }; delete headers.authorization; delete headers.apikey; delete headers.host;
  const upstream = http.request({ hostname: '127.0.0.1', port: 56433, path: request.url.slice('/rest/v1'.length), method: request.method, headers }, (incoming) => {
    response.statusCode = incoming.statusCode;
    for (const name of ['content-type', 'content-range', 'preference-applied']) if (incoming.headers[name]) response.setHeader(name, incoming.headers[name]);
    incoming.pipe(response);
  });
  upstream.on('error', (error) => { response.writeHead(502); response.end(error.message); });
  request.pipe(upstream);
}).listen(56434, '127.0.0.1', () => console.log('TQA fixture proxy: localhost:56434'));
