'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const { createReadStream } = require('node:fs');
const data = require('./assets/data.js');
const { ChatError, validateMessages, generateReply, createLimiter } = require('./server/chat.js');

const ROOT = __dirname;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.webm': 'video/webm', '.ico': 'image/x-icon',
};
const readBody = (req) => new Promise((resolve, reject) => {
  let size = 0;
  const chunks = [];
  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > 32768) { chunks.length = 0; reject(new ChatError(413, 'TOO_LARGE', 'The request is too large.')); }
    else chunks.push(chunk);
  });
  req.on('end', () => {
    if (size > 32768) return;
    try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
    catch { reject(new ChatError(400, 'INVALID_JSON', 'Send a valid JSON request.')); }
  });
  req.on('error', reject);
});

const createPortfolioServer = (options = {}) => {
  const port = Number(options.port ?? process.env.PORT ?? 8787);
  const allowedOrigins = new Set((options.allowedOrigins ?? process.env.ALLOWED_ORIGINS ?? `http://localhost:${port},http://127.0.0.1:${port}`).split(',').map((origin) => origin.trim()).filter(Boolean));
  const apiKey = Object.hasOwn(options, 'apiKey') ? options.apiKey : process.env.GEMINI_API_KEY;
  const model = options.model ?? process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite';
  const dailyLimit = Number(options.dailyLimit ?? process.env.DAILY_CHAT_LIMIT ?? 100);
  if (!Number.isInteger(dailyLimit) || dailyLimit < 1) throw new Error('DAILY_CHAT_LIMIT must be a positive integer.');
  const allow = createLimiter({ dailyLimit });
  let active = 0;
  const server = http.createServer(async (req, res) => {
    const json = (status, body) => {
      if (!res.destroyed && !res.writableEnded) {
        res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        res.end(JSON.stringify(body));
      }
    };
    try {
      const url = new URL(req.url, 'http://portfolio.local');
      if (url.pathname === '/api/chat') {
        const origin = req.headers.origin;
        if (!origin || !allowedOrigins.has(origin)) throw new ChatError(403, 'ORIGIN_DENIED', 'This origin is not allowed.');
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        if (req.method === 'OPTIONS') {
          res.writeHead(204, { 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' });
          res.end();
          return;
        }
        if (req.method !== 'POST') { res.setHeader('Allow', 'POST, OPTIONS'); throw new ChatError(405, 'METHOD_NOT_ALLOWED', 'Use POST.'); }
        if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw new ChatError(415, 'INVALID_CONTENT_TYPE', 'Use application/json.');
        if (!apiKey) throw new ChatError(503, 'NOT_CONFIGURED', 'Live chat is not connected yet.');
        const messages = validateMessages(await readBody(req));
        if (active >= 3 || !allow(req.socket.remoteAddress)) {
          res.setHeader('Retry-After', '60');
          throw new ChatError(429, 'RATE_LIMIT', 'Chat is busy. Please try again later.');
        }
        active += 1;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000);
        const disconnect = () => { if (!res.writableEnded) controller.abort(); };
        res.on('close', disconnect);
        try {
          const reply = await generateReply({ messages, data, apiKey, model, fetchImpl: options.fetchImpl, signal: controller.signal });
          json(200, { reply });
        } finally {
          clearTimeout(timeout);
          res.off('close', disconnect);
          active -= 1;
        }
        return;
      }
      if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); throw new ChatError(405, 'METHOD_NOT_ALLOWED', 'Use GET or HEAD.'); }
      // Serve only the files published by GitHub Pages; never .env or server code.
      let name;
      try { name = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html'; } catch { throw new ChatError(400, 'INVALID_PATH', 'Invalid path.'); }
      const publicFile = ['index.html', 'style.css', 'script.js'].includes(name) || /^assets\/(?:[\w-]+\/)*[\w-][\w.-]*$/.test(name);
      if (!publicFile || !MIME[path.extname(name).toLowerCase()]) throw new ChatError(404, 'NOT_FOUND', 'Not found.');
      const file = await fs.realpath(path.join(ROOT, name));
      if (file !== path.join(ROOT, name)) throw new ChatError(404, 'NOT_FOUND', 'Not found.');
      const stat = await fs.stat(file);
      if (!stat.isFile()) throw new ChatError(404, 'NOT_FOUND', 'Not found.');
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()], 'Content-Length': stat.size, 'X-Content-Type-Options': 'nosniff' });
      if (req.method === 'HEAD') res.end();
      else await pipeline(createReadStream(file), res);
    } catch (error) {
      if (res.headersSent) { res.destroy(); return; }
      const status = error instanceof ChatError ? error.status : error.code === 'ENOENT' ? 404 : 500;
      json(status, { code: error instanceof ChatError ? error.code : status === 404 ? 'NOT_FOUND' : 'SERVER_ERROR', error: error instanceof ChatError ? error.message : status === 404 ? 'Not found.' : 'Chat is unavailable. Please try again.' });
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return server;
};

if (require.main === module) {
  const port = Number(process.env.PORT || 8787);
  const host = process.env.HOST || '127.0.0.1';
  const server = createPortfolioServer({ port });
  server.on('error', (error) => { console.error(`Server could not start (${error.code || 'unknown error'}).`); process.exitCode = 1; });
  server.listen(port, host, () => console.log(`Portfolio: http://${host}:${port}\nGemini: ${process.env.GEMINI_API_KEY ? 'configured' : 'add GEMINI_API_KEY to .env to enable chat'}`));
}

module.exports = { createPortfolioServer };
