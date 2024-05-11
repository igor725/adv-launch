const fs = require('fs');
const path = require('node:path');
const { parentPort } = require('node:worker_threads');

const applist = {
  gd: true,
  gp: true
};

const readSFO = (buffer) => {
  if (1104986460160n != buffer.readBigUInt64LE(0)) {
    console.error('Invalid magic!');
    return null;
  }

  const namesOffset = buffer.readUInt32LE(8);
  const valuesOffset = buffer.readUInt32LE(12);
  const numParams = buffer.readUInt32LE(16);

  const params = [];
  let offset = 20;
  for (let i = 0; i < numParams; ++i) {
    const data = buffer.subarray(offset, offset += 16);

    const param = params[i] = {
      type: data.readUInt16LE(2),
      size1: data.readUInt32LE(4),
      size2: data.readUInt32LE(8),
      nameOffset: data.readUInt16LE(0),
      valueOffset: data.readUInt32LE(12)
    };

    if (param.type != 0x0204 && param.type != 0x0404) {
      console.error('Unknown param.sfo type', param.type);
      return null;
    }
  }

  const zeroString = (buffer, offset) => {
    let end = offset;
    while (buffer[end] != 0) ++end;
    return buffer.toString('utf-8', offset, end);
  };

  const namesList = buffer.subarray(namesOffset, namesOffset + (valuesOffset - namesOffset));
  const paramsList = {};
  offset = namesOffset;
  for (let i = 0; i < numParams; ++i) {
    const param = params[i];
    const name = zeroString(namesList, param.nameOffset);

    if (param.type == 0x0404) {
      paramsList[name] = buffer.readUInt32LE(valuesOffset + param.valueOffset);
    } else if (param.type == 0x0204) {
      paramsList[name] = zeroString(buffer, valuesOffset + param.valueOffset);
    }
  }

  return paramsList;
};

const walker = (wpath, ents, depth, maxdepth) => {
  if (depth > maxdepth) return;

  ents.forEach((name) => {
    const fullpath = path.join(wpath, name);
    const stat = fs.lstatSync(fullpath);
    if (stat.isDirectory()) {
      walker(fullpath, fs.readdirSync(fullpath), depth + 1, maxdepth)
    } else if (stat.isFile()) {
      if (name == 'eboot.bin') {
        const syspath = path.join(wpath, '/sce_sys');
        const paramsfopath = path.join(syspath, '/param.sfo');
        let paramsfostat = null;

        try {
          paramsfostat = fs.lstatSync(paramsfopath);
        } catch (e) {
          console.error(`Failed to stat param.sfo: ${e.toString()}`);
          return;
        }

        if (paramsfostat.isFile()) {
          const sfo_data = readSFO(fs.readFileSync(paramsfopath));
          let icon = null;

          try {
            icon = fs.readFileSync(path.join(syspath, '/icon0.png'), { encoding: 'base64' });
          } catch (e) { }

          if (applist[sfo_data.CATEGORY]) {
            parentPort.postMessage({
              id: sfo_data.TITLE_ID,
              title: sfo_data.TITLE,
              version: sfo_data.APP_VER,
              ispatch: sfo_data.CATEGORY === 'gp',
              path: wpath,
              icon: icon
            });
          }
        }
      }
    }
  });
}

parentPort.on('message', (msg) => {
  switch (msg.act) {
    case 'scangdir':
      walker(msg.path, fs.readdirSync(msg.path), 0, msg.depth);
      process.exit(0);
      break;
  }
});
