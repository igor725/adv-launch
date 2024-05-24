const { app, BrowserWindow, Menu, ipcMain, globalShortcut, dialog } = require('electron');
const Convert = require('ansi-to-html');
const { Worker } = require('node:worker_threads');
const { spawn, exec } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { Config } = require('./libs/settings.js');
const { Trophies, TrophySharedConfig, TrophyDataReader } = require('./libs/trophies.js');

const SCE_PIC_PATH = '/sce_sys/pic0.png';
const SCE_TROPHY_PATH = '/sce_sys/trophy/trophy00.trp';
const SCE_BGA_PATH = '/sce_sys/snd0.at9';
const LISTAUDIO_PATH = path.join(__dirname, '/bin/listaudio.exe');
const PORTABLE_PATH = path.join(__dirname, '/portable');

let win = undefined;
let player = undefined;
let config = undefined;
let gipath = undefined;
let settwin = undefined;
let gameproc = undefined;
let updateWorker = undefined;
let compatWorker = undefined;
let binname = 'psoff.exe';

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
    if (compatWorker && !msg.ispatch) compatWorker.postMessage({ act: 'request_status', gid: msg.id });
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
    const emupath = config.getValue('emu_path');
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
  exec(`"${binname}" -h`, { cwd: config.getValue('emu_path') }).on('close', (code) => {
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
      compatWorker.postMessage({ act: 'request', gid: info.gid });
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
      settwin = new BrowserWindow({
        parent: win,
        frame: false,
        resizable: false,
        show: false,
        backgroundColor: '#252525',
        modal: true,
        width: 400,
        height: 400,
        webPreferences: {
          preload: path.join(__dirname, 'preload.js')
        }
      });
      settwin.once('ready-to-show', () => settwin.show());
      settwin.on('closed', () => {
        settwin = null;
      });
      settwin.loadFile('webroot/settings.html');
      settwin.webContents.once('did-finish-load', () => settwin.send('set-lang', config.getSysLang()));
      break;
    case 'openfolder':
      spawn('explorer', [info]);
      break;
    case 'openissue':
      if (info > 0)
        exec(`start https://github.com/SysRay/psOff_compatibility/issues/${info}`);
      break;
    case 'applypatch':
      updateGameSummary(info.gid, { patch: info.patch });
      break;
    case 'rungame':
      if (info.dblclick && !config.getValue('dblcl_run')) {
        if (config.getValue('dblcl_ask')) {
          win.send('warnmsg', {
            hidden: false, type: 'text', id: 'dbl-warn',
            text: '{$tr:main.actions.dblrun}', buttons: ['{$tr:buttons.no}', '{$tr:buttons.ye}']
          });
        }
        return;
      }

      if (gameproc != null) {
        genericWarnMsg('{$tr:main.actions.alrun}', true);
        return;
      }
      win.send('ingame', true);
      const emuargs = [`--file=${info.path}\\eboot.bin`];
      const patch = getGameSummary(info, false).patch;
      if (patch) emuargs.push(`--update=${patch}`);

      const emupath = config.getValue('emu_path');
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

        case 'dbl-warn':
          win.send('warnmsg', { hidden: true, id: 'dbl-warn' });
          config.updateMultipleKeys([{}, { dblcl_run: info.resp === 1, dblcl_ask: false }]);
          break;

        case 'first-launch':
          config.markLaunch();
          win.send('warnmsg', { hidden: true, id: 'first-launch' });

          if (info.resp === 1) {
            win.send('run-tutorial');
          }
          break;

        default:
          console.error('Unhandled warnmsg action: ', info.id);
          break;
      }
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

const main = (userdir = __dirname) => {
  fs.mkdirSync(userdir, { recursive: true });
  config = new Config(userdir);

  const emupath = config.getValue('emu_path');

  gipath = path.join(userdir, '/gameinfo');
  fs.mkdirSync(gipath, { recursive: true });

  try {
    const testfile = path.join(emupath, '/test');
    fs.mkdirSync(emupath, { recursive: true });
    fs.writeFileSync(testfile, 'test');
    fs.unlinkSync(testfile);
  } catch (e) {
    console.error('Emulator directory is not writeable anymore, resetting to default one: ', e.toString());
    config.resetValue('emu_path');
  }

  ipcMain.on('command', commandHandler);

  ipcMain.handle('reqcfg', () => config.getFullConfig());

  ipcMain.handle('reqadev', () => new Promise((resolve, reject) => {
    exec(`"${LISTAUDIO_PATH}"`, { cwd: emupath }, (err, stdout) => {
      if (err) return reject(err);
      resolve(JSON.parse(stdout));
    });
  }));

  ipcMain.handle('opendir', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
    if (canceled) throw 'cancelled';
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
        type: 'normal',
        enabled: false,
        label: data.gtitle
      },
      {
        type: 'normal',
        label: 'Open game folder',
        click: () => commandHandler('command', 'openfolder', data.gpath)
      },
      {
        type: 'normal',
        label: 'Create desktop shortcut',
        click: () => {
          const scrpath = path.join(process.env.TEMP, '/psoff_link.vbs');
          const arguments = [
            `--file=""${data.gpath}\\eboot.bin""`
          ];
          if (currpatch) arguments.push(`--update=""${currpatch}""`);
          fs.writeFileSync(scrpath, `
            Set oWS = WScript.CreateObject("WScript.Shell")
            strDesktop = oWS.SpecialFolders("Desktop")
            Set oLink = oWS.CreateShortcut(strDesktop + "\\${data.gtitle.replace(/[/\\?%*:|"<>]/g, ' ')}.lnk")
            oLink.TargetPath = "${config.getValue('emu_path')}\\${binname}"
            oLink.WorkingDirectory = "${config.getValue('emu_path')}"
            ' oLink.IconLocation = "${data.gpath}\\sce_sys\\icon0.png"
            oLink.Arguments = "${arguments.join(' ')}"
            oLink.Save
          `);
          const cp = exec(`cscript "${scrpath}"`);
          cp.on('close', () => fs.unlinkSync(scrpath));
        }
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
      popupdata[3].submenu.push({
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
    width: 1030,
    height: 580,
    minWidth: 1030,
    minHeight: 580,
    show: false,
    frame: false,
    webPreferences: {
      allowRunningInsecureContent: false,
      nodeIntegrationInWorker: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.setAspectRatio(16 / 9);

  win.once('ready-to-show', () => win.show());

  let currcols = 2;
  win.on('resize', (ev) => {
    const newcols = Math.floor(win.getSize()[0] / 500);
    if (newcols != currcols) win.send('set-glcols', currcols = newcols);
  });

  win.webContents.once('did-finish-load', () => {
    updateWorker = new Worker(path.join(__dirname, '/services/updater.js'));
    compatWorker = new Worker(path.join(__dirname, '/services/gametags.js'));

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

    compatWorker.on('message', (msg) => {
      switch (msg.resp) {
        case 'gametags':
          win.send('set-gtags', msg);
          break;
        case 'gamestatus':
          win.send('set-gstatus', msg);
          break;
      }
    });

    {
      let token;
      if (token = config.getValue('github_token')) updateWorker.postMessage({ act: 'set-token', token: token });
      compatWorker.postMessage({ act: 'init', udir: userdir, token: token ?? undefined });
    }

    try {
      let erk;
      if (erk = config.getTrophyKey()) TrophySharedConfig.setERK(erk);
    } catch (err) {
      console.error('Failed to set trophy key: ', err.toString());
    }

    const sendLang = () => win.send('set-lang', config.getSysLang());

    sendLang();
    ipcMain.on('reset-lang', () => sendLang());
    updateWorker.postMessage({ act: 'set-path', path: emupath });
    updateWorker.postMessage({ act: 'set-branch', branch: config.getValue('update_channel') });
    updateWorker.postMessage({ act: 'set-freq', freq: config.getValue('update_freq') });
    updateWorker.postMessage({ act: 'run-check', force: false });
  });

  let updaterchanged = false, shouldreload = false, reqrestart = false;

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
      case 'emu_path':
        try {
          const testfile = path.join(value, '/test');
          fs.mkdirSync(value, { recursive: true });
          fs.writeFileSync(testfile, 'test');
          fs.unlinkSync(testfile);
          reqrestart = true;
        } catch (e) {
          genericWarnMsg('Failed to change the emulator path: ' + e.toString());
          return false;
        }

        return true;
      case 'update_channel':
        updateWorker.postMessage({ act: 'set-branch', branch: value });
        break;
      case 'update_freq':
        updateWorker.postMessage({ act: 'set-freq', freq: value });
        break;
      case 'bg_volume':
        shouldreload = true;
        return;

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

    if (reqrestart) {
      genericWarnMsg('{$tr:main.actions.reqrst}');
    }

    config.save();
  });

  win.loadFile('webroot/index.html');
};

const guessLaunch = () => {
  if (fs.readFileSync(PORTABLE_PATH).readUint8(0) === 1) { // portable
    return main();
  }

  return main(path.join(process.env.LOCALAPPDATA, '/psoff-advlaunch/'));
};

app.whenReady().then(() => {
  try {
    guessLaunch();
  } catch (e) {
    if (e.code === 'ENOENT') {
      const portask = new BrowserWindow({
        width: 550,
        height: 154,
        resizable: false,
        show: false,
        frame: false,
        webPreferences: {
          allowRunningInsecureContent: false,
          preload: path.join(__dirname, 'preload.js')
        }
      });

      ipcMain.once('set-portable', (ev, value) => {
        fs.writeFileSync(PORTABLE_PATH, value ? '\x01' : '\x00');
      });

      portask.once('ready-to-show', () => portask.show());
      portask.on('closed', () => guessLaunch());

      portask.loadFile('webroot/portable.html');
      return;
    }

    // Rethrow if something else errored
    throw e;
  }
});
