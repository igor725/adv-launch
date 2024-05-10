(() => {
  const wrapper = $('#wrapper');
  let saved_cfg = null;
  let modified_cfg = [{
    general: {},
    graphics: {},
    audio: {},
    controls: {}
  }, {}];

  const _isSimilar = (v1, v2) => {
    if (Array.isArray(v1)) {
      if (!Array.isArray(v2)) return false;
      for (let i = 0; i < v1.length; ++i) {
        if (!_isSimilar(v1[i], v2[i])) return false;
      }

      return true;
    } else if (typeof v1 === 'object' && v1 !== null) {
      if (typeof v2 !== 'object' || v2 === null) return false;

      for (const [key, v1_val] of Object.entries(v1)) {
        if (!_isSimilar(v1_val, v2[key])) return false;
      }

      return true;
    }

    return v1 === v2;
  };

  const haveUnsaved = () => {
    if (saved_cfg === null) return false;
    return !_isSimilar(modified_cfg, saved_cfg);
  };

  const getFacility = (elem, cfg = saved_cfg) => {
    switch (elem.dataset.cfgfacility) {
      case 'launcher':
        return cfg[1];

      case 'emu_general':
        return cfg[0].general;

      case 'emu_graphics':
        return cfg[0].graphics;

      case 'emu_audio':
        return cfg[0].audio;

      case 'emu_controls':
        return cfg[0].controls;

      default:
        return null;
    }
  };

  const getKey = (elem) => elem.dataset.cfgkey;

  const getRangeScale = (elem) => elem.dataset.cfgscale ? parseFloat(elem.dataset.cfgscale) : 1.0;

  const getOptionValue = (type, elem) => {
    switch (type) {
      case 'string': return elem.dataset.cfgvalue;
      case 'int': return parseInt(elem.dataset.cfgvalue);
      default:
        return null;
    }
  }

  const runSelectChecker = (elem, newvalue) => {
    switch (elem.dataset.cfgchecker) {
      case 'github_token':
        if (newvalue === 'nightly') {
          if (!modified_cfg[1].github_token && !saved_cfg[1].github_token) {
            if (confirm('Nightly build requires GitHub authentication! Do you want to proceed?\nThe application will open web page for token generation, you should create a fine-grained token there with whatever name and expiration date. Leave all the settings the same and just hit "Generate token" button, then copy the result token to the corresponding settings field.')) {
              window.electronAPI.sendCommand('sett-opengh');
            }

            const fac = getFacility(elem);
            const key = getKey(elem);

            for (let i = 0; i < elem.options.length; ++i) {
              if (getOptionValue(elem.dataset.cfgtype, elem.options[i]) == fac[key]) {
                elem.selectedIndex = i;
                break;
              }
            }

            return false;
          }
        }

        return true;
    }

    return true;
  };

  const refillScanDirs = (cfg = saved_cfg) => {
    const dirs = cfg[1].scan_dirs;
    const opts = [];

    for (const [path, depth] of Object.entries(dirs)) {
      opts.push(`<option data-folder="${path}">${path} | depth: ${depth}</option>`);
    }

    $('#gsd').innerHTML = opts.join('');
  };

  window.electronAPI.addEventListener('sett-values', (msg) => {
    saved_cfg = msg;
    refillScanDirs(saved_cfg);

    {
      const uselect = $('select[data-cfgkey="userIndex"]');
      const profiles = msg[0].general.profiles;
      if (profiles) {
        const opts = [];
        for (let i = 0; i < 4; ++i) {
          opts.push(`<option data-cfgvalue="${i + 1}">${profiles[i].name}</option>`);
        }
        uselect.innerHTML = opts.join('');
        uselect.disabled = '';
      }
    }

    const htels = $$('*[data-cfgfacility]');

    for (const elem of htels) {
      const fac = getFacility(elem);
      const key = getKey(elem);
      if (fac[key] === undefined) continue;
      elem.disabled = '';

      switch (elem.tagName) {
        case 'INPUT':
          switch (elem.getAttribute('type').toLowerCase()) {
            case 'range':
              elem.value = fac[key] / getRangeScale(elem);
              break;
            case 'checkbox':
              elem.checked = fac[key];
              break;
            case 'password':
            case 'text':
              elem.value = fac[key];
              break;
          }
          break;

        case 'SELECT':
          if (elem.dataset.cfgnoselect === '1') continue;
          for (let i = 0; i < elem.options.length; ++i) {
            if (getOptionValue(elem.dataset.cfgtype, elem.options[i]) == fac[key]) {
              elem.selectedIndex = i;
              break;
            }
          }
          break;
      }
    }

    wrapper.dataset.ready = 1;
  });

  wrapper.on('click', ({ target }) => {
    switch (target.tagName) {
      case 'INPUT':
        switch (target.getAttribute('type')) {
          case 'checkbox':
            getFacility(target, modified_cfg)[getKey(target)] = target.checked;
            break;
        }
        break;
    }
  }, true);

  wrapper.on('change', ({ target }) => {
    switch (target.tagName) {
      case 'SELECT':
        const fac = getFacility(target, modified_cfg);
        if (fac === null) return;
        const newvalue = getOptionValue(target.dataset.cfgtype, target.options[target.selectedIndex]);
        if (!runSelectChecker(target, newvalue)) return;
        fac[getKey(target)] = newvalue;
        break;
      case 'INPUT':
        switch (target.getAttribute('type')) {
          case 'range':
            const fac = getFacility(target, modified_cfg);
            if (fac === null) return;
            fac[getKey(target)] = target.value * getRangeScale(target);
            break;
        }
    }
  }, true);

  wrapper.on('blur', ({ target }) => {
    switch (target.tagName) {
      case 'INPUT':
        switch (target.getAttribute('type')) {
          case 'text':
          case 'password':
            const fac = getFacility(target, modified_cfg);
            if (fac === null) return;
            fac[getKey(target)] = target.value;
            break;
        }
        break;
    }
  }, true);

  $('#buttons').on('click', ({ target }) => {
    switch (target.dataset.action) {
      case 'close':
        if (!haveUnsaved() || confirm('You have unsaved settings! Are you sure you want to exit?'))
          window.close();
        break;
      case 'save':
        if (haveUnsaved())
          window.electronAPI.sendCommand('sett-update');
        else
          wrapper.dataset.ready = 0;
        break;
    }
  });

  $('#gsd-dialog').on('click', () => {
    window.electronAPI.sendCommand('sett-requestdialog');
  });

  $('#gsd-add').on('click', () => {
    const path = $('#gsd-path').value;
    if (!path) return;

    if (modified_cfg[1].scan_dirs === undefined) {
      modified_cfg[1].scan_dirs = Object.assign({}, saved_cfg[1].scan_dirs);
    }

    modified_cfg[1].scan_dirs[path] = ($('#gsd-depth').selectedIndex + 1);
    refillScanDirs(modified_cfg);
  });

  $('#gsd-remove').on('click', () => {
    const path = $('#gsd-path').value;
    if (!path) return;

    if (modified_cfg[1].scan_dirs === undefined) {
      modified_cfg[1].scan_dirs = Object.assign({}, saved_cfg[1].scan_dirs);
    }

    delete modified_cfg[1].scan_dirs[path];
    refillScanDirs(modified_cfg);
  });

  $('#gsd').on('change', ({ target }) => {
    $('#gsd-path').value = target.options[target.selectedIndex].dataset.folder;
  });

  {
    const svbtn = $('#buttons input[data-action="save"]');
    setInterval(() => {
      svbtn.disabled = haveUnsaved() ? '' : 'disabled';
    }, 600);
  }

  window.electronAPI.sendCommand('sett-request');
})();
