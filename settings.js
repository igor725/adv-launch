const fs = require('fs');
const path = require('path');

module.exports.Config = class Config {
  #cfgfile = path.join(__dirname, '/config.json');
  #default = {
    update_channel: 'release',
    github_token: '',
    bg_volume: 30,
    scan_dirs: []
  };
  #emuconfpath = null;
  #emuconf = {
    controls: null,
    graphics: null,
    general: null,
    audio: null
  };
  #unsaved = {
    launcher: false,
    emulator: false
  };
  #callbacks = [];
  #data = null;

  constructor(cp) {
    try {
      this.#data = JSON.parse(fs.readFileSync(this.#cfgfile, { encoding: 'utf-8' }));

      for (const [key, dvalue] of Object.entries(this.#default)) {
        this.#data[key] = this.#data[key] ?? dvalue;
      }
    } catch (e) {
      console.error('Failed to load the default config: ', e.toString());
      const jdata = JSON.stringify(this.#default);
      this.#data = JSON.parse(jdata);
      fs.writeFileSync(cfgfile, jdata);
    }

    if (cp !== null) {
      this.#emuconfpath = cp;
      this.reloadEmulatorSettings();
    }
  };

  getValue = (name) => {
    if (this.#default[name] == undefined) {
      console.error('Attempt to get invalid config entry: ', name);
      return null;
    }

    return typeof this.#data[name] !== 'undefined' ? this.#data[name] : this.#default[name];
  };

  setValue = (name, value) => {
    if (!this.#default[name]) {
      console.error('Attempt to set invalid config entry: ', name);
      return false;
    }

    this.#unsaved = true;

    if (value === null) {
      this.#data[name] = this.#default[name];
      return true;
    }

    this.#data[name] = value;
    return true;
  };

  getVolume = () => {
    return Math.max(0, Math.min(100, this.getValue('bg_volume')));
  };

  getBranch = () => {
    return this.getValue('update_channel');
  };

  getGitHubToken = () => {
    return this.getValue('github_token');
  };

  setGitHubToken = (token) => {
    return this.setValue('github_token', token);
  };

  getScanDirectories = () => {
    return this.getValue('scan_dirs');
  };

  getInitialUser = () => {
    if (this.#emuconf.general === null) return 1;
    return this.#emuconf.general.userIndex ?? 1;
  };

  getSysLang = () => {
    if (this.#emuconf.general === null) return 1;
    return this.#emuconf.general.systemlang ?? 1;
  };

  reloadEmulatorSettings = () => {
    if (this.#emuconfpath === null) return;

    try {
      this.#emuconf.controls = JSON.parse(fs.readFileSync(path.join(this.#emuconfpath, '/controls.json')));
    } catch (e) { }

    try {
      this.#emuconf.general = JSON.parse(fs.readFileSync(path.join(this.#emuconfpath, '/general.json')));
    } catch (e) { }

    try {
      this.#emuconf.audio = JSON.parse(fs.readFileSync(path.join(this.#emuconfpath, '/audio.json')));
    } catch (e) { }

    try {
      this.#emuconf.graphics = JSON.parse(fs.readFileSync(path.join(this.#emuconfpath, '/graphics.json')));
    } catch (e) { }
  };

  getFullConfig = () => {
    return [this.#emuconf, this.#data];
  };
};
