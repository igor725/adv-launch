const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const Convert = require('ansi-to-html');
const { Worker } = require('node:worker_threads');
const { spawn, exec } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { Config } = require('./libs/settings.js');
const { Trophies, TrophySharedConfig, TrophyDataReader } = require('./libs/trophies.js');

const emupath = path.join(__dirname, '/bin/emulator');
const gipath = path.join(__dirname, '/gameinfo');

const SCE_PIC_PATH = '/sce_sys/pic0.png';
const SCE_TROPHY_PATH = '/sce_sys/trophy/trophy00.trp';
const SCE_BGA_PATH = '/sce_sys/snd0.at9';

try {
  fs.mkdirSync(emupath, { recursive: true });
  fs.mkdirSync(gipath, { recursive: true });
  exec('del temp*.zip', { cwd: emupath });
} catch (e) {
  console.error(e.toString());
  process.exit(1);
}

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

const scanGameDir = (scanpath, depth) => {
  const dirworker = new Worker(path.join(__dirname, '/services/gamescanner.js'));
  dirworker.on('message', (msg) => {
    if (win.isDestroyed()) return;
    win.send('add-game', msg);
  });
  dirworker.on('exit', () => dirworker.unref());
  dirworker.postMessage({ act: 'scangdir', path: scanpath, depth: depth });
};

const _runDownloadingProcess = (retry = false) => {
  win.send('warnmsg', { hidden: false, type: 'progress', prmin: 0, prmax: 100, id: 'upd-progr', text: '{$tr:updater.warns.downproc}', buttons: ['{$tr:buttons.ca}'] });
  updateWorker.postMessage({ act: retry ? 'retry' : 'download' });
}

const loadTrophiesData = (gid) => {
  try {
    const tfile = fs.readFileSync(`${emupath}/GAMEFILES/${gid}/tropinfo.${config.getInitialUser()}`);
    const trophies = [];
    const count = tfile.readUint32LE(0);
    for (let i = 0; i < count; ++i) {
      const offset = 4 + (i * 12);
      trophies.push([tfile.readUint32LE(offset), tfile.readBigUint64LE(offset + 4)]);
    }

    return trophies;
  } catch (e) {
    console.error(`Failed to load trophies info for ${gid}: ${e.toString()}`);
  }

  return [];
};

const getGameSummary = (info, loadtrophies = true) => {
  const dsum = { lastrun: -1, playtime: 0, patch: '' };

  try {
    const data = fs.readFileSync(`${gipath}/${info.gid}.json`);
    Object.assign(dsum, JSON.parse(data));
  } catch (e) {
    console.error(`Failed to load game info for ${info.gid}: ${e.toString()}`);
  }

  if (loadtrophies) dsum.trophies = loadTrophiesData(info.gid);
  dsum.gid = info.gid;

  return dsum;
};

const updateGameSummary = (gid, update, loadtrophies = false) => {
  const dsum = { lastrun: -1, playtime: 0, patch: '' };

  try {
    const data = fs.readFileSync(`${gipath}/${gid}.json`);
    Object.assign(dsum, JSON.parse(data));
  } catch (e) {
    console.error(`Failed to load game info for ${gid}: ${e.toString()}`);
  }

  try {
    if (update.lastrun !== undefined)
      dsum.playtime += (Date.now() - update.lastrun);
    Object.assign(dsum, update);
    fs.writeFileSync(`${gipath}/${gid}.json`, JSON.stringify(dsum));
  } catch (e) {
    console.error(`Failed to save game info for ${gid}: ${e.toString()}`);
  }

  if (loadtrophies) dsum.trophies = loadTrophiesData(gid);
  dsum.gid = gid;

  return dsum;
};

const updateBinaryPath = (path, checkfirst = false) => {
  binname = path ?? binname;
  exec(`"${binname}" -h`, { cwd: emupath }).on('close', (code) => {
    if (code === 0 || code === 4294967295) config.reloadEmulatorSettings();
    else throw new Error('Failed to make a test emulator run!');
  });

  if (checkfirst && config.isFirstLaunch()) {
    win.send('warnmsg', { hidden: false, type: 'text', id: 'first-launch', text: '{$tr:main.firstrun.text}', buttons: ['{$tr:main.firstrun.nobtn}', '{$tr:main.firstrun.yesbtn}'] });
  }
};

