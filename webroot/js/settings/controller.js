(() => {
  const trAPI = window.opener.trAPI;
  const ctl_modified = {};
  const _keybinds = window._keybinds;
  const _isSimilar = window._isSimilar;
  window._keybinds = null;
  window._isSimilar = null;

  $('#buttons').on('click', ({ target }) => {
    switch (target.dataset.action) {
      case 'save':
        break;
      case 'reset':
        break;
      case 'exit':
        window.close();
        break;
    }
  });

  const doc = document.createElement('object');
  doc.onload = () => {
    const dcd = doc.contentDocument;
    const buttons = dcd.querySelectorAll('[data-btn]');
    const overlay = $('#controller .overlay');

    for (let i = 0; i < buttons.length; ++i) {
      const svgbtn = buttons[i]
      const bbox = svgbtn.getBoundingClientRect();
      const htbtn = document.createElement('button');
      htbtn.style.top = `${bbox.top}px`;
      htbtn.style.left = `${bbox.left}px`;
      htbtn.style.width = `${bbox.width}px`;
      htbtn.style.height = `${bbox.height}px`;
      htbtn.dataset.cfgbtn = `controller.${svgbtn.dataset.btn}`;
      htbtn.innerText = '...';
      overlay.appendChild(htbtn);
    }

    const special_cases = {
      'controller.ls': ['controller.lx-', 'controller.lx+', 'controller.ly-', 'controller.ly+'],
      'controller.rs': ['controller.rx-', 'controller.rx+', 'controller.ry-', 'controller.ry+'],
      'controller.lb': ['controller.l1', 'controller.l2'],
      'controller.rb': ['controller.r1', 'controller.r2']
    };

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
              resolve({ action: data.id, key: data.key });
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
        alert('Binding is not actually implemented yet');
        if (data.multiple) {
          const keys = data.keys;
          for (let i = 0; i < keys.length; ++i) {
            const key = keys[i];
            ctl_modified[key.action] = resolveSDLKey(key.code);
          }

          return;
        }

        ctl_modified[key.action] = resolveSDLKey(key.code);
      }).catch((reason) => {
        if (reason !== 'cancelled') throw reason;
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
