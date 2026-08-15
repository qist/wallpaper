# 随机壁纸服务 部署文档

访问站点根路径（`/`）即随机返回一张图片，刷新换图。图片来源：

- **Bing 每日图**（近 7 天，每天一张）
- **Picsum**（免 key 随机高质量图）
- **本地 `img/` 目录**（你自己的图片）

所有远程图均经过内容安全黑名单过滤（屏蔽黄/赌/毒等关键词），仅使用可信源。

---

## 一、本地调试（Node.js）

适合本机 / 局域网访问，无需 Cloudflare 账号。

```bash
node server.js            # 默认端口 3000
PORT=8080 node server.js  # 自定义端口
DEBUG=1 node server.js    # 开启访问日志
```

- 监听 `0.0.0.0`，局域网内可用 `http://<本机IP>:3000/` 访问
- 访问 `/` 随机返回图片；`/img/xxx.jpg` 直接访问静态图
- 核心逻辑在 `wallpaper.js`，与 CF Pages 共用算法

---

## 二、部署到 Cloudflare Pages

CF Pages 是静态托管 + Pages Functions（支持 JS，运行在边缘网络），可完整跑本项目的随机逻辑。

### 方式 A：Git 推送自动部署（推荐）

1. 把整个目录推到 GitHub / GitLab 仓库。
2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Pages** → 关联仓库。
3. 构建设置：
   - **Build command**：留空
   - **Build output directory**：`/`（根目录）
   - **Production branch**：`main`（仓库默认分支）
4. 部署完成后，访问站点根路径即返回随机图片。

### 方式 B：Wrangler 本地预览 Functions

```bash
npx wrangler pages dev . --port 8788
# 打开 http://localhost:8788/
```

---

## 三、关键文件说明

| 文件 | 作用 |
|------|------|
| `server.js` | 本地 Node 服务器（调试用），逻辑等价于原 `api.php` |
| `wallpaper.js` | 核心算法模块（远程源获取、安全过滤、随机抽图），本地与 CF 共用 |
| `functions/index.js` | **CF Pages Functions** 入口，处理根路由 `/`，返回随机图片 |
| `_routes.json` | 声明 `/` 走函数，`/img/*` 等走 CDN 静态缓存 |
| `wrangler.toml` | Wrangler 本地调试配置 |
| `img/` | 你的本地壁纸图片 |

---

## 四、维护本地图清单

- **本地 `server.js`**：自动读取 `img/` 目录，增删图片无需改代码。
- **CF Pages Functions**：边缘环境无法用 `fs` 列举目录，需在 `functions/index.js` 的 `LOCAL_IMAGES` 数组手动维护 `img/` 下的文件名（保持与目录一致）。

> 若图片很多，可用构建脚本自动生成该数组（例如 `node gen-list.js` 输出清单），后续可加。

---

## 五、内容安全

`BLOCKLIST`（见 `wallpaper.js` / `functions/index.js`）包含黄/赌/毒相关关键词，任何远程图 URL 命中即跳过。已主动移除不可控的 LoremFlickr（其 `safe` 参数无法真正过滤 NSFW）。所用三个源（Bing / Picsum / 本地）均为合规可信源。

---

## 六、自定义

- 调整远程图数量：改 `getBingUrls(7)` / `getPicsumUrls(5)` 的参数。
- 加更多本地图：直接丢进 `img/`（本地自动生效；CF 需同步 `LOCAL_IMAGES`）。
- 接入 Wallhaven（需 API key）：在 `functions/index.js` 与 `wallpaper.js` 各加一个 `getWallhavenUrls()`，用环境变量 `WALLHAVEN_KEY`。
