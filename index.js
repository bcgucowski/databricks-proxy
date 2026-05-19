const https = require('https');
const http  = require('http');

const PORT = process.env.PORT || 3000;

// CORS headers aplicados em TODA resposta
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const server = http.createServer(async (req, res) => {

  // Preflight OPTIONS — responde imediatamente com CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  // Health check
  if (req.method === 'GET') {
    res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'Databricks proxy running on Render' }));
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, CORS);
    res.end('Method Not Allowed');
    return;
  }

  // Read body
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      const { host, token, sql, path, warehouse_id, catalog, schema } = JSON.parse(body);

      if (!host || !token || !sql) {
        res.writeHead(400, { ...CORS, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing: host, token, sql' }));
        return;
      }

      const wh_id = warehouse_id || (path ? path.split('/').pop() : '');
      const payload = JSON.stringify({
        statement:        sql,
        warehouse_id:     wh_id,
        catalog:          catalog  || 'qa_wb',
        schema:           schema   || 'saasfactory',
        wait_timeout:     '50s',
        on_wait_timeout:  'CANCEL',
        disposition:      'INLINE',
        format:           'JSON_ARRAY',
      });

      const options = {
        hostname: host,
        path:     '/api/2.0/sql/statements',
        method:   'POST',
        headers: {
          'Authorization':  `Bearer ${token}`,
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      };

      const dbReq = https.request(options, (dbRes) => {
        let data = '';
        dbRes.on('data', c => data += c);
        dbRes.on('end', () => {
          try {
            const parsed = JSON.parse(data);

            // Databricks returns status object — poll if PENDING
            if (parsed.status && parsed.status.state === 'PENDING') {
              res.writeHead(202, { ...CORS, 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Query still running — try again or increase wait_timeout' }));
              return;
            }

            // Extract result into simple {cols, rows} format
            if (parsed.result && parsed.manifest) {
              const cols = parsed.manifest.schema.columns.map(c => c.name);
              const rawRows = parsed.result.data_array || [];
              const rows = rawRows.map(r => {
                const obj = {};
                cols.forEach((c, i) => { obj[c] = r[i]; });
                return obj;
              });
              res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ cols, rows }));
              return;
            }

            // Error from Databricks
            if (parsed.error || (parsed.status && parsed.status.state === 'FAILED')) {
              const msg = (parsed.status && parsed.status.error && parsed.status.error.message)
                || parsed.error || 'Databricks query failed';
              res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: msg }));
              return;
            }

            // Fallback — pass through with CORS
            res.writeHead(dbRes.statusCode, { ...CORS, 'Content-Type': 'application/json' });
            res.end(data);

          } catch (parseErr) {
            res.writeHead(500, { ...CORS, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to parse Databricks response: ' + parseErr.message }));
          }
        });
      });

      dbReq.on('error', e => {
        res.writeHead(502, { ...CORS, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Proxy network error: ' + e.message }));
      });

      dbReq.write(payload);
      dbReq.end();

    } catch (e) {
      res.writeHead(500, { ...CORS, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Proxy error: ' + e.message }));
    }
  });
});

server.listen(PORT, () => console.log(`Databricks proxy running on port ${PORT}`));
