/* ============================================================
   本机 AI 配置扫描（供「AI 接口 · 一键导入」使用）
   ------------------------------------------------------------
   全部只读，扫三处：
   1) ~/.codex/auth.json   —— Codex（CLI 与桌面版共用目录）的 API Key / 登录方式
   2) ~/.codex/config.toml —— 当前模型与自定义 model_provider 的 base_url
   3) 进程环境变量          —— OPENAI_API_KEY 等常见密钥
   返回结构化结果（含密钥本身，经 IPC 原样交给渲染进程填写——
   与用户手动粘贴同一条信任链路；本模块及调用方均不打印密钥）。
   ============================================================ */
const fs = require('fs');
const path = require('path');

/* 环境变量 → 服务商猜测（与 js/ai-engine.js 的 AI_PROVIDERS 对应） */
const ENV_KEYS = [
  { env: 'OPENAI_API_KEY',    baseEnv: 'OPENAI_BASE_URL',    provider: 'openai',   label: 'OpenAI' },
  { env: 'ANTHROPIC_API_KEY', baseEnv: 'ANTHROPIC_BASE_URL', provider: 'claude',   label: 'Anthropic Claude' },
  { env: 'DEEPSEEK_API_KEY',  baseEnv: 'DEEPSEEK_BASE_URL',  provider: 'deepseek', label: 'DeepSeek' },
  { env: 'ZHIPU_API_KEY',     baseEnv: 'ZHIPU_BASE_URL',     provider: 'zhipu',    label: '智谱 GLM' },
  { env: 'MOONSHOT_API_KEY',  baseEnv: 'MOONSHOT_BASE_URL',  provider: 'kimi',     label: 'Kimi（月之暗面）' },
  { env: 'DASHSCOPE_API_KEY', baseEnv: 'DASHSCOPE_BASE_URL', provider: 'qwen',     label: '通义千问' },
  { env: 'GEMINI_API_KEY',    baseEnv: 'GEMINI_BASE_URL',    provider: 'gemini',   label: 'Google Gemini' },
  { env: 'MISTRAL_API_KEY',   baseEnv: 'MISTRAL_BASE_URL',   provider: 'mistral',  label: 'Mistral' },
  { env: 'GROQ_API_KEY',      baseEnv: 'GROQ_BASE_URL',      provider: 'groq',     label: 'Groq' }
];

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

/* 极简 TOML 读取：只要 model / model_provider / [model_providers.X].base_url。
   Codex 的配置文件是人写的，正则足够，不值得引 TOML 库。 */
function readCodexToml(p) {
  let txt;
  try { txt = fs.readFileSync(p, 'utf8'); } catch (e) { return null; }
  const out = { model: '', provider: '', baseUrl: '' };
  const mModel = txt.match(/^\s*model\s*=\s*["']([^"']+)["']/m);
  if (mModel) out.model = mModel[1];
  const mProv = txt.match(/^\s*model_provider\s*=\s*["']([^"']+)["']/m);
  if (mProv) {
    out.provider = mProv[1];
    const esc = out.provider.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    /* 取 [model_providers.<name>] 段内容：到下一个段头或全文结尾为止。
       注意不能用带 m 的 $ 收尾——那会在第一行行尾就截断。 */
    const seg = txt.match(new RegExp('\\[model_providers\\.' + esc + '\\]([\\s\\S]*?)(?=\\r?\\n\\s*\\[|$)'));
    if (seg) {
      const mBase = seg[1].match(/^\s*base_url\s*=\s*["']([^"']+)["']/m);
      if (mBase) out.baseUrl = mBase[1];
    }
  }
  return out;
}

/**
 * @param {string} homeDir 用户主目录（os.homedir()）
 * @param {NodeJS.ProcessEnv} env 进程环境变量
 * @returns {{codexExists:boolean, codexMode:string|null, codexModel:string,
 *            items:Array<{kind:string,label:string,apiKey:string,baseUrl:string,model:string,provider?:string}>}}
 */
function scanAiConfig(homeDir, env) {
  env = env || process.env;
  const items = [];
  const codexDir = path.join(homeDir, '.codex');
  const auth = readJson(path.join(codexDir, 'auth.json'));
  const toml = readCodexToml(path.join(codexDir, 'config.toml'));

  let codexMode = null;
  if (auth) {
    codexMode = auth.auth_mode || (auth.OPENAI_API_KEY ? 'apikey' : null);
    if (auth.OPENAI_API_KEY) {
      items.push({
        kind: 'codex',
        label: 'Codex 配置（~/.codex/auth.json）',
        apiKey: String(auth.OPENAI_API_KEY),
        baseUrl: (toml && toml.baseUrl) || '',
        model: (toml && toml.model) || ''
      });
    }
  }

  ENV_KEYS.forEach(function (e) {
    const k = String(env[e.env] || '').trim();
    if (!k) return;
    items.push({
      kind: 'env',
      label: '环境变量 ' + e.env,
      apiKey: k,
      baseUrl: String(env[e.baseEnv] || '').trim(),
      model: '',
      provider: e.provider
    });
  });

  return {
    codexExists: !!(auth || toml),
    codexMode: codexMode,
    codexModel: (toml && toml.model) || '',
    items: items
  };
}

module.exports = { scanAiConfig: scanAiConfig, ENV_KEYS: ENV_KEYS };
