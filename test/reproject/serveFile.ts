import {createReadStream, statSync} from 'node:fs';
import {createServer, type Server} from 'node:http';
import type {AddressInfo} from 'node:net';

/** A minimal static file server with the range requests geotiff.js makes, for tests on real COGs. */
export const serveFile = async (path: string): Promise<{url: string; close: () => void}> => {
  const size = statSync(path).size;
  const server: Server = createServer((request, response) => {
    const range = /bytes=(\d+)-(\d*)/.exec(request.headers.range ?? '');
    if (!range) {
      response.writeHead(200, {'Content-Length': size, 'Accept-Ranges': 'bytes'});
      createReadStream(path).pipe(response);
      return;
    }
    const start = Number(range[1]);
    const end = Math.min(range[2] ? Number(range[2]) : size - 1, size - 1);
    response.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': end - start + 1,
      'Accept-Ranges': 'bytes',
    });
    createReadStream(path, {start, end}).pipe(response);
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  return {url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/cog.tif`, close: () => server.close()};
};
