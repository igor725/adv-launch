const { execSync } = require('node:child_process');
const fs = require('node:fs');
const https = require('follow-redirects').https;
const path = require('node:path');
const { parentPort } = require('node:worker_threads');

let update_channel = undefined;
let atoken = undefined;
let emupath = undefined;
let verfile = undefined;
let freq = undefined;

const newverinfo = {
  url: '',
  tag: ''
};

const updateVersionFile = (version) => {
  try {
    fs.writeFileSync(verfile, JSON.stringify({ version: version, lastcheck: Date.now() }));
  } catch (e) {
    console.error('[UPDATER] Failed to save current version info: ', e.toString());
  }
};

const searchBinary = () => {
  let binpath = null;

  try {
    binpath = path.join(emupath, '/psoff.exe');
    if (fs.lstatSync(binpath).isFile()) return binpath;
  } catch (e) { }

  try { // Deprecated name, this check will be deleted after v.0.5 gets released
    binpath = path.join(emupath, '/emulator.exe');
    if (fs.lstatSync(binpath).isFile()) return binpath;
  } catch (e) { }

  return null;
};

const addDefaultHeaders = (headers) => {
  const defheaders = { 'User-Agent': 'ADVL psOff/1.0' };
  if (atoken) defheaders.Authorization = `Bearer ${atoken}`;
  return Object.assign(defheaders, headers);
};

const sendExecutable = (binpath, currver) => {
  if (!binpath) {
    parentPort.postMessage({ resp: 'nobinary', latest: newverinfo.tag });
    return;
  } else if (newverinfo.tag !== '') {
    parentPort.postMessage({ resp: 'available', currver, newver: newverinfo.tag, executable: path.basename(binpath) });
    return;
  }

  parentPort.postMessage({ resp: 'done', executable: path.basename(binpath) });
}

const loadJSON = (url, headers = undefined) =>
  new Promise((resolve, reject) => {
    const jheaders = { 'Accept': ['application/vnd.github+json'] };
    https.get(url, { headers: addDefaultHeaders(Object.assign(jheaders, headers)) }, (resp) => {
      let data = '';

      if (resp.headers['content-type'].indexOf('application/json') == -1) {
        resp.destroy('Not a json response');
        return;
      }

      resp.on('data', (chunk) => {
        data += chunk;
      });

      resp.on('end', () => {
        resolve(JSON.parse(data));
      });
    }).on('error', (err) => {
      reject(err);
    });
  });

const triggerCheck = async (force) => {
  const binpath = searchBinary();

  let currver = 'v.0.0';
  newverinfo.url = newverinfo.tag = '';

  if (binpath) {
    try {
      const vinfo = JSON.parse(fs.readFileSync(verfile));

      if (force == false && freq) {
        let next = 0;

        switch (freq) {
          case 'daily':
            next = 86400000;
            break;
          case 'weekly':
            next = 604800000;
            break;
          case 'monthly':
            next = 2592000000;
            break;
        }

        if (Date.now() < (vinfo.lastcheck + next)) {
          console.error('[UPDATER] Skipping update check, this is not the time for updates');
          sendExecutable(binpath, currver);
          return;
        }
      }

      currver = vinfo.version;
    } catch (e) {
      console.error('[UPDATER] Failed to get the installed emulator version');
    }
  }

  try {
    switch (update_channel) {
      case 'release': {
        const resp = await loadJSON('https://api.github.com/repos/SysRay/psOff_public/releases?count=1');
        if (resp[0]) {
          const newver = resp[0].tag_name;

          if (newver != currver) {
            if (resp[0].assets && resp[0].assets[0]) {
              newverinfo.url = resp[0].assets[0].browser_download_url;
              newverinfo.tag = newver;
            } else {
              throw new Error('No assets in the latest release!');
            }
          }
        } else {
          throw new Error(`REST /releases failed: ${resp.message}`);
        }
      } break;
      case 'nightly': {
        if (!atoken) {
          parentPort.postMessage({ resp: 'notoken', executable: path.basename(binpath) });
          return;
        }

        const resp = await loadJSON('https://api.github.com/repos/SysRay/psOff_public/actions/runs?per_page=1&branch=features&status=completed');
        if (resp.total_count > 0) {
          const run = resp.workflow_runs[0];
          const newver = run.id;

          if (newver != currver) {
            newverinfo.url = '_' + run.artifacts_url;
            newverinfo.tag = newver.toString();
          }
        } else {
          throw new Error(`REST /actions failed: ${resp.message}`);
        }
      } break;
    }
  } catch (err) {
    sendExecutable(binpath, currver);
    throw err;
  }

  updateVersionFile(currver);
  sendExecutable(binpath, currver);
};

