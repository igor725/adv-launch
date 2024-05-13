const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendCommand: (cmd, info) => ipcRenderer.send('command', cmd, info),
  resolve: (prid, data) => ipcRenderer.send(`${prid}-resolve`, data),
  reject: (prid, err) => ipcRenderer.send(`${prid}-reject`, err),
  addEventListener: (event, listener) => ipcRenderer.on(event, (evt, message) => listener(message)),
  buildGameContextMenu: (data) => ipcRenderer.invoke('gamecontext', data),
  readTrophies: (path) => ipcRenderer.invoke('opentrp', path),
  requestConfig: () => ipcRenderer.invoke('reqcfg'),
  selectFolder: () => ipcRenderer.invoke('opendir'),
});
