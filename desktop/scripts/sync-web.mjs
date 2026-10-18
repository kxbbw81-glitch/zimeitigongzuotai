/* 种子包同步：把工作台 Web 文件原样复制成 app-seed/，随安装包一起发。
   桌面版首次启动时把它复制到用户目录的 versions/<sha>/ 再加载；
   之后的热更新也只更新这个目录，用户数据（localStorage）不受影响。 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DESKTOP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(DESKTOP, '..'); // media-workbench 根目录
const SEED = path.join(DESKTOP, 'app-seed');

const COPY = ['index.html', 'plugin-install.html', 'css', 'js'];

function gitSha() {
  try {
    return execSync('git rev-parse HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
  } catch (e) {
    return 'dev-' + Date.now().toString(36);
  }
}

fs.rmSync(SEED, { recursive: true, force: true });
fs.mkdirSync(SEED, { recursive: true });
for (const item of COPY) {
  const src = path.join(ROOT, item);
  if (!fs.existsSync(src)) throw new Error('找不到要同步的文件：' + src);
  fs.cpSync(src, path.join(SEED, item), { recursive: true });
}

const seed = { sha: gitSha(), builtAt: new Date().toISOString() };
fs.writeFileSync(path.join(SEED, 'seed.json'), JSON.stringify(seed, null, 2) + '\n');

let files = 0;
let bytes = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else { files++; bytes += fs.statSync(p).size; }
  }
})(SEED);
console.log(`[sync-web] 种子包就绪：${files} 个文件 / ${(bytes / 1024).toFixed(0)} KB · sha=${seed.sha.slice(0, 7)}`);
