const fs = require('fs');
const path = require('path');

const cfgfile = path.join(__dirname, '/config.json');

const config = {
  unsaved: false,
  callbacks: [],
  default: {
    update_channel: 'release',
    bg_volume: 30,
    scan_dirs: []
  }
};

try {
  const data = fs.readFileSync(cfgfile, { encoding: 'utf-8' });
  config.json = JSON.parse(data);
} catch (e) {
  console.error('Failed to load the default config: ', e.toString());
  const data = JSON.stringify(config.default);
  config.json = JSON.parse(data);
  fs.writeFileSync(cfgfile, data);
}

config.getValue = (name) => {
  if (!config.default[name]) {
    console.error('Attempt to get invalid config entry: ', name);
    return null;
  }

  return typeof config.json[name] !== 'undefined' ? config.json[name] : config.default[name];
};

config.setValue = (name, value) => {
  if (!config.default[name]) {
    console.error('Attempt to set invalid config entry: ', name);
    return null;
  }

  if (value === null) {
    config.json[name] = config.default[name];
    config.unsaved = true;
  }
};

config.getVolume = () => {
  return Math.max(0, Math.min(100, config.getValue('bg_volume')));
};

config.getBranch = () => {
  return config.getValue('update_channel');
};

module.exports = config;
