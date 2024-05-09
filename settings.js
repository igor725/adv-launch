const fs = require('fs');
const path = require('path');

const config = {
  default: {
    update_channel: 'release',
    bg_volume: 30,
    scan_dirs: []
  }
};

try {
  const data = fs.readFileSync(path.join(__dirname, '/config.json'), { encoding: 'utf-8' });
  config.json = JSON.parse(data);
} catch (e) {
  console.error('Failed to load the default config: ', e.toString());
}

module.exports = config;
