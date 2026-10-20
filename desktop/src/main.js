/* ============================================================
   社媒工作台 · 主进程（窗口 / 种子 / 更新检查 / IPC / 菜单）
   ============================================================ */
const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

/* 更新模块：加载失败时退到兜底实现，保证应用仍能打开（只是没有自动更新） */
let Updater = null;
let REPO = { owner: 'kxbbw81-glitch', repo: 'zimeitigongzuotai', branch: 'main' };
let CHECK_INTERVAL = 4 * 60 * 60 * 1000;
try {
  const updaterMod = require('./updater');
  Updater = updaterMod.Updater;
  if (updaterMod.REPO) REPO = updaterMod.REPO;
  if (updaterMod.CHECK_INTERVAL) CHECK_INTERVAL = updaterMod.CHECK_INTERVAL;
} catch (e) {
  console.error('[main] 更新模块加载失败，自动更新不可用：', e && e.message ? e.message : e);
}

const isDev = !app.isPackaged;
let win = null;
let updater = null;
let checkTimer = null;

/* ---------- 路径 ---------- */
function versionsRoot() { return path.join(app.getPath('userData'), 'versions'); }
function seedDir() {
  /* 打包后：resources/app-seed；开发模式（electron .）：resourcesPath 指向
     electron 安装目录，退回 app 目录（desktop/）找 app-seed */
  const candidates = [
    path.join(process.resourcesPath, 'app-seed'),
    path.join(app.getAppPath(), 'app-seed')
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'index.html'))) return c;
  }
  return candidates[0];
}
function entryFile() { return path.join(versionsRoot(), updater.state.currentSha, 'index.html'); }

/* 更新模块缺失时的兜底更新器：把种子直接铺到 versions/seed 保证能启动，
   检查/安装返回明确错误（提示重装），不让应用白屏 */
function makeFallbackUpdater(userData) {
  const dest = path.join(userData, 'versions', 'seed');
  try {
    if (!fs.existsSync(path.join(dest, 'index.html'))) {
      fs.mkdirSync(dest, { recursive: true });
      const dir = seedDir();
      for (const item of ['index.html', 'plugin-install.html', 'css', 'js']) {
        const s = path.join(dir, item);
        if (fs.existsSync(s)) fs.cpSync(s, path.join(dest, item), { recursive: true });
      }
    }
  } catch (e) {
    console.error('[main] 兜底种子铺设失败：', e && e.message ? e.message : e);
  }
  return {
    state: { currentSha: 'seed', etag: null, lastCheckAt: null, lastError: '更新模块缺失', available: null },
    seed: function () { return 'seed'; },
    check: async function () { return { type: 'error', message: '更新模块缺失，请重新安装最新版' }; },
    apply: async function () { throw new Error('更新模块缺失，请重新安装最新版'); },
    repoUrl: function () { return 'https://github.com/' + REPO.owner + '/' + REPO.repo; },
    _save: function () {}, _prune: function () {}
  };
}

