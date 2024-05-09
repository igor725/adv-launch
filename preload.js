const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendCommand: (cmd, info) => ipcRenderer.send('command', cmd, info),
  addEventListener: (event, listener) => ipcRenderer.addListener(event, (evt, message) => listener(message))
});
