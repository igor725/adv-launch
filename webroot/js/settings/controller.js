(() => {
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

    window.warnAPI.callback = (data) => {
      switch (data.event) {
        case 'click':
          if (data.resp === 0) window.warnAPI.send({ hidden: true, id: data.id });
          break;
        case 'key':
          console.log(data);
          break;
      }
    };

    overlay.on('click', ({ target }) => {
      if (target.tagName !== 'BUTTON') return;
      window.warnAPI.send({ id: target.dataset.cfgbtn, text: '{$tr:settings.emulator.wkeybind.bindmessage}', trparams: { action: target.dataset.cfgbtn }, hidden: false, buttons: ['Close'] })
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
  document.querySelectorAll('[eo-translator]').forEach((el) => window.opener.trAPI.translateElement(el));
})();
