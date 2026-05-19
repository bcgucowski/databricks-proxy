const https = require('https');
const http  = require('http');

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204); res.end(); return;
  }
  if (req.method === 'GET') {
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({status:'Databricks proxy running on Railway'})); return;
  }
  if (req.method !== 'POST') {
    res.writeHead(405); res.end('Method Not Allowed'); return;
  }

  // Read body
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { host, token, sql, path, warehouse_id, catalog, schema } = JSON.parse(body);
      if (!host || !token || !sql) {
        res.writeHead(400, {'Content-Type':'application/json'});
        res.end(JSON.stringify({error:'Missing: host, token, sql'})); return;
      }

      const wh_id = warehouse_id || (path ? path.split('/').pop() : '');
      const payload = JSON.stringify({
        statement: sql, warehouse_id: wh_id,
        catalog: catalog||'qa_wb', schema: schema||'saasfactory',
        wait_timeout: '30s', on_wait_timeout: 'CANCEL',
        disposition: 'INLINE', format: 'JSON_ARRAY',
      });

      const options = {
        hostname: host, path: '/api/2.0/sql/statements',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        }
      };

      const dbReq = https.request(options, (dbRes) => {
        let data = '';
        dbRes.on('data', c => data += c);
        dbRes.on('end', () => {
          res.writeHead(dbRes.statusCode, {'Content-Type':'application/json'});
          res.end(data);
        });
      });
      dbReq.on('error', e => {
        res.writeHead(500, {'Content-Type':'application/json'});
        res.end(JSON.stringify({error: e.message}));
      });
      dbReq.write(payload);
      dbReq.end();

    } catch(e) {
      res.writeHead(500, {'Content-Type':'application/json'});
      res.end(JSON.stringify({error: e.message}));
    }
  });
});

server.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