const genericWarnMsg = (text = 'Empty text?', noclose = false, trparams) => {
  const buttons = ['{$tr:buttons.ok}'];
  if (noclose === false) buttons.push('{$tr:buttons.cl}');
  win.send('warnmsg', { hidden: false, type: 'text', id: 'gen-warn', text: text, trparams: trparams, buttons });
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
      for (const [path, depth] of config.getScanDirectories()) {
        scanGameDir(path, depth);
      }
      break;
    case 'getgamesum':
      win.send('gamesum', getGameSummary(info));

      if (player != null) {
        player.kill('SIGKILL');
        player = null;
      }

      let bgimage = null;
      try {
        bgimage = fs.readFileSync(path.join(info.gpath[0], SCE_PIC_PATH), { encoding: 'base64' });
      } catch (e) {
        if (info.gpath[1]) {
          try {
            bgimage = fs.readFileSync(path.join(info.gpath[1], SCE_PIC_PATH), { encoding: 'base64' });
          } catch (e2) {
            console.error(e2.toString());
            bgimage = null;
          }
        } else {
          console.error(e.toString());
          bgimage = null;
        }
      }
      win.send('set-bg-image', bgimage);

      const volume = config.getVolume();

      if (gameproc != null || volume == 0) return;

      const runPlayer = (apath) => {
        try {
          player = spawn(path.join(__dirname, '/bin/ffplay.exe'), [
            '-nodisp', '-volume', volume,
            '-vn', '-loglevel', 'quiet',
            '-loop', '0', '-i', apath
          ]);
        } catch (e) {
          console.error(`Failed to run background audio play: ${e.toString()}`);
        }
      };

      try {
        const apath = path.join(info.gpath[0], SCE_BGA_PATH);
        if (fs.lstatSync(apath).isFile()) runPlayer(apath);
      } catch (e) {
        if (info.gpath[1]) {
          try {
            const apath = path.join(info.gpath[1], SCE_BGA_PATH);
            if (fs.lstatSync(apath).isFile()) runPlayer(apath);
          } catch (e2) {
            console.error(e2.toString());
          }
        } else {
          console.error(e.toString());
        }
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
        width: 400,
        height: 400,
        webPreferences: {
          preload: path.join(__dirname, 'preload.js')
        }
      });
      settwin.on('closed', () => {
        win.send('input', true);
        settwin = null;
      });
      settwin.loadFile('webroot/settings.html');
      settwin.webContents.once('did-finish-load', () => settwin.send('set-lang', config.getSysLang()));
      break;
    case 'openfolder':
      exec(`explorer "${info}"`);
      break;
    case 'applypatch':
      updateGameSummary(info.gid, { patch: info.patch });
      break;
    case 'rungame':
      if (gameproc != null) {
        genericWarnMsg('{$tr:main.actions.alrun}', true);
        return;
      }
      win.send('ingame', true);
      const emuargs = [`--file=${info.path}\\eboot.bin`];
      const patch = getGameSummary(info, false).patch;
      if (patch) emuargs.push(`--update=${patch}`);

      gameproc = spawn(path.join(emupath, binname), emuargs, { cwd: emupath });
      gameproc.stdout.on('data', terminalListener);
      gameproc.stderr.on('data', terminalListener);
      gameproc._gameID = info.gid;
      gameproc._startTime = Date.now();

      gameproc.on('error', (err) => {
        genericWarnMsg('{$tr:main.actions.gerror}', true, { error: err.toString() });
        win.send('ingame', false);
        gameproc = null;
      });

      gameproc.on('close', (code) => {
        config.reloadEmulatorSettings();
        win.send('gamesum', updateGameSummary(gameproc._gameID, { lastrun: gameproc._startTime }, true));
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

        case 'upd-notoken':
          win.send('warnmsg', { hidden: true, id: 'upd-notoken' });
          if (info.resp === 1) {
            config.updateMultipleKeys([{}, { update_channel: 'release' }]);
          }
          break;

        case 'upd-fail':
          if (info.resp === 0) {
            _runDownloadingProcess(true);
          } else if (info.resp === 1) {
            win.send('warnmsg', { hidden: true, id: 'upd-fail' });
          } else if (info.resp === 2) {
            app.quit();
          }
          break;

        case 'gen-warn':
          if (info.resp === 0) {
            win.send('warnmsg', { hidden: true, id: 'gen-warn' });
          } else if (info.resp === 1) {
            app.quit();
          }
          break;

        case 'first-launch':
          config.markLaunch();
          win.send('warnmsg', { hidden: true, id: 'first-launch' });

          if (info.resp === 1) {
            commandHandler('command', 'showsettings');
          }
          break;

        default:
          console.error('Unhandled warnmsg action: ', info.id);
          break;
      }
      break;
    case 'sett-request':
      settwin.send('sett-values', config.getFullConfig());
      break;
    case 'sett-opengh':
      exec(`start https://github.com/settings/personal-access-tokens/new`);
      break;
    case 'sett-update':
      config.updateMultipleKeys(info);
      settwin.close();
      break;

    default:
      console.error('Unhandled command: ', cmd);
      break;
  }
};

