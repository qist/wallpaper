// 核心逻辑模块: 本地 (server.js) 与 Cloudflare Pages Functions (functions/index.js) 共用
// 不依赖 http / 平台特定 API，便于复用
const https = require("https");

// ---------- 内容安全: 远程图 URL 黑名单 ----------
const BLOCKLIST = [
  "nsfw", "porn", "sex", "xxx", "adult", "nude", "escort",
  "casino", "bet", "gambling", "pornhub", "xvideos",
  "drug", "cocaine", "meth", "weed", "marijuana", "heroin",
];
function isUrlSafe(url) {
  const lower = url.toLowerCase();
  return !BLOCKLIST.some((w) => lower.includes(w));
}

// ---------- 远程源 ----------

// 获取最近 N 天 Bing 图片完整 URL 列表 (实时)
function getBingUrls(n = 7) {
  return new Promise((resolve, reject) => {
    const api = `https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=${n}&mkt=zh-CN`;
    https
      .get(api, (r) => {
        let body = "";
        r.on("data", (c) => (body += c));
        r.on("end", () => {
          try {
            const json = JSON.parse(body);
            const urls = json.images.map((img) => "https://www.bing.com" + img.url);
            resolve(urls);
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

// 生成 Picsum 随机图 URL 列表 (免 key)
function getPicsumUrls(count = 5) {
  const urls = [];
  for (let i = 0; i < count; i++) {
    urls.push(`https://picsum.photos/1920/1080?random=${Math.floor(Math.random() * 1e9)}`);
  }
  return Promise.resolve(urls);
}

// 并行获取各远程源 URL，单源失败不影响其它；过滤不安全 URL
async function getRemoteUrls() {
  const results = await Promise.allSettled([getBingUrls(7), getPicsumUrls(5)]);
  let pool = [];
  results.forEach((r) => {
    if (r.status === "fulfilled" && Array.isArray(r.value)) {
      pool = pool.concat(r.value.filter(isUrlSafe));
    }
  });
  return pool;
}

// 从合并池中按权重随机抽一张，尽量避免与上次相同
// localImages: 本地图片标识数组 (字符串，平台自定义含义)
function pickOne(remoteUrls, localImages, lastPick) {
  const pool = remoteUrls.concat(localImages);
  if (pool.length === 0) return null;
  let pick;
  do {
    pick = pool[Math.floor(Math.random() * pool.length)];
  } while (pool.length > 1 && pick === lastPick);
  return pick;
}

module.exports = {
  BLOCKLIST,
  isUrlSafe,
  getBingUrls,
  getPicsumUrls,
  getRemoteUrls,
  pickOne,
};
