const { app, BrowserWindow, ipcMain } = require('electron');
const Convert = require('ansi-to-html');
const { Worker } = require('node:worker_threads');
const { spawn, exec } = require('child_process');
const path = require('node:path');
const fs = require('fs');
const { Config } = require('./settings.js');

const emupath = path.join(__dirname, '/bin/emulator');
const gipath = path.join(__dirname, '/gameinfo');
fs.mkdirSync(emupath, { recursive: true });
fs.mkdirSync(gipath, { recursive: true });

let win = null;
let player = null;
let settwin = null;
let gameproc = null;
let updateWorker = null;
let binname = 'psoff.exe';

const config = new Config(path.join(emupath, '/config'));

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

const _runDownloadingProcess = () => {
  win.send('warnmsg', { hidden: false, type: 'progress', prmin: 0, prmax: 100, id: 'upd-progr', text: 'Downloading emulator binaries, hang tight...', buttons: ['Cancel'] });
  updateWorker.postMessage({ act: 'download' });
}

const getGameSummary = (info) => {
  const dsum = { lastrun: -1, playtime: 0, trophies_max: 0, trophies: 0 };

  try {
    const data = fs.readFileSync(`${gipath}/${info.id}.json`);
    Object.assign(dsum, JSON.parse(data));
  } catch (e) {
    console.error(`Failed to load game info for ${info.id}: ${e.toString()}`);
  }

  try {
    dsum.trophies = fs.readFileSync(`${emupath}/GAMEFILES/${info.id}/tropinfo.${config.getInitialUser()}`).readUint32LE(0);
  } catch (e) {
    console.error(`Failed to load trophies info for ${info.id}: ${e.toString()}`);
  }

  return dsum;
};

const updateGameSummary = (gid, lastrun) => {
  const dsum = { lastrun: 0, playtime: 0, trophies_max: 0, trophies: 0 };

  try {
    const data = fs.readFileSync(`${gipath}/${gid}.json`);
    Object.assign(dsum, JSON.parse(data));
  } catch (e) {
    console.error(`Failed to load game info for ${gid}: ${e.toString()}`);
  }

  try {
    dsum.lastrun = lastrun;
    dsum.playtime += (Date.now() - lastrun);
    fs.writeFileSync(`${gipath}/${gid}.json`, JSON.stringify(dsum));
  } catch (e) {
    console.error(`Failed to save game info for ${gid}: ${e.toString()}`);
  }

  try {
    dsum.trophies = fs.readFileSync(`${emupath}/GAMEFILES/${gid}/tropinfo.${config.getInitialUser()}`).readUint32LE(0);
  } catch (e) {
    console.error(`Failed to load trophies info for ${gid}: ${e.toString()}`);
  }

  return dsum;
};

const updateBinaryPath = (path) => {
  binname = path ?? binname;
  exec(`"${binname}" -h`).on('close', (code) => {
    if (code === 1) config.reloadEmulatorSettings();
    else throw new Error('Failed to make a test emulator run!');
  });
};

const commandHandler = (channel, cmd, info) => {
  switch (cmd) {
    case 'quit':
      app.quit();
      break;
    case 'minimize':
      win.minimize();
      break;
    case 'getgames':
      scanGameDir('D:\\ps4\\games\\');
      break;
    case 'getgamesum':
      win.send('gamesum', getGameSummary(info));

      if (player != null) {
        player.kill('SIGKILL');
        player = null;
      }

      try {
        win.send('set-bg-image', fs.readFileSync(path.join(info.path, '/sce_sys/pic0.png'), { encoding: 'base64' }));
      } catch (e) {
        win.send('set-bg-image', null);
      }

      const volume = config.getVolume();

      if (gameproc != null || volume == 0) return;

      try {
        const apath = path.join(info.path, '/sce_sys/snd0.at9');
        if (fs.lstatSync(apath).isFile()) {
          player = spawn(path.join(__dirname, '/bin/ffplay.exe'), [
            '-nodisp', '-volume', volume,
            '-vn', '-loglevel', 'quiet',
            '-loop', '0', '-i', apath
          ]);
        }
      } catch (e) {
        console.error(`Failed to run background audio play: ${e.toString()}`);
      }
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
      gameproc = spawn(path.join(emupath, binname), [`--file=${info.path}\\eboot.bin`], { cwd: emupath });
      gameproc.stdout.on('data', terminalListener);
      gameproc.stderr.on('data', terminalListener);
      gameproc._gameID = info.gid;
      gameproc._startTime = Date.now();

      gameproc.on('error', (err) => {
        win.send('alert', err.toString());
        win.send('ingame', false);
        gameproc = null;
      });

      gameproc.on('close', (code) => {
        config.reloadEmulatorSettings();
        win.send('gamesum', updateGameSummary(gameproc._gameID, gameproc._startTime));
        win.send('term-data', converter.toHtml(`Process exited with code ${code}`));
        win.send('ingame', false);
        gameproc = null;
      });
      break;
    case 'warnresp':
      switch (info.id) {
        case 'upd-nobin':
          if (info.resp === 0) {
            _runDownloadingProcess();
          } else if (info.resp === 2) {
            app.quit();
          } else {
            win.send('warnmsg', { hidden: true, id: 'upd-nobin' });
          }
          break;

        case 'upd-progr':
          if (info.resp === 0) {
            app.quit();
          }
          break;

        case 'upd-newver':
          if (info.resp === 0) {
            _runDownloadingProcess();
          } else if (info.resp === 1) {
            win.send('warnmsg', { hidden: true, id: 'upd-newver' });
          }
          break;

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
    width: 1014,
    height: 570,
    minWidth: 1014,
    minHeight: 570,
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
          win.send('warnmsg', { hidden: false, type: 'text', id: 'upd-nobin', text: `Looks like you have no psOff emulator installed. Would you like the launcher to download the latest release (${msg.latest})?`, buttons: ['Yes', 'Ignore', 'Close the launcher'] });
          break;

        case 'progress':
          win.send('warnmsg-upd', { id: 'upd-progr', progress: msg.value });
          break;

        case 'done':
          updateBinaryPath(msg.executable);
          win.send('warnmsg', { id: 'upd-progr', hidden: true });
          break;

        case 'available':
          updateBinaryPath(msg.executable);
          win.send('warnmsg', { hidden: false, type: 'text', id: 'upd-newver', text: `New version of psOff emulator is available! Do you want to download it? (Installed: ${msg.currver}, New: ${msg.newver})`, buttons: ['Yes', 'No'] });
          break;

        case 'error':
          win.send('alert', 'Failed to check for updates!');
          break;
      }
    });

    updateWorker.postMessage({ act: 'set-branch', branch: config.getBranch(), path: emupath });
    updateWorker.postMessage({ act: 'run-check' });
  });

  win.loadFile('webroot/index.html');
});
