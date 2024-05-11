const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendCommand: (cmd, info) => ipcRenderer.send('command', cmd, info),
  addEventListener: (event, listener) => ipcRenderer.on(event, (evt, message) => listener(message)),
  buildGameContextMenu: (data) => ipcRenderer.invoke('gamecontext', data),
  selectFolder: () => ipcRenderer.invoke('opendir'),
});
