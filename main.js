const { app, BrowserWindow, ipcMain } = require('electron');
const Convert = require('ansi-to-html');
const { Worker } = require('node:worker_threads');
const { spawn, exec } = require('child_process');
const path = require('node:path');
const fs = require('fs');
const config = require('./settings.js');

const emupath = path.join(__dirname, '/bin/emulator');
fs.mkdirSync(emupath, { recursive: true });
// const emupath = 'C:/Users/igorg/Documents/GitHub/psOff_public/_build/_Install';

let win = null;
let player = null;
let settwin = null;
let gameproc = null;
let updateWorker = null;
let binname = 'psoff.exe';

const converter = new Convert({
  newline: true
});

const terminalListener = (msg) => {
  win.send('term-data', converter.toHtml(msg.toString()));
};

const scanGameDir = (scanpath) => {
  const dirworker = new Worker(path.join(__dirname, '/services/gamescanner.js'));
  dirworker.on('message', (msg) => {
    if (win.isDestroyed()) return;
    win.send('add-game', msg);
  });
  dirworker.postMessage({ act: 'scangdir', path: scanpath, depth: 3 });
};

const commandHandler = (channel, cmd, info) => {
  switch (cmd) {
    case 'quit':
      app.quit();
      break;
    case 'getgames':
      scanGameDir('D:\\ps4\\games\\');
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

      const volume = config.getVolume();

      if (gameproc != null || volume == 0) return;

      try {
        const apath = path.join(info, '/sce_sys/snd0.at9');
        if (fs.lstatSync(apath).isFile()) {
          player = spawn(path.join(__dirname, '/bin/ffplay.exe'), [
            '-nodisp', '-volume', volume,
            '-vn', '-loglevel', 'quiet',
            '-loop', '0', '-i', apath
          ]);
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
      settwin.loadFile('webroot/settings.html');
      break;
    case 'openfolder':
      exec(`explorer "${info}"`);
      break;
    case 'rungame':
      if (gameproc != null) {
        win.send('alert', 'You should close your previous game first!');
        return;
      }
      win.send('ingame', true);
      gameproc = spawn(path.join(emupath, binname), [`--file=${info}\\eboot.bin`], { cwd: emupath });
      gameproc.stdout.on('data', terminalListener);
      gameproc.stderr.on('data', terminalListener);
      gameproc.on('error', (err) => {
        win.send('alert', err.toString());
        win.send('ingame', false);
        gameproc = null;
      })
      gameproc.on('close', (code) => {
        win.send('term-data', converter.toHtml(`Process exited with code ${code}`));
        win.send('ingame', false);
        gameproc = null;
      });
      break;
    case 'warnresp':
      if (info.id === 'upd-nobin') {
        if (info.resp === 0) {
          win.send('warnmsg', { hidden: false, type: 'progress', prmin: 0, prmax: 100, id: 'upd-progr', text: 'Downloading emulator binaries, hang tight...', buttons: ['Cancel'] });
          updateWorker.postMessage({ act: 'download' });
        } else if (info.resp === 2) {
          app.quit();
        } else {
          win.send('warnmsg', { hidden: true, id: 'upd-nobin' });
        }
      } else if (info.id === 'upd-progr') {
        if (info.resp === 0) {
          app.quit();
        }
      }
      break;

    default:
      console.error('Unhandled command: ', cmd);
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

  win.webContents.once('did-finish-load', () => {
    updateWorker = new Worker(path.join(__dirname, '/services/updater.js'));

    updateWorker.on('message', (msg) => {
      if (win.isDestroyed()) return;

      switch (msg.resp) {
        case 'nobinary':
          win.send('warnmsg', { hidden: false, type: 'text', id: 'upd-nobin', text: 'Looks like you have no psOff emulator installed. Would you like the launcher to download the latest release?', buttons: ['Yes', 'Ignore', 'Close the launcher'] });
          break;

        case 'progress':
          win.send('warnmsg-upd', { id: 'upd-progr', progress: msg.value });
          break;

        case 'done':
          binname = msg.executable ?? binname;
          win.send('warnmsg', { id: 'upd-progr', hidden: true });
          break;
      }
    });

    updateWorker.postMessage({ act: 'set-branch', branch: config.getBranch(), path: emupath });
    updateWorker.postMessage({ act: 'run-check' });
  });

  win.loadFile('webroot/index.html');
});
