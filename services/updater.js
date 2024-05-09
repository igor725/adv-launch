const { execSync } = require('child_process');
const fs = require('fs');
const https = require('follow-redirects').https;
const path = require('node:path');
const { parentPort } = require('node:worker_threads');

let update_channel = null;
let emupath = null;
let verfile = null;

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

const triggerCheck = () => {
  const binpath = searchBinary();
  if (binpath == null) {
    parentPort.postMessage({ resp: 'nobinary' });
    return;
  }

  parentPort.postMessage({ resp: 'done', executable: path.basename(binpath) });
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

  https.get(url, headers, (resp) => {
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

parentPort.on('message', (msg) => {
  switch (msg.act) {
    case 'set-branch':
      verfile = path.join(msg.path, '/version.adv');
      update_channel = msg.branch;
      emupath = msg.path;
      break;

    case 'run-check':
      triggerCheck();
      break;

    case 'download':
      // todo resolve these
      download('https://github.com/SysRay/psOff_public/releases/download/v.0.4-beta/psOff-artifact.zip', 'v.0.4-beta');
      break;
  }
});
