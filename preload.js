const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendCommand: (cmd, info) => ipcRenderer.send('command', cmd, info),
  addEventListener: (event, listener) => ipcRenderer.on(event, (evt, message) => listener(message)),
  removeAllListeners: (event) => ipcRenderer.removeAllListeners(event),
  buildGameContextMenu: (data) => ipcRenderer.invoke('gamecontext', data),
  readTrophies: (path) => ipcRenderer.invoke('opentrp', path),
  multiTrophiesReady: (id) => ipcRenderer.send(`${id}-ready`),
  requestAudioDevices: () => ipcRenderer.invoke('reqadev'),
  requestConfig: () => ipcRenderer.invoke('reqcfg'),
  selectFolder: () => ipcRenderer.invoke('opendir'),
  setPortable: (state) => ipcRenderer.send('set-portable', state),
  resetLang: () => ipcRenderer.send('reset-lang')
});
