const { app, BrowserWindow, ipcMain } = require('electron');
const { Worker } = require('node:worker_threads');
const { spawn } = require('child_process');
const path = require('node:path');
const fs = require('fs');

let win = null;
let player = null;
let settwin = null;

const commandHandler = (channel, cmd, info) => {
  switch (cmd) {
    case 'quit':
      app.quit();
      break;
    case 'getgames':
      const dirworker = new Worker(path.join(__dirname, 'gamescanner.js'));
      dirworker.on('message', (msg) => {
        win.send('add-game', msg);
      });
      dirworker.postMessage({ act: 'scangdir', path: 'D:\\ps4\\games\\' });
      break;
    case 'getbgaudio':
      if (player != null) {
        player.kill('SIGKILL');
        player = null;
      }

      try {
        win.send('set-bg-image', fs.readFileSync(path.join(info, '/sce_sys/pic0.png'), { encoding: 'base64' }));
      } catch (e) {
        win.send('set-bg-image', null);
      }

      try {
        const apath = path.join(info, '/sce_sys/snd0.at9');
        if (fs.lstatSync(apath).isFile()) {
          player = spawn('ffplay', ['-nodisp', '-volume', '20', '-vn', '-loglevel', 'quiet', '-loop', '0', '-i', apath]);
        }
      } catch (e) { }
      break;
    case 'stopaudio':
      if (player != null) {
        player.kill('SIGKILL');
        player = null;
      }
      break;
    case 'showsettings':
      if (settwin != null) return;
      win.send('input', false);
      settwin = new BrowserWindow({
        parent: win,
        frame: false,
        resizable: false,
        width: 380,
        height: 380
      });
      settwin.on('closed', () => {
        win.send('input', true);
        settwin = null;
      });
      settwin.loadFile('dist/settings.html');
      break;
  }
};

app.whenReady().then(() => {
  ipcMain.on('command', commandHandler);

  win = new BrowserWindow({
    width: 960,
    height: 540,
    minWidth: 960,
    minHeight: 540,
    frame: false,
    webPreferences: {
      nodeIntegrationInWorker: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.setAspectRatio(16 / 9);
  win.loadFile('dist/index.html');
});
