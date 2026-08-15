// 本地调试用静态服务器，行为等价于原 api.php
// 启动: node server.js  (默认端口 3000, 可用 PORT 环境变量覆盖)
// 核心逻辑见 wallpaper.js (与 CF Pages Functions 共用)
const http = require("http");
const fs = require("fs");
const path = require("path");
const { getRemoteUrls, pickOne } = require("./wallpaper");

const ROOT = __dirname;
const IMG_DIR = path.join(ROOT, "img");
const PORT = process.env.PORT || 3000;
let lastPick = null; // 记录上一次返回的图片，避免连续重复
const DEBUG = process.env.DEBUG === "1"; // 设为 1 才打印访问日志

const MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
};

// 读取 img 下所有图片 (返回相对于 ROOT 的路径，作为本地标识)
function listImages() {
  let files = [];
  try {
    files = fs.readdirSync(IMG_DIR);
  } catch (e) {
    return [];
  }
  return files
    .filter((f) => /\.(jpe?g|png|gif|webp|bmp|avif|svg)$/i.test(f))
    .map((f) => path.join(IMG_DIR, f));
}

function sendImage(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || "application/octet-stream";
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("图片读取失败。");
      return;
    }
    res.writeHead(200, { "Content-Type": mime });
    if (DEBUG) console.log(`[LOCAL] ${mime} ${data.length}B`);
    res.end(data);
  });
}

// 代理转发远程图片，保持直接返回图片流；非图片/异常时回调失败
function sendRemoteImage(res, url, onFail) {
  const https = require("https");
  https
    .get(url, (r) => {
      const ct = r.headers["content-type"] || "";
      if (r.statusCode !== 200 || !ct.startsWith("image/")) {
        r.resume();
        if (onFail) onFail();
        else {
          res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("远程图片获取失败。");
        }
        return;
      }
      res.writeHead(200, { "Content-Type": ct });
      let bytes = 0;
      r.on("data", (c) => (bytes += c.length));
      r.on("end", () => {
        if (DEBUG) console.log(`[REMOTE] ${ct} ${bytes}B`);
      });
      r.pipe(res);
    })
    .on("error", () => {
      if (onFail) onFail();
      else {
        res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("远程图片获取失败。");
      }
    });
}

function sendStatic(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || "text/plain; charset=utf-8";
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found");
      return;
    }
    res.writeHead(200, { "Content-Type": mime });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split("?")[0]);

  // 根路径: 随机返回一张 (Bing + Picsum + 本地图)，刷新即换图
  if (urlPath === "/" || urlPath === "") {
    const images = listImages();
    getRemoteUrls()
      .then((remoteUrls) => {
        const pick = pickOne(remoteUrls, images, lastPick);
        if (!pick) {
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("文件夹中没有图片。");
          return;
        }
        lastPick = pick;

        if (typeof pick === "string" && pick.startsWith("http")) {
          sendRemoteImage(res, pick, () => {
            const rest = images.length ? images : remoteUrls.filter((u) => u !== pick);
            if (rest.length > 0) {
              const fallback = rest[Math.floor(Math.random() * rest.length)];
              if (typeof fallback === "string" && fallback.startsWith("http")) {
                sendRemoteImage(res, fallback);
              } else {
                sendImage(res, fallback);
              }
            } else {
              res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
              res.end("图片获取失败。");
            }
          });
        } else {
          sendImage(res, pick);
        }
      })
      .catch(() => {
        if (images.length === 0) {
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("文件夹中没有图片。");
          return;
        }
        const local = images[Math.floor(Math.random() * images.length)];
        sendImage(res, local);
      });
    return;
  }

  // 其他路径: 静态文件服务 (img/ 等)
  const safePath = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, "");
  const target = path.join(ROOT, safePath);
  if (target.startsWith(ROOT)) {
    sendStatic(res, target);
    return;
  }

  res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Forbidden");
});

server.listen(PORT, "0.0.0.0", () => {
  const os = require("os");
  const nets = os.networkInterfaces();
  const lanIps = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) lanIps.push(net.address);
    }
  }
  console.log(`Server running:`);
  console.log(`  本机:   http://localhost:${PORT}`);
  lanIps.forEach((ip) => console.log(`  局域网: http://${ip}:${PORT}`));
  console.log(`访问 / 随机返回一张图片 (Bing + Picsum + 本地图)`);
  if (DEBUG) console.log(`(DEBUG=1 已开启访问日志)`);
});
