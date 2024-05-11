const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendCommand: (cmd, info) => ipcRenderer.send('command', cmd, info),
  addEventListener: (event, listener) => ipcRenderer.on(event, (evt, message) => listener(message)),
  selectFolder: () => ipcRenderer.invoke('opendir')
});
