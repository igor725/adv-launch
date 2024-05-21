window._onLangReady = (() => {
  $('#titlebar').on('click', ({ target }) => {
    const tgc = target.classList;

    if (tgc.contains('close')) {
      window.electronAPI.sendCommand('quit');
    } else if (tgc.contains('options')) {
      window.electronAPI.sendCommand('showsettings');
    } else if (tgc.contains('minimize')) {
      window.electronAPI.sendCommand('minimize');
    } else if (tgc.contains('legal')) {
      window.open('legal.html', '_blank', 'frame=no,resizable=no,width=630,height=380');
    }
  });

  $('#gamebuttons').on('click', ({ target }) => {
    if (!target.classList.contains('gbutton')) return;
    const sg = window.gamelistAPI.getSelectedGame();
    if (sg == null) return alert(window.trAPI.get('main.actions.nogame'));

    const { gpath, gid } = sg.dataset;

    if (target.classList.contains('ofolder')) {
      window.electronAPI.sendCommand('openfolder', gpath);
    } else if (target.classList.contains('rgame')) {
      window.electronAPI.sendCommand('rungame', { path: gpath, gid: gid });
    }
  }, true);

  window.electronAPI.addEventListener('input', (state) => {
    document.body.style.pointerEvents = state == false ? 'none' : null;
  });

  window.electronAPI.addEventListener('ingame', (enabled) => {
    if (!window.gamelistAPI.getSelectedGame()) return;
    window.terminalAPI.setStatus(enabled);
    if (enabled) {
      window.gamelistAPI.preventFetching();
    } else {
      window.gamelistAPI.fetchGame(null, true);
    }
  });

  window.electronAPI.addEventListener('warnmsg', (data) => window.warnAPI.send(data));

  window.electronAPI.addEventListener('warnmsg-upd', (data) => window.warnAPI.update(data));

  window.warnAPI.callback = (data) => {
    if (data.event === 'click') window.electronAPI.sendCommand('warnresp', data)
  };

  window.electronAPI.addEventListener('run-tutorial', () => window.tutorAPI.start());

  window.on('keyup', ({ code }) => {
    switch (code) {
      case 'F1':
        window.tutorAPI.start();
        break;

      default:
        console.warn('Unbound key', code, 'pressed!');
        break;
    }
  });

  window.electronAPI.sendCommand('getgames');
});