const download = async (url, version, headers = undefined) => {
  if (update_channel == 'nightly' && url.startsWith('_')) {
    const resp = await loadJSON(url.substring(1));
    if (resp.total_count > 0) {
      const art = resp.artifacts[0];
      if (art.expired) {
        throw new Error('Nightly artifact expired!');
      }

      return download(art.archive_download_url, version, headers);
    }

    throw new Error(`REST /artifacts failed: ${resp.message}`);
  }

  execSync('del temp*.zip', { cwd: emupath });

  const fpath = path.join(emupath, `/temp${Date.now()}.zip`);
  const tempfile = fs.createWriteStream(fpath);

  return new Promise((resolve, reject) => {
    https.get(url, { headers: addDefaultHeaders(headers) }, (resp) => {
      const need = resp.headers['content-length'] ?? -1;
      let down = 0;

      resp.on('data', (chunk) => {
        tempfile.write(chunk);
        down += chunk.length;
        parentPort.postMessage({ resp: 'progress', value: (down / need) * 100 });
      });

      resp.on('end', () => {
        tempfile.on('finish', () => resolve({ fpath, version }));
        tempfile.end();
      });
    }).on('error', (err) => {
      tempfile.on('finish', () => {
        fs.unlinkSync(fpath);
        reject(err);
      })
      tempfile.end();
    });
  });
};

const validateEmulatorPath = () => {
  if (!emupath) throw new Error('No emulator path installed!');
  if (!fs.lstatSync(emupath).isDirectory()) throw new Error('Emulator path is not a directory!');
};

const commandHandler = async (msg) => {
  try {
    switch (msg.act) {
      case 'set-path':
        verfile = path.join(msg.path, '/version.adv');
        emupath = msg.path;
        validateEmulatorPath();
        break;
      case 'set-branch':
        update_channel = msg.branch;
        break;

      case 'set-token':
        atoken = msg.token;
        break;

      case 'set-freq':
        freq = msg.freq;
        break;

      case 'run-check':
        validateEmulatorPath();
        await triggerCheck(msg.force);
        break;

      case 'download':
        validateEmulatorPath();
        await download(newverinfo.url, newverinfo.tag).then(({ fpath, version }) => {
          let attempt = 0;
          let int;

          int = setInterval(() => {
            ++attempt;
            try {
              execSync('del *.dll *.exe', { cwd: emupath });
              execSync(`"${path.join(__dirname, '../bin/7z.exe')}" x -y -aoa -o"${emupath}" "${fpath}"`);
              parentPort.postMessage({ resp: 'done', executable: path.basename(searchBinary()) });
            } catch (e) {
              if (attempt > 9) {
                clearInterval(int);
                parentPort.postMessage({ resp: 'error', text: e.toString() });
              }
              console.log('Attempt', attempt, 'failed: ', e.toString());
              return;
            }

            updateVersionFile(version);
            fs.unlinkSync(fpath);
            clearInterval(int);
          }, 700);

        });
        break;

      case 'retry':
        if (!newverinfo.tag || !newverinfo.url) {
          await commandHandler({ act: 'run-check' });
        } else {
          await commandHandler({ act: 'download' });
        }
        break;

      default:
        console.error('[UPDATER] Unhandled command ', msg.act);
        break;
    }
  } catch (err) {
    parentPort.postMessage({ resp: 'error', text: err.toString() });
  }
};

parentPort.on('message', commandHandler);
