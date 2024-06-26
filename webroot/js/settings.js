window._onLangReady = (() => {
  const wrapper = $('#wrapper');
  const gsd = $('#gsd');

  let saved_cfg = null;
  let modified_cfg = [{
    general: {},
    graphics: {},
    audio: { padspeakers: [] },
    controls: {
      keybinds: {},
      pads: [{}, {}, {}, {}]
    }
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

  const getArrayIndex = (elem) => parseInt(elem.dataset.cfgarridx);

  const getInnerObjKey = (elem) => elem.dataset.cfginkey;

  const getRangeScale = (elem) => elem.dataset.cfgscale ? parseFloat(elem.dataset.cfgscale) : 1.0;

  const getOptionValue = (type, elem) => {
    switch (type) {
      case 'string': return elem.dataset.cfgvalue;
      case 'int': return parseInt(elem.dataset.cfgvalue);
      default: return null;
    }
  }

  const runSelectChecker = (elem, newvalue) => {
    switch (elem.dataset.cfgchecker) {
      case 'github_token':
        if (newvalue === 'nightly') {
          if (!modified_cfg[1].github_token && !saved_cfg[1].github_token) {
            if (confirm(window.trAPI.get('settings.alerts.ghtoken'))) {
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
      if (typeof depth !== 'number') continue;
      opts.push(`<option data-folder="${path}">${path} | depth: ${depth}</option>`);
    }

    gsd.innerHTML = opts.join('');
  };

  window.electronAPI.requestConfig().then(async (msg) => {
    saved_cfg = msg;
    refillScanDirs(saved_cfg);

    await window.electronAPI.requestAudioDevices().then((list) => {
      const htels = [];

      for (let i = 0; i < list.length; ++i) {
        htels.push(`<option data-cfgvalue="${list[i]}">${list[i]}</option>`);
      }

      $('#madevice').innerHTML = htels.join();
    });

    {
      const uselect = $('select[data-cfgkey="userIndex"]');
      const inusers = $('#inusers');

      const profiles = msg[0].general.profiles;
      const pads = msg[0].controls.pads;

      if (profiles) {
        const opts = [], inbacks = [];
        for (let i = 0; i < 4; ++i) {
          opts.push(`<option data-cfgvalue="${i + 1}">${profiles[i].name}</option>`);
          inbacks.push(`
          <div class="user">
            <label>${profiles[i].name}</label>
            <select
              data-cfgfacility="emu_controls"
              data-cfgkey="pads"
              data-cfghint="arrobj"
              data-cfgarridx="${i}"
              data-cfginkey="type"
              data-cfgtype="string"
            >
              <option data-cfgvalue="sdl"}>SDL2</option>
              <option data-cfgvalue="xinput"}>XInput</option>
              <option data-cfgvalue="keyboard"}>Keyboard</option>
            </select>
            <select
              data-cfgfacility="emu_audio"
              data-cfgkey="padspeakers"
              data-cfghint="arr"
              data-cfgarridx="${i}"
              data-cfgtype="string"
            >${$('#madevice').innerHTML}</select>
          </div>`);
        }
        inusers.innerHTML = inbacks.join('');
        uselect.innerHTML = opts.join('');
        uselect.disabled = '';
      }
    }

    const htels = $$('*[data-cfgfacility]');

    for (const elem of htels) {
      const fac = getFacility(elem);
      const key = getKey(elem);
      if (fac[key] === undefined) {
        elem.title = window.trAPI.get('settings.alerts.unavail');
        continue;
      }
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
          switch (elem.dataset.cfghint) {
            case 'arrobj': {
              const idx = getArrayIndex(elem);
              const innkey = getInnerObjKey(elem);
              for (let i = 0; i < elem.options.length; ++i) {
                if (getOptionValue(elem.dataset.cfgtype, elem.options[i]) === fac[key][idx][innkey]) {
                  elem.selectedIndex = i;
                  break;
                }
              }
            } break;
            case 'arr': {
              const idx = getArrayIndex(elem);
              for (let i = 0; i < elem.options.length; ++i) {
                if (getOptionValue(elem.dataset.cfgtype, elem.options[i]) == fac[key][idx]) {
                  elem.selectedIndex = i;
                  break;
                }
              }
            } break;

            default: {
              for (let i = 0; i < elem.options.length; ++i) {
                if (getOptionValue(elem.dataset.cfgtype, elem.options[i]) == fac[key]) {
                  elem.selectedIndex = i;
                  break;
                }
              }
            } break;
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
      case 'BUTTON':
        if (target.getAttribute('id') === 'ctlsett') {
          const cwin = window.open('./controller.html', '_blank', 'frame=false,width=900,height=625');
          cwin._keybinds = [saved_cfg[0].controls.keybinds, modified_cfg[0].controls.keybinds];
          cwin._updatepadcolor = (color) => modified_cfg[1].inpadcolor = color;
          cwin._currpadcolor = modified_cfg[1].inpadcolor ?? saved_cfg[1].inpadcolor;
        }
        break;
    }
  }, true);

  wrapper.on('change', ({ target }) => {
    const fac = getFacility(target, modified_cfg);
    if (fac === null) return;

    switch (target.tagName) {
      case 'SELECT':
        const key = getKey(target);
        switch (target.dataset.cfghint) {
          case 'arrobj': {
            const idx = getArrayIndex(target);
            const innkey = getInnerObjKey(target);
            fac[key][idx][innkey] = getOptionValue(target.dataset.cfgtype, target.options[target.selectedIndex]);
          } break;
          case 'arr': {
            const idx = getArrayIndex(target);
            fac[key][idx] = getOptionValue(target.dataset.cfgtype, target.options[target.selectedIndex]);
          } break;
          default: {
            const newvalue = getOptionValue(target.dataset.cfgtype, target.options[target.selectedIndex]);
            if (!runSelectChecker(target, newvalue)) return;
            fac[key] = newvalue;
          } break;
        }
        break;
      case 'INPUT':
        switch (target.getAttribute('type')) {
          case 'range':
            fac[getKey(target)] = target.value * getRangeScale(target);
            $('#rangevalue').style.display = null;
            break;
        }
    }
  }, true);

  wrapper.on('input', ({ target }) => {
    switch (target.tagName) {
      case 'INPUT':
        switch (target.getAttribute('type')) {
          case 'text':
          case 'password':
            const fac = getFacility(target, modified_cfg);
            if (fac === null) return;
            fac[getKey(target)] = target.value;
            break;

          case 'range': {
            const rv = $('#rangevalue');
            const tb = target.getBoundingClientRect();
            rv.style.display = 'block';
            rv.style.top = `${tb.top - 15}px`;
            rv.style.left = `${tb.left + (target.value / target.max) * tb.width - 25}px`;
            rv.innerText = target.value;
          } break;
        }
        break;


    }
  }, true);

  $('#buttons').on('click', ({ target }) => {
    switch (target.dataset.action) {
      case 'close':
        if (!haveUnsaved() || confirm(window.trAPI.get('settings.alerts.unsaved')))
          window.close();
        break;
      case 'save':
        if (haveUnsaved()) {
          let haskb = false;
          const spks = modified_cfg[0].audio.padspeakers;

          for (let i = 0; i < 4; ++i) {
            if (modified_cfg[0].controls.pads[i].type === 'keyboard') {
              if (haskb) {
                if (!confirm(window.trAPI.get('settings.alerts.multiplekb'))) return;
                break;
              }
              haskb = true;
            }

            if (spks.length > 0 && spks[i] === undefined) {
              modified_cfg[0].audio.padspeakers[i] = null;
            }
          }
          window.electronAPI.sendCommand('sett-update', modified_cfg);
          wrapper.dataset.ready = 0;
        }
        break;
    }
  });

  wrapper.on('click', ({ target }) => {
    switch (target.id) {
      case 'gsd-add': {
        const path = $('#gsd-path').value;
        if (!path) return;

        if (modified_cfg[1].scan_dirs === undefined) {
          modified_cfg[1].scan_dirs = Object.assign({}, saved_cfg[1].scan_dirs);
        }

        modified_cfg[1].scan_dirs[path] = ($('#gsd-depth').selectedIndex + 1);
        refillScanDirs(modified_cfg);
      } break;

      case 'gsd-remove': {
        const path = $('#gsd-path').value;
        if (!path) return;

        if (modified_cfg[1].scan_dirs === undefined) {
          modified_cfg[1].scan_dirs = Object.assign({}, saved_cfg[1].scan_dirs);
        }

        /**
         * If we want _isSimilar to return valid result then this object
         * should not change its size and loose keys, so delete is not an
         * option there. Making object's value undefined has no side effects
         * as it seems. JSON will not save undefined keys, but it's still there
         * for _isSimilar.
        */
        modified_cfg[1].scan_dirs[path] = undefined;
        refillScanDirs(modified_cfg);
      } break;

      case 'forceupd': {
        window.electronAPI.sendCommand('sett-forceupg');
        window.close();
      } break;

      default: {
        const elemid = target.dataset.setpathto;
        if (!elemid) return;
        window.electronAPI.selectFolder().then((path) => {
          const elem = document.getElementById(elemid);
          elem.value = path;
          elem.dispatchEvent(new Event('input', { bubbles: true }));
        });
      } break;
    }

  }, true);

  gsd.on('change', ({ target }) => {
    $('#gsd-path').value = target.options[target.selectedIndex].dataset.folder;
  });

  gsd.on('blur', () => gsd.selectedIndex = -1);

  {
    const svbtn = $('#buttons button[data-action="save"]');
    setInterval(() => {
      svbtn.disabled = haveUnsaved() ? '' : 'disabled';
    }, 600);
  }
});
