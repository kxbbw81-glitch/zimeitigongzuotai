/* 社媒工作台 · 预加载桥：只暴露更新相关能力，渲染进程拿不到任何 Node 权限 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mwDesktop', {
  isDesktop: true,
  platform: process.platform,
  getState: function () { return ipcRenderer.invoke('mw:get-state'); },
  checkUpdate: function () { return ipcRenderer.invoke('mw:check-update'); },
  installUpdate: function () { return ipcRenderer.invoke('mw:install-update'); },
  openRepo: function () { return ipcRenderer.invoke('mw:open-repo'); },
  scanAiConfig: function () { return ipcRenderer.invoke('mw:scan-ai-config'); },
  onUpdateEvent: function (cb) {
    const handler = function (_e, data) { cb(data); };
    ipcRenderer.on('mw:update-event', handler);
    return function () { ipcRenderer.removeListener('mw:update-event', handler); };
  }
});
