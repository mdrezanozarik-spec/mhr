import http from "http";

const TARGET_BASE = (process.env.TARGET_DOMAIN || "").replace(/\/$/, "");

const STRIP_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "forwarded",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
]);

http.createServer(async (req, res) => {
  if (!TARGET_BASE) {
    res.writeHead(500);
    return res.end("Misconfigured: TARGET_DOMAIN is not set");
  }

  try {
    const targetUrl = TARGET_BASE + req.url;

    const headers = {};
    let clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    for (const key in req.headers) {
      const k = key.toLowerCase();
      if (STRIP_HEADERS.has(k)) continue;

      headers[k] = req.headers[key];
    }

    headers["x-forwarded-for"] = clientIp;

    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : req,
    });

    res.writeHead(upstream.status, Object.fromEntries(upstream.headers));
    upstream.body.pipe(res);
  } catch (err) {
    res.writeHead(502);
    res.end("Bad Gateway: Relay Failed");
  }
}).listen(8080);