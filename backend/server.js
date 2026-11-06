const http = require("node:http");

const port = Number.parseInt(process.env.PORT || "3000", 10);

const server = http.createServer((request, response) => {
  response.setHeader("Content-Type", "application/json");

  if (request.url === "/health") {
    response.writeHead(200);
    response.end(JSON.stringify({ status: "ok", service: "backend" }));
    return;
  }

  response.writeHead(200);
  response.end(JSON.stringify({ service: "etiquete-backend" }));
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Backend listening on port ${port}`);
});
