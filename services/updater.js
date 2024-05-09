const { execSync } = require('child_process');
const fs = require('fs');
const https = require('follow-redirects').https;
const path = require('node:path');
const { parentPort } = require('node:worker_threads');

let update_channel = null;
let emupath = null;
let verfile = null;

const newverinfo = {
  url: '',
  tag: ''
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

const addDefaultHeaders = (headers) => Object.assign({ 'User-Agent': 'ADVL psOff/1.0', 'Accept': ['application/json'] }, headers);

const loadJSON = (url, headers = undefined) =>
  new Promise((resolve, reject) => {

    https.get(url, { headers: addDefaultHeaders(headers) }, (resp) => {
      let data = '';

      if (resp.headers['content-type'].indexOf('application/json') == -1) {
        resp.destroy('Not a josn response');
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

const triggerCheck = async () => {
  const binpath = searchBinary();

  let currver = 'v.0.0';

  if (binpath !== null) {
    try {
      currver = fs.readFileSync(verfile);
    } catch (e) { }
  }

  try {
    switch (update_channel) {
      case 'release': {
        const resp = await loadJSON('https://api.github.com/repos/SysRay/psOff_public/releases?count=1');
        if (resp[0] !== undefined) {
          const newver = resp[0].tag_name;

          if (newver != currver) {
            if (resp[0].assets && resp[0].assets[0]) {
              newverinfo.url = resp[0].assets[0].browser_download_url;
              newverinfo.tag = newver;
              if (binpath !== null) {
                parentPort.postMessage({ resp: 'available', currver, newver, executable: path.basename(binpath) });
                return;
              }
            } else {
              console.error('No assets in the latest release!');
            }
          }

          if (binpath === null) {
            parentPort.postMessage({ resp: 'nobinary', latest: newver });
            return;
          }

          parentPort.postMessage({ resp: 'done', executable: path.basename(binpath) });
          return;
        }
      } break;
    }
  } catch (e) { }

  parentPort.postMessage({ resp: 'error' });
};

const download = (url, version, headers = undefined) => {
  const fpath = path.join(emupath, `/temp${Date.now()}.zip`);
  const tempfile = fs.createWriteStream(fpath);

  tempfile.on('close', () => {
    execSync(`"${path.join(emupath, '../7z.exe')}" x -y -aoa -o"${emupath}" "${fpath}"`);
    fs.unlinkSync(fpath);
    fs.writeFileSync(verfile, version);
    parentPort.postMessage({ resp: 'done', executable: path.basename(searchBinary()) });
  });

  https.get(url, { headers: addDefaultHeaders(headers) }, (resp) => {
    const need = resp.headers['content-length'] ?? -1;
    let down = 0;

    resp.on('data', (chunk) => {
      tempfile.write(chunk);
      down += chunk.length;
      parentPort.postMessage({ resp: 'progress', value: (down / need) * 100 });
    });

    resp.on('end', () => {
      tempfile.end();
    });
  }).on('error', (err) => {
    fs.unlinkSync(fpath);
  });
};

parentPort.on('message', async (msg) => {
  switch (msg.act) {
    case 'set-branch':
      verfile = path.join(msg.path, '/version.adv');
      update_channel = msg.branch;
      emupath = msg.path;
      break;

    case 'run-check':
      await triggerCheck();
      break;

    case 'download':
      download(newverinfo.url, newverinfo.tag);
      break;
  }
});
