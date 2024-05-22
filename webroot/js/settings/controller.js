(() => {
  const trAPI = window.opener.trAPI;
  const ctl_modified = {};
  const _keybinds = window._keybinds;
  delete window._keybinds;
  if (!_keybinds) {
    alert('You should not reload this page under any circumstances!');
    window.close();
    return;
  }

  const savebtn = $('#buttons [data-action="save"]');
  const resetbtn = $('#buttons [data-action="reset"]');
  const isOldVer = _keybinds[0]['controller.options'] === undefined;

  if (Object.keys(_keybinds[1]).length > 0) {
    savebtn.disabled = '';
    resetbtn.disabled = '';
    for (const [act, key] of Object.entries(_keybinds[1])) {
      ctl_modified[act] = key;
    }
  }

  const keymap = {
    "KeyA": "A",
    "KeyB": "B",
    "KeyC": "C",
    "KeyD": "D",
    "KeyE": "E",
    "KeyF": "F",
    "KeyG": "G",
    "KeyH": "H",
    "KeyI": "I",
    "KeyJ": "J",
    "KeyK": "K",
    "KeyL": "L",
    "KeyM": "M",
    "KeyN": "N",
    "KeyO": "O",
    "KeyP": "P",
    "KeyQ": "Q",
    "KeyR": "R",
    "KeyS": "S",
    "KeyT": "T",
    "KeyU": "U",
    "KeyV": "V",
    "KeyW": "W",
    "KeyX": "X",
    "KeyY": "Y",
    "KeyZ": "Z",
    "Digit1": "1",
    "Digit2": "2",
    "Digit3": "3",
    "Digit4": "4",
    "Digit5": "5",
    "Digit6": "6",
    "Digit7": "7",
    "Digit8": "8",
    "Digit9": "9",
    "Digit0": "0",
    "Enter": "Return",
    "Escape": "Escape",
    "Backspace": "Backspace",
    "Tab": "Tab",
    "Space": "Space",
    "Minus": "-",
    "Equal": "=",
    "BracketLeft": "[",
    "BracketRight": "]",
    "Backslash": "\\",
    "Semicolon": ";",
    "Quote": "'",
    "Backquote": "`",
    "Comma": ",",
    "Period": ".",
    "Slash": "/",
    "CapsLock": "CapsLock",
    "F1": "F1",
    "F2": "F2",
    "F3": "F3",
    "F4": "F4",
    "F5": "F5",
    "F6": "F6",
    "F7": "F7",
    "F8": "F8",
    "F9": "F9",
    "F10": "F10",
    "F11": "F11",
    "F12": "F12",
    "ScrollLock": "Pause",
    "Pause": "Pause",
    "Insert": "Insert",
    "Home": "Home",
    "PageUp": "PageUp",
    "Delete": "Delete",
    "End": "End",
    "PageDown": "PageDown",
    "ArrowRight": "Right",
    "ArrowLeft": "Left",
    "ArrowDown": "Down",
    "ArrowUp": "Up",
    "NumLock": "Numlock",
    "NumpadDivide": "Keypad /",
    "NumpadMultiply": "Keypad *",
    "NumpadSubtract": "Keypad -",
    "NumpadAdd": "Keypad +",
    "NumpadEnter": "Keypad Enter",
    "Numpad1": "Keypad 1",
    "Numpad2": "Keypad 2",
    "Numpad3": "Keypad 3",
    "Numpad4": "Keypad 4",
    "Numpad5": "Keypad 5",
    "Numpad6": "Keypad 6",
    "Numpad7": "Keypad 7",
    "Numpad8": "Keypad 8",
    "Numpad9": "Keypad 9",
    "Numpad0": "Keypad 0",
    "NumpadDecimal": "Keypad .",
    "VolumeUp": "VolumeUp",
    "VolumeDown": "VolumeDown",
    "ControlLeft": "Left Ctrl",
    "ShiftLeft": "Left Shift",
    "AltLeft": "Left Alt",
    "ControlRight": "Right Ctrl",
    "ShiftRight": "Right Shift",
    "AltRight": "Right Alt",
    "MediaTrackNext": "AudioNext",
    "MediaTrackPrevious": "AudioPrev",
    "MediaPlayPause": "AudioPlay",
    "VolumeMute": "AudioMute"
  };

  const resolveSDLKey = (key) => keymap[key];

  $('#buttons').on('click', ({ target }) => {
    switch (target.dataset.action) {
      case 'save':
        for (const [action, key] of Object.entries(ctl_modified)) {
          _keybinds[1][action] = key;
        }
        window.close();
        break;
      case 'reset':
        Object.keys(_keybinds[1]).forEach(key => { delete _keybinds[1][key]; });
        Object.keys(ctl_modified).forEach(key => { delete ctl_modified[key]; });
        resetbtn.disabled = 'disabled';
        savebtn.disabled = 'disabled';
        break;
      case 'exit':
        window.close();
        break;
    }
  });

  const doc = document.createElement('object');
  doc.onload = () => {
    const dcd = doc.contentDocument;
    const shouldfill = Array.from(dcd.querySelectorAll('#dualshock4 path'))
      .filter((path) => path.getAttribute('fill') === '#3B3E95');
    const buttons = dcd.querySelectorAll('[data-btn]');
    const overlay = $('#controller .overlay');
    const canvas = $('#colorpick');

    dcd.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      canvas.style.display = 'block';
      canvas.style.left = `${ev.clientX - 100}px`;
      canvas.style.top = `${ev.clientY - 100}px`;
    });

    canvas.on('mouseout', () => {
      canvas.style.display = null;
    });

    canvas.on('click', ({ offsetX, offsetY }) => {
      const color = `#${window._cpickerGetColor(offsetX, offsetY)}`;
      shouldfill.forEach((path) => path.setAttribute('fill', color));
      window._updatepadcolor(color);
    });

    if (window._currpadcolor) shouldfill.forEach((path) => path.setAttribute('fill', window._currpadcolor));

    const special_cases = {
      'controller.ls': ['controller.lx-', 'controller.lx+', 'controller.ly-', 'controller.ly+'],
      'controller.rs': ['controller.rx-', 'controller.rx+', 'controller.ry-', 'controller.ry+'],
      'controller.lb': ['controller.l1', 'controller.l2'],
      'controller.rb': ['controller.r1', 'controller.r2']
    };

    const getBindedKey = (action) => _keybinds[1][action] ?? _keybinds[0][action];

    for (let i = 0; i < buttons.length; ++i) {
      const svgbtn = buttons[i]
      const bbox = svgbtn.getBoundingClientRect();
      const htbtn = document.createElement('button');
      htbtn.style.top = `${bbox.top}px`;
      htbtn.style.left = `${bbox.left}px`;
      htbtn.style.width = `${bbox.width}px`;
      htbtn.style.height = `${bbox.height}px`;
      const action = htbtn.dataset.cfgbtn = `controller.${svgbtn.dataset.btn}`;
      htbtn.innerText = '...';
      if (special_cases[action])
        htbtn.title = special_cases[action].map((subact) => `${subact}: ${getBindedKey(subact)}`).join('\n');
      else
        htbtn.title = `${action}: ${getBindedKey(action)}`;
      overlay.appendChild(htbtn);
    }

    overlay.on('click', ({ target }) => {
      if (target.tagName !== 'BUTTON') return;
      const actionid = target.dataset.cfgbtn;

      const createButtonMsg = (actionid) => (new Promise((resolve, reject) => {
        window.warnAPI.callback = (data) => {
          window.warnAPI.send({ hidden: true, id: data.id });

          switch (data.event) {
            case 'click':
              if (data.resp === 0) reject('cancelled');
              break;
            case 'key':
              const code = resolveSDLKey(data.code);
              if (code) resolve({ action: isOldVer ? data.id.substr(data.id.indexOf('.') + 1) : data.id, code });
              break;
          }
        };

        window.warnAPI.send({
          id: actionid, text: '{$tr:settings.emulator.wkeybind.bindmessage}',
          trparams: { action: actionid }, hidden: false, buttons: ['{$tr:buttons.ca}']
        });
      }));

      const spechandler = (sc, idx = 0, collected = []) => {
        if (idx === 0) alert(trAPI.get('settings.emulator.wkeybind.alerts.multikey', { count: sc.length }));
        if (!sc[idx]) return { multiple: true, keys: collected };
        return createButtonMsg(sc[idx]).then((data) => {
          collected.push(data);
          return spechandler(sc, idx + 1, collected);
        });
      };

      (special_cases[actionid] ? spechandler(special_cases[actionid]) : createButtonMsg(actionid)).then((data) => {
        if (data.multiple) {
          const keys = data.keys;
          for (let i = 0; i < keys.length; ++i) {
            const key = keys[i];
            ctl_modified[key.action] = key.code;
          }

          return;
        }

        ctl_modified[data.action] = data.code;
      }).catch((reason) => {
        if (reason !== 'cancelled') throw reason;
      }).finally(() => {
        savebtn.disabled = 'disabled';

        for (const [action, key] of Object.entries(ctl_modified)) {
          if (_keybinds[0][action].toLowerCase() !== key.toLowerCase()) {
            savebtn.disabled = '';
            resetbtn.disabled = '';
            break;
          }
        }
      });
    }, true);
  };
  doc.data = './img/dualshock4.svg';
  doc.width = 900;
  $('#controller').prepend(doc);

  /**
   * For some reason we can't use querySelector() in opener for opened window,
   * this thing returns invaid HTML elements it seems, so translator won't translate
   * elements inside child window. We should explicitly pass each element from child
   * window to the parent to get it translated.
   */
  document.querySelectorAll('[eo-translator]').forEach((el) => trAPI.translateElement(el));
})();
