const fs = require('fs');
const path = require('path');

const cfgfile = path.join(__dirname, '/config.json');

const config = {
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
  const data = JSON.stringify(config.data);
  config.json = JSON.parse(data);
  fs.writeFileSync(cfgfile, data);
}

config.getValue = (name) => {
  if (!config.default[name]) {
    console.error('Attempt to get ')
    return null;
  }
};

config.getVolume = () => { };

module.exports = config;
