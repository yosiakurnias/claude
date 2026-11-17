// Serves ../../index.html with a stubbed window.claude (stub.js) and the test file injected.
// Usage: node tests/harness/server.js [port]   then open http://127.0.0.1:<port>/ and run `await runTests()` in the console.
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const PORT = +(process.argv[2] || 8765);
http.createServer((req, res) => {
  const u = req.url.split("?")[0];
  const file = u === "/stub.js" ? path.join(__dirname, "stub.js") : u === "/phase1.test.js" ? path.join(ROOT, "tests", "phase1.test.js") : null;
  if (file){ res.writeHead(200, {"content-type":"text/javascript", "cache-control":"no-store"}); return res.end(fs.readFileSync(file)); }
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8").replace("<head>", '<head><script src="/stub.js"></script>').replace("</body>", '<script src="/phase1.test.js"></script></body>');
  res.writeHead(200, {"content-type":"text/html; charset=utf-8", "cache-control":"no-store"}); res.end(html);
}).listen(PORT, "127.0.0.1", () => console.log("harness on http://127.0.0.1:" + PORT));
