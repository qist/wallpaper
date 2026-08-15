# 随机壁纸服务

访问站点根路径（`/`）即随机返回一张图片，**每次刷新换一张**。图片来源混合：

- 🌅 **Bing 每日图**（近 7 天，每天一张）
- 🖼️ **Picsum**（免 key 随机高质量图）
- 📁 **本地 `img/` 目录**（你自己的图片）

所有远程图均经过内容安全黑名单过滤（屏蔽黄 / 赌 / 毒等关键词），仅使用合规可信源。

> 原始需求是把 `api.php`（随机返回一张本地图）改成可在 Cloudflare Pages 上运行的方案。本项目提供两种运行模式：**本地 Node 调试** 与 **CF Pages 边缘部署**，两者共用同一套随机算法。

---

## 快速开始

### 本地调试（Node.js）

```bash
node server.js            # 默认端口 3000
PORT=8080 node server.js  # 自定义端口
DEBUG=1 node server.js    # 开启访问日志
```

- 监听 `0.0.0.0`，局域网内可用 `http://<本机IP>:3000/` 访问
- 访问 `/` 随机返回图片；`/img/xxx.jpg` 直接访问静态图

### 部署到 Cloudflare Pages

1. 把仓库推到 GitHub（本仓库默认分支 `main`）
2. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → 关联仓库
3. 构建设置：
   - **Build command**：留空
   - **Build output directory**：`/`
   - **Production branch**：`main`
4. 部署完成后，访问站点根路径即返回随机图片

**线上演示站点：** https://wallpaper-1tg.pages.dev/

本地预览 Functions：

```bash
npx wrangler pages dev . --port 8788
```

---

## 文件结构

| 文件 | 作用 |
|------|------|
| `server.js` | 本地 Node 服务器（调试用），逻辑等价于原 `api.php` |
| `wallpaper.js` | 核心算法模块（远程源获取、安全过滤、随机抽图），本地与 CF 共用 |
| `functions/index.js` | **CF Pages Functions** 入口，处理根路由 `/`，返回随机图片 |
| `_routes.json` | 声明 `/` 走函数，`/img/*` 等走 CDN 静态缓存 |
| `wrangler.toml` | Wrangler 本地调试配置 |
| `DEPLOY.md` | 详细部署文档 |
| `img/` | 你的本地壁纸图片 |

---

## 工作原理

1. 并行获取远程源（Bing 近 7 天 + Picsum 5 张），经黑名单过滤后合并本地图清单
2. 从候选池随机抽一张，**尽量避免与上一次相同**（刷新即换图）
3. 远程图通过服务端代理转发（直接返回图片流，正确 `Content-Type`）；本地图直接读取
4. 任一远程源失败自动跳过，不影响其它源；全部失败时退回本地图

---

## 自定义

- **调整远程图数量**：改 `getBingUrls(7)` / `getPicsumUrls(5)` 的参数
- **加更多本地图**：直接丢进 `img/`
  - 本地 `server.js` 自动读取，无需改代码
  - CF Pages 需在 `functions/index.js` 的 `LOCAL_IMAGES` 数组同步文件名
- **接入 Wallhaven（需 API key）**：在 `functions/index.js` 与 `wallpaper.js` 各加 `getWallhavenUrls()`，用环境变量 `WALLHAVEN_KEY`

---

## 许可证

自由使用。
