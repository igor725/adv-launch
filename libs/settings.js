const fs = require('node:fs');
const path = require('node:path');

module.exports.Config = class Config {
  #cfgfile = undefined;
  #default = {
    emu_path: undefined,
    update_channel: 'release',
    update_freq: 'weekly',
    inpadcolor: '#3B3E95',
    first_launch: true,
    github_token: '',
    bg_volume: 30,
    scan_dirs: {}
  };
  #emuconfpath = null;
  #emuconf = {
    controls: {},
    graphics: {},
    general: {},
    audio: {}
  };
  #unsaved = {
    launcher: false,
    emulator: {
      controls: false,
      graphics: false,
      general: false,
      audio: false
    }
  };
  #callbacks = [];
  #data = null;

  constructor(userdir) {
    this.#cfgfile = path.join(userdir, '/config.json');
    this.#default.emu_path = path.join(userdir, '/bin/emulator');

    try {
      this.#data = JSON.parse(fs.readFileSync(this.#cfgfile, { encoding: 'utf-8' }));

      for (const [key, dvalue] of Object.entries(this.#default)) {
        this.#data[key] = this.#data[key] ?? dvalue;
      }
    } catch (e) {
      console.error('[SETTINGS] Failed to load the default config: ', e.toString());
      const jdata = JSON.stringify(this.#default);
      this.#data = JSON.parse(jdata);
      fs.writeFileSync(this.#cfgfile, jdata);
    }

    const cp = path.join(this.getValue('emu_path'), '/config');

    this.#emuconfpath = {
      controls: path.join(cp, '/controls.json'),
      general: path.join(cp, '/general.json'),
      audio: path.join(cp, '/audio.json'),
      graphics: path.join(cp, '/graphics.json')
    };

    this.reloadEmulatorSettings();
  };

  getValue = (name) => {
    if (this.#default[name] === undefined) {
      console.error('[SETTINGS] Attempt to get invalid config entry: ', name);
      return null;
    }

    return typeof this.#data[name] !== 'undefined' ? this.#data[name] : this.#default[name];
  };

  getVolume = () => {
    return Math.max(0, Math.min(100, this.getValue('bg_volume')));
  };

  getScanDirectories = () => {
    return Object.entries(this.getValue('scan_dirs'));
  };

  getInitialUser = () => {
    if (this.#emuconf.general === null) return 1;
    return this.#emuconf.general.userIndex ?? 1;
  };

  getSysLang = () => {
    if (this.#emuconf.general === null) return 1;
    return this.#emuconf.general.systemlang ?? 1;
  };

  getTrophyKey = () => {
    if (this.#emuconf.general === null) return '';
    return this.#emuconf.general.trophyKey ?? '';
  };

  markLaunch = () => {
    this.#data.first_launch = false;
    this.#unsaved.launcher = true;
    this.save();
  };

  isFirstLaunch = () => {
    return this.getValue('first_launch');
  };

  reloadEmulatorSettings = () => {
    if (this.#emuconfpath === null) return;

    try {
      this.#emuconf.controls = JSON.parse(fs.readFileSync(this.#emuconfpath.controls));
    } catch (e) {
      console.error('Failed to parse emulator controls config: ', e.toString());
    }

    try {
      this.#emuconf.general = JSON.parse(fs.readFileSync(this.#emuconfpath.general));
    } catch (e) {
      console.error('Failed to parse emulator general config: ', e.toString());
    }

    try {
      this.#emuconf.audio = JSON.parse(fs.readFileSync(this.#emuconfpath.audio));
    } catch (e) {
      console.error('Failed to parse emulator audio config: ', e.toString());
    }

    try {
      this.#emuconf.graphics = JSON.parse(fs.readFileSync(this.#emuconfpath.graphics));
    } catch (e) {
      console.error('Failed to parse emulator graphics config: ', e.toString());
    }
  };

  getFullConfig = () => {
    return [this.#emuconf, this.#data];
  };

  resetValue = (key) => {
    this.#data[key] = this.#default[key];
  };

  runCallback = (facility, key, newval) => {
    const cbs = this.#callbacks;
    for (let i = 0; i < cbs.length; ++i) {
      const cb = cbs[i];
      if (cb[0] === facility && cb[1](key, newval) === false) return false;
    }

    return true;
  };

  addCallback = (facility, func) => {
    this.#callbacks.push([facility, func]);
  };

  updateMultipleKeys = (data) => {
    for (const [key, val] of Object.entries(data[1])) {
      if (this.#default[key] !== undefined) {
        if (this.runCallback('launcher', key, val)) {
          this.#data[key] = val;
          this.#unsaved.launcher = true;
        }
      }
    }

    const updateValue = (dst_obj, src_obj, key) => {
      if (typeof dst_obj[key] === 'object') {
        const dst = dst_obj[key];
        const src = src_obj[key];

        if (Array.isArray(src)) {
          if (!Array.isArray(dst)) throw new Error('Type mismatch!');
          for (let i = 0; i < src.length; ++i) {
            updateValue(dst, src, i);
          }
        } else {
          if (Array.isArray(dst)) throw new Error('Type mismatch!');
          for (const [okey] of Object.entries(src)) {
            updateValue(dst, src, okey);
          }
        }
        return;
      }

      dst_obj[key] = src_obj[key];
    };

    for (const [facility, values] of Object.entries(data[0])) {
      const fac = this.#emuconf[facility];

      for (const [key, value] of Object.entries(values)) {
        if (this.runCallback(`emu.${facility}`, key, value)) {
          this.#unsaved.emulator[facility] = true;
          updateValue(fac, values, key, values);
        }
      }
    }

    this.runCallback('flush');
  };

  save = () => {
    if (this.#unsaved.launcher) {
      try {
        fs.writeFileSync(this.#cfgfile, JSON.stringify(this.#data, null, 2));
        this.#unsaved.launcher = false;
      } catch (e) {
        console.error('[SETTINGS] Failed to save launcher config: ', e.toString());
      }
    }

    for (const [facility, unsaved] of Object.entries(this.#unsaved.emulator)) {
      if (unsaved === false) continue;

      try {
        fs.writeFileSync(this.#emuconfpath[facility], JSON.stringify(this.#emuconf[facility], null, 2));
        this.#unsaved.emulator[facility] = false;
      } catch (e) {
        console.error(`[SETTINGS] Failed to save emualtor ${facility} config: ${e.toString()}`);
      }
    }
  }
};
