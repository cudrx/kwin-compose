import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(
      new URL(req.url, 'http://localhost').pathname,
    );
    const file = resolve(
      root,
      '.' + (path === '/' ? '/sandbox/index.html' : path),
    );
    const relative = file.slice(root.length);
    if (
      !file.startsWith(root) ||
      !['sandbox' + sep, 'src' + sep].some((prefix) =>
        relative.startsWith(prefix),
      )
    ) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': types[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});
server.listen(Number(process.env.PORT || 5173), '127.0.0.1', () =>
  console.log('Compose sandbox: http://127.0.0.1:' + server.address().port),
);
