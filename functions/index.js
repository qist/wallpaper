// Cloudflare Pages Functions: 访问站点根路径随机返回一张图片
// 部署时整个仓库推到 CF Pages，根路由由本函数处理 (见 _routes.json)
// 本地图通过 fetch 自身站点 /img/* 资产获取；远程图代理转发 Bing / Picsum
// 核心算法 (choosePool / isUrlSafe) 与本地 server.js 的 wallpaper.js 保持一致

// 内容安全: 远程图 URL 黑名单
const BLOCKLIST = [
  "nsfw", "porn", "sex", "xxx", "adult", "nude", "escort",
  "casino", "bet", "gambling", "pornhub", "xvideos",
  "drug", "cocaine", "meth", "weed", "marijuana", "heroin",
];
function isUrlSafe(url) {
  const lower = url.toLowerCase();
  return !BLOCKLIST.some((w) => lower.includes(w));
}

// 本地图清单 (与 img/ 目录保持一致)。CF 无法用 fs 列举，需手动维护或构建生成。
const LOCAL_IMAGES = [
  "/img/12.jpg",
  "/img/14151005_1341adf892.jpeg",
  "/img/14151005_260979b93c.jpeg",
  "/img/14151005_4257e6f5ac.jpeg",
  "/img/14151005_85e12b98cb.jpeg",
  "/img/14151005_92be54509f.jpeg",
  "/img/14151005_d65ac1035e.jpeg",
  "/img/14151005_e6a7dc9c2c.jpeg",
  "/img/14151005_efb60489d2.jpeg",
  "/img/14151005_fe3b5f4ef4.jpeg",
  "/img/16114717_4ba9925692.jpeg",
  "/img/16114717_924075523a.jpeg",
  "/img/16114717_a8a9f4a58a.jpeg",
  "/img/16114718_5deb457d4b.jpeg",
  "/img/16114718_bafc46399a.jpeg",
  "/img/16114719_d0d6fb2158.jpeg",
  "/img/16114720_c2d0fe0df7.jpeg",
  "/img/22083132_414b9744ee.jpeg",
  "/img/22083132_6e44a600d0.jpeg",
  "/img/22083132_d39508502e.jpeg",
  "/img/22083133_3d5b49aa82.jpeg",
  "/img/234.jpg",
  "/img/240c1522b9a0fa59d24f49a3da07c014.jpg",
  "/img/3344.jpg",
  "/img/34.jpg",
  "/img/453.jpg",
  "/img/54.jpg",
  "/img/542.jpg",
  "/img/553.jpg",
  "/img/657.jpg",
  "/img/87.jpg",
  "/img/9bda7040ac1cf848aefa5b6e0928fa2a.jpg",
  "/img/a2bda8cb160e318915025e25790b09db.jpeg",
  "/img/pexels-jplenio-1776268.jpg",
  "/img/rewe.jpg",
];

// 获取 Bing 近 N 天图片 URL
async function getBingUrls(n = 7) {
  const api = `https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=${n}&mkt=zh-CN`;
  try {
    const r = await fetch(api);
    const json = await r.json();
    return json.images.map((img) => "https://www.bing.com" + img.url);
  } catch (e) {
    return [];
  }
}

// 生成 Picsum 随机图 URL
function getPicsumUrls(count = 5) {
  const urls = [];
  for (let i = 0; i < count; i++) {
    urls.push(`https://picsum.photos/1920/1080?random=${Math.floor(Math.random() * 1e9)}`);
  }
  return urls;
}

// 组装候选池: 远程 (Bing+Picsum, 安全过滤) + 本地图
async function buildPool() {
  const [bing] = await Promise.all([getBingUrls(7)]);
  const remote = [...bing, ...getPicsumUrls(5)].filter(isUrlSafe);
  return [...remote, ...LOCAL_IMAGES];
}

// 随机抽一张，尽量避免与上次相同 (用全局缓存避免连续重复)
let lastPick = null;
function pickOne(pool) {
  if (pool.length === 0) return null;
  let pick;
  do {
    pick = pool[Math.floor(Math.random() * pool.length)];
  } while (pool.length > 1 && pick === lastPick);
  lastPick = pick;
  return pick;
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  if (url.pathname !== "/" && url.pathname !== "") {
    // 非根路径交给静态资源处理，本函数不拦截
    return context.next ? context.next() : fetch(request);
  }

  const pool = await buildPool();
  const pick = pickOne(pool);
  if (!pick) {
    return new Response("没有可用图片。", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  // 远程图: 代理转发
  if (pick.startsWith("http")) {
    try {
      const r = await fetch(pick, { redirect: "follow" });
      if (!r.ok || !r.headers.get("content-type")?.startsWith("image/")) {
        throw new Error("invalid remote image");
      }
      return new Response(r.body, {
        status: 200,
        headers: {
          "content-type": r.headers.get("content-type") || "image/jpeg",
          "cache-control": "no-store",
        },
      });
    } catch (e) {
      // 远程失败: 退回随机本地图
      const locals = LOCAL_IMAGES.length ? LOCAL_IMAGES : [];
      if (locals.length) {
        const fallback = locals[Math.floor(Math.random() * locals.length)];
        return fetch(new URL(fallback, url.origin).toString());
      }
      return new Response("图片获取失败。", { status: 502, headers: { "content-type": "text/plain; charset=utf-8" } });
    }
  }

  // 本地图: 请求自身站点 /img/* 静态资产
  return fetch(new URL(pick, url.origin).toString());
}
