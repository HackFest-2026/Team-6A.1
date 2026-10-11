const http = require('http');
const net = require('net');

const server = http.createServer((req, res) => {
  const clientReq = http.request({
    hostname: '127.0.0.1',
    port: 8080,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: 'localhost:8080',
    },
  }, (clientRes) => {
    res.writeHead(clientRes.statusCode, clientRes.headers);
    clientRes.pipe(res);
  });

  clientReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Bridge Proxy Error: ' + err.message);
  });

  req.pipe(clientReq);
});

server.on('upgrade', (req, socket, head) => {
  const proxySocket = net.connect(8080, '127.0.0.1', () => {
    proxySocket.write(`${req.method} ${req.url} HTTP/1.1\r\n`);
    for (const [key, value] of Object.entries(req.headers)) {
      proxySocket.write(`${key}: ${value}\r\n`);
    }
    proxySocket.write('\r\n');
    if (head && head.length > 0) {
      proxySocket.write(head);
    }
    socket.pipe(proxySocket).pipe(socket);
  });

  proxySocket.on('error', () => {
    socket.destroy();
  });
  socket.on('error', () => {
    proxySocket.destroy();
  });
});

server.listen(3000, '0.0.0.0', () => {
  console.log('Bridge proxy listening on http://localhost:3000 -> forwarding to http://localhost:8080');
});