app.whenReady().then(() => {
  ipcMain.on('command', commandHandler);
  ipcMain.handle('opendir', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
    if (canceled) return null;
    return filePaths[0];
  });

  ipcMain.handle('opentrp', async (event, paths) => {
    let tropxml = null;
    try {
      tropxml = new Trophies(path.join(paths[0], SCE_TROPHY_PATH), -1);
    } catch (err) {
      if (paths[1]) tropxml = new Trophies(path.join(paths[1], SCE_TROPHY_PATH), -1);
      else throw err;
    }
    let tfile = tropxml.findFile(`trop_${String(config.getSysLang()).padStart(2, '0')}.esfm`);
    if (tfile === null && (tfile = tropxml.findFile('trop.esfm')) == null) return null;
    const data = new TrophyDataReader(tfile);
    data.addImages(tropxml);
    return data.array;
  });
  ipcMain.handle('gamecontext', (event, data) => new Promise((resolve, reject) => {
    const currpatch = getGameSummary(data, false).patch;

    const popupdata = [
      {
        click: () => commandHandler('command', 'openfolder', data.path),
        type: 'normal',
        label: 'Open game folder'
      },
      {
        type: 'submenu',
        label: 'Apply patch...',
        submenu: [
          {
            click: () => commandHandler('command', 'applypatch', { gid: data.gid, patch: '' }),
            type: 'radio',
            label: `Original (${data.gver})`,
            checked: false
          }
        ]
      }
    ];

    for (const patch of data.patches) {
      popupdata[1].submenu.push({
        click: () => commandHandler('command', 'applypatch', { gid: data.gid, patch: patch.path }),
        type: 'radio',
        label: patch.version,
        checked: currpatch === patch.path
      })
    }

    try {
      const menu = Menu.buildFromTemplate(popupdata);

      menu.popup({
        callback: resolve,
        window: win,
        x: data.x,
        y: data.y
      });
    } catch (e) {
      reject(e);
    }
  }));

  win = new BrowserWindow({
    width: 1014,
    height: 570,
    minWidth: 1014,
    minHeight: 570,
    frame: false,
    webPreferences: {
      allowRunningInsecureContent: false,
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
          win.send('warnmsg', { hidden: false, type: 'text', id: 'upd-nobin', text: '{$tr:updater.warns.noemu}', trparams: msg, buttons: ['{$tr:buttons.ye}', '{$tr:buttons.ig}', '{$tr:buttons.cl}'] });
          break;

        case 'progress':
          win.send('warnmsg-upd', { id: 'upd-progr', progress: msg.value });
          break;

        case 'done':
          win.send('warnmsg', { id: 'upd-progr', hidden: true });
          updateBinaryPath(msg.executable, true);
          break;

        case 'available':
          updateBinaryPath(msg.executable);
          win.send('warnmsg', { hidden: false, type: 'text', id: 'upd-newver', text: '{$tr:updater.warns.newver}', trparams: msg, buttons: ['{$tr:buttons.ye}', '{$tr:buttons.no}'] });
          break;

        case 'notoken':
          updateBinaryPath(msg.executable);
          win.send('warnmsg', { hidden: false, type: 'text', id: 'upd-notoken', text: '{$tr:updater.errors.nonightly}', buttons: ['{$tr:buttons.ok}', '${$tr:buttons.sr}'] });
          break;

        case 'error':
          win.send('warnmsg', { hidden: false, type: 'text', id: 'upd-fail', text: '{$tr:updater.errors.checkfail}', trparams: { error: msg.text }, buttons: ['{$tr:buttons.re}', '{$tr:buttons.ig}', '{$tr:buttons.cl}'] });
          break;
      }
    });

    {
      let token;
      if (token = config.getValue('github_token')) updateWorker.postMessage({ act: 'set-token', token: token });
    }

    try {
      let erk;
      if (erk = config.getTrophyKey()) TrophySharedConfig.setERK(erk);
    } catch (err) {
      console.error('Failed to set trophy key: ', err.toString());
    }

    win.send('set-lang', config.getSysLang());
    updateWorker.postMessage({ act: 'set-branch', branch: config.getValue('update_channel'), path: emupath });
    updateWorker.postMessage({ act: 'set-freq', freq: config.getValue('update_freq') });
    updateWorker.postMessage({ act: 'run-check', force: false });
  });

  let updaterchanged = false, shouldreload = false;

  config.addCallback('emu.general', (key, value) => {
    switch (key) {
      case 'systemlang':
        win.send('set-lang', value);
        shouldreload = true;
        break;
      case 'trophyKey':
        try {
          TrophySharedConfig.setERK(value);
          shouldreload = true;
        } catch (err) {
          console.error('Failed to update trophy key: ', err.toString());
          return;
        }
    }
  });

  config.addCallback('launcher', (key, value) => {
    switch (key) {
      case 'scan_dirs':
        commandHandler('command', 'getgames');
        return;
      case 'github_token':
        updateWorker.postMessage({ act: 'set-token', token: value });
        break;
      case 'update_channel':
        updateWorker.postMessage({ act: 'set-branch', branch: value, path: emupath });
        break;
      case 'update_freq':
        updateWorker.postMessage({ act: 'set-freq', freq: value });
        break;
      case 'bg_volume':
        shouldreload = true;
        break;

      default:
        return;
    }
    updaterchanged = true;
  });

  config.addCallback('flush', () => {
    if (updaterchanged) {
      updateWorker.postMessage({ act: 'run-check', force: true });
      updaterchanged = false;
    }

    if (shouldreload) {
      /**
       * Awful hack ahead!
       * Force frontend to resend the game info so the backend will
       * resend trophies data with the new key installed, restart
       * the music player and some other things.
      */
      win.send('ingame', true);
      win.send('ingame', false);
      shouldreload = false;
    }
    config.save();
  });

  win.loadFile('webroot/index.html');
});
