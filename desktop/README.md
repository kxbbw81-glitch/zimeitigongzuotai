# 桌面软件（desktop）

把「社媒工作台」打包成 Windows / macOS 原生软件，内核就是仓库根目录的纯前端页面，**内置 GitHub 热更新**。

## 结构

```
desktop/
├── src/
│   ├── main.js        # 主进程：窗口 / 首次种子 / 更新检查 / IPC / 菜单
│   ├── updater.js     # 热更新引擎（见下）
│   └── preload.js     # 安全桥：只向页面暴露 window.mwDesktop 更新能力
├── scripts/
│   ├── sync-web.mjs   # 把 ../ 的 Web 文件同步成 app-seed/（安装包内置种子）
│   └── make_icon.py   # 重新生成 assets/ 图标
├── assets/            # icon.png（1024）/ icon.ico
└── package.json       # electron 33 + electron-builder 25
```

## 热更新机制

1. **检测**：启动 3 秒后 / 每 4 小时 / 菜单「帮助 → 检查更新」时请求
   `https://api.github.com/repos/<owner>/<repo>/commits/main`，带 `If-None-Match`（ETag）；
   返回 304 = 没更新，不消耗接口配额。
2. **比对**：最新 commit sha ≠ 本地 `update.json` 里的 `currentSha` → 页面顶部弹「发现新版本」横幅。
3. **安装**：点「立即更新」→ 按 commit sha 从 `codeload.github.com` 下载 tar.gz →
   解包并校验关键文件 → 落到 `用户目录/versions/<sha>/` → 切换重载。
   每个版本独立目录，Windows 无文件占用问题；旧版本保留 1 个可回退。
4. **数据**：业务数据（localStorage）在用户目录另一位置，更新只动程序文件，互不影响。

换检测目标（fork 后）：环境变量 `MW_REPO_OWNER` / `MW_REPO_REPO` / `MW_REPO_BRANCH`。

## 常用命令

```bash
npm install
npm start            # 同步种子 + 以开发模式启动
npm run dist:win     # Windows：NSIS 安装包 + 便携版 exe → dist/
npm run dist:mac     # macOS：.dmg（x64 + arm64），需在 mac 上执行
npm run test:updater # 自检：模拟旧版本 → 检查 → 真实下载 → 切换 → 复核
npm run test:demo-update  # 演示模式：伪造一条「发现新版本」事件（不联网）
```

## CI

`.github/workflows/desktop.yml`：每次推送 main，Windows 和 macOS 两个 Runner 各自构建，
产物统一上传到仓库的 `nightly` 预发布（同名文件 `--clobber` 覆盖）。
macOS 未签名，首次打开右键 → 打开。

## 首次启动的行为

- 把安装包内置的 `app-seed/` 复制到 `用户目录/versions/<git-sha>/` 并加载；
- 之后只热更新这个目录，安装包本身只是「种子 + 壳」；
- 卸载软件不会删除用户目录里的数据和版本（NSIS 选项 `deleteAppDataOnUninstall: false`）。