/* ---------- 窗口 ---------- */
function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 960,
    minHeight: 640,
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    title: '社媒工作台',
    backgroundColor: '#f5f6fa',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.once('ready-to-show', function () { win.show(); });
  win.loadFile(entryFile());
  if (isDev) win.webContents.openDevTools({ mode: 'bottom' });

  win.webContents.setWindowOpenHandler(function ({ url }) {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.on('closed', function () { win = null; });
}

/* ---------- 更新事件下发 ---------- */
function emit(payload) {
  if (win && !win.isDestroyed()) win.webContents.send('mw:update-event', payload);
}

async function checkUpdates(force) {
  emit({ type: 'checking' });
  const r = await updater.check(force);
  emit(r);
  return r;
}

async function installUpdate() {
  try {
    const r = await updater.apply(function (p) {
      emit(Object.assign({ type: 'progress' }, p));
    });
    emit(r);
    /* 停 600ms 让用户看到「已更新」提示，再切到新版本重载 */
    setTimeout(function () {
      if (win && !win.isDestroyed()) win.loadFile(entryFile());
    }, 600);
    return r;
  } catch (e) {
    const payload = { type: 'error', message: e && e.message ? e.message : String(e) };
    emit(payload);
    return payload;
  }
}

/* ---------- 菜单 ---------- */
function showAbout() {
  const s = updater.state;
  const lines = [
    '社媒工作台（外贸社媒 + 自媒体一体化）',
    '',
    '版本：' + app.getVersion(),
    '当前构建：' + String(s.currentSha || '').slice(0, 7),
    s.available ? '待更新：' + s.available.sha.slice(0, 7) + ' · ' + s.available.message : '已是最新提交',
    s.lastCheckAt ? '上次检查：' + new Date(s.lastCheckAt).toLocaleString() : '尚未检查过更新',
    '',
    '更新来源：' + updater.repoUrl(),
    '数据保存在本机，卸载不会删除。'
  ];
  dialog.showMessageBox(win, { type: 'info', title: '关于 社媒工作台', message: lines.join('\n'), buttons: ['知道了', '打开仓库'] })
    .then(function (r) {
      if (r.response === 1) shell.openExternal(updater.repoUrl());
    });
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const tpl = [];
  if (isMac) {
    tpl.push({
      label: app.name,
      submenu: [
        { label: '关于 社媒工作台', click: showAbout },
        { type: 'separator' },
        { role: 'quit', label: '退出' }
      ]
    });
  }
  tpl.push({
    label: '视图',
    submenu: [
      { role: 'reload', label: '刷新页面' },
      { role: 'forceReload', label: '强制刷新' },
      { role: 'toggleDevTools', label: '开发者工具' },
      { type: 'separator' },
      { role: 'resetZoom', label: '实际大小' },
      { role: 'zoomIn', label: '放大' },
      { role: 'zoomOut', label: '缩小' }
    ]
  });
  tpl.push({
    label: '帮助',
    submenu: [
      { label: '检查更新', accelerator: 'CmdOrCtrl+Shift+U', click: function () { checkUpdates(true); } },
      { type: 'separator' },
      { label: '打开项目仓库', click: function () { shell.openExternal(updater.repoUrl()); } },
      { label: '关于 社媒工作台', click: showAbout }
    ]
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

/* ---------- IPC ---------- */
function bindIpc() {
  ipcMain.handle('mw:get-state', function () {
    return {
      currentSha: updater.state.currentSha,
      available: updater.state.available,
      lastCheckAt: updater.state.lastCheckAt,
      lastError: updater.state.lastError,
      version: app.getVersion(),
      platform: process.platform,
      repo: REPO
    };
  });
  ipcMain.handle('mw:check-update', function () { return checkUpdates(true); });
  ipcMain.handle('mw:install-update', function () { return installUpdate(); });
  ipcMain.handle('mw:open-repo', function () { shell.openExternal(updater.repoUrl()); });
}

/* ---------- 自检模式（--test-updater）：不依赖人工，全链路跑一遍 ---------- */
async function runSelfTest() {
  const result = { steps: [], ok: false };
  const step = function (name, pass, extra) {
    result.steps.push({ name: name, pass: pass, extra: extra || '' });
    console.log((pass ? '[PASS] ' : '[FAIL] ') + name + (extra ? ' · ' + extra : ''));
  };
  const userData = app.getPath('userData');
  try {
    /* 1. 模拟一个「落后的旧版本」 */
    updater.state.currentSha = '0'.repeat(40);
    updater.state.available = null;
    updater._save();
    step('写入旧版本状态', true);

    /* 2. 检查更新（应发现新版本） */
    const r1 = await updater.check(true);
    step('GitHub 检查更新', r1.type === 'available', r1.type + ' ' + String(r1.sha || '').slice(0, 7) + ' ' + (r1.message || ''));

    /* 3. 下载并安装 */
    const r2 = await updater.apply(function () {});
    step('下载并切换版本', r2.type === 'applied' && r2.sha !== '0'.repeat(40), String(r2.sha || '').slice(0, 7));

    /* 4. 校验版本目录内容 */
    const idx = path.join(versionsRoot(), r2.sha, 'index.html');
    const html = fs.existsSync(idx) ? fs.readFileSync(idx, 'utf8') : '';
    step('新版本文件完整', html.indexOf('社媒工作台') !== -1 && fs.existsSync(path.join(versionsRoot(), r2.sha, 'js', 'app.js')));

    /* 5. 再查一次应为最新 */
    const r3 = await updater.check(true);
    step('安装后检查为最新', r3.type === 'up-to-date', r3.type);

    result.ok = result.steps.every(function (s) { return s.pass; });
  } catch (e) {
    step('自检异常', false, e && e.message ? e.message : String(e));
  }
  fs.writeFileSync(path.join(userData, 'test-result.json'), JSON.stringify(result, null, 2));
  console.log(result.ok ? 'SELF-TEST OK' : 'SELF-TEST FAILED');
  app.exit(result.ok ? 0 : 1);
}

/* ---------- 启动 ---------- */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady().then(function () {
    const userData = app.getPath('userData');
    updater = Updater
      ? new Updater(userData, function (m) { console.log('[updater] ' + m); })
      : makeFallbackUpdater(userData);
    updater.seed(seedDir());
    createWindow();
    buildMenu();
    bindIpc();

    if (process.argv.includes('--test-updater')) {
      runSelfTest();
      return;
    }
    if (process.argv.includes('--demo-update')) {
      /* 演示/截图用：不联网，直接伪造一个「发现新版本」事件 */
      win.webContents.once('did-finish-load', function () {
        emit({
          type: 'available',
          sha: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
          message: '演示：桌面版支持 GitHub 热更新',
          date: new Date().toISOString(),
          author: 'demo'
        });
      });
    }

    /* 启动 3 秒后静默检查一次，之后每 4 小时一次 */
    setTimeout(function () { checkUpdates(false); }, 3000);
    checkTimer = setInterval(function () { checkUpdates(false); }, CHECK_INTERVAL);
  });

  app.on('second-instance', function () {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
  });
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}
