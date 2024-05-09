(() => {
  $('.tb-button.close').on('click', () => {
    window.electronAPI.sendCommand('quit');
  });

  $('.tb-button.options').on('click', () => {
    window.electronAPI.sendCommand('showsettings');
  });

  const bgimage = $('#bgimage');
  const gamelist = $('#gamelist');
  const terminal = $('#terminal');

  let loadBGandSound = null;
  let selectedGame = null;
  let playingAmbientFor = null;

  const getSelectedGame = () => selectedGame != null ? $(`.gamebadge[data-gid="${selectedGame}"]`) : null;

  const fetchGame = (node, force = false) => {
    if (loadBGandSound != null) {
      clearTimeout(loadBGandSound);
      loadBGandSound = null;
    }

    const { gpath, gid } = node.dataset;
    if (playingAmbientFor == gid && !force) return;

    loadBGandSound = setTimeout(() => {
      window.electronAPI.sendCommand('getbgaudio', gpath);
      playingAmbientFor = gid;
    }, 1200);
  };

  const preventFetching = () => {
    window.electronAPI.sendCommand('stopaudio');

    if (loadBGandSound != null) {
      clearTimeout(loadBGandSound);
      loadBGandSound = null;
    }
  };

  $('#gamebuttons').on('click', ({ target }) => {
    if (!target.classList.contains('gbutton')) return;
    const sg = getSelectedGame();
    if (sg == null) return alert('You should select the game first!');

    if (target.classList.contains('ofolder')) {
      window.electronAPI.sendCommand('openfolder', sg.dataset.gpath);
    } else if (target.classList.contains('rgame')) {
      window.electronAPI.sendCommand('rungame', sg.dataset.gpath);
    }
  }, true);

  gamelist.on('click', ({ target }) => {
    if (!target.classList.contains('gb-info')) return;
    const gbadge = target.parentNode;
    if (selectedGame != null) {
      getSelectedGame().classList.remove('selected');
    }
    gbadge.classList.add('selected');
    selectedGame = gbadge.dataset.gid;
  }, true);

  gamelist.on('mouseover', ({ target }) => {
    if (!target.classList.contains('gb-info')) return;
    fetchGame(target.parentNode);
  }, true);

  gamelist.on('mouseout', ({ target }) => {
    if (!target.classList.contains('gb-info')) return;
    const gbadge = target.parentNode;

    if (selectedGame != null) {
      fetchGame(getSelectedGame());
    } else {
      bgimage.style.backgroundImage = '';
      preventFetching();
    }
  }, true);

  window.electronAPI.addEventListener('set-bg-image', (image) => {
    if (image == null) {
      bgimage.style.backgroundImage = '';
      return;
    }
    bgimage.style.backgroundImage = `url(data:image/png;base64,${image})`;
  });

  window.electronAPI.addEventListener('add-game', (msg) => {
    if (msg.ispatch) return;

    const rootel = document.createElement('div');
    rootel.classList = 'gamebadge';
    rootel.dataset.gid = msg.id;
    rootel.dataset.gver = msg.version;
    rootel.dataset.gpath = msg.path;

    if (msg.icon)
      rootel.style.backgroundImage = `url(data:image/png;base64,${msg.icon})`;

    const hoviel = document.createElement('div');
    hoviel.classList = 'gb-info';
    rootel.appendChild(hoviel);

    const nameel = document.createElement('div');
    nameel.classList = 'gbi-name';
    nameel.innerText = msg.title;
    hoviel.appendChild(nameel);

    gamelist.appendChild(rootel);
  });

  window.electronAPI.addEventListener('input', (state) => {
    document.body.style.pointerEvents = state == false ? 'none' : null;
  });

  window.electronAPI.addEventListener('ingame', (enabled) => {
    if (selectedGame != null) {
      terminal.style.opacity = enabled ? 1 : null;

      if (enabled) {
        preventFetching();
        terminal.innerHTML = '';
      } else {
        fetchGame(getSelectedGame(), true);
      }
    }
  });

  window.electronAPI.addEventListener('alert', (msg) => {
    alert(msg);
  });

  window.electronAPI.addEventListener('term-data', (code) => {
    terminal.innerHTML += code;
    terminal.scrollTop = terminal.scrollHeight;
  });

  const warn = $('#warnmsg');

  warn.on('click', ({ target }) => {
    if (!target.classList.contains('warnbutton')) return;
    window.electronAPI.sendCommand('warnresp', { id: target.parentNode.parentNode.dataset.wid, resp: parseInt(target.dataset.bid) });
  }, true);

  window.electronAPI.addEventListener('warnmsg', (data) => {
    const wrap = $('#wrapper');

    if (data.hidden) {
      wrap.style.overflow = null;
      wrap.style.filter = null;
      warn.dataset.active = 0;
      return;
    }

    wrap.style.overflow = 'hidden';
    wrap.style.filter = 'blur(10px)';
    warn.dataset.wid = data.id;
    warn.dataset.wtype = data.type;
    warn.dataset.active = 1;
    let code = `<p>${data.text}</p>`;

    if (data.type === 'progress') {
      code += `<progress class="prdata" min="${data.prmin}" max="${data.prmax}" value="${data.prinit}"></progress>`;
    }

    code += '<div>';
    for (let i = 0; i < data.buttons.length; ++i) {
      code += `<input class="warnbutton" type="button" data-bid="${i}" value="${data.buttons[i]}" />`;
    }

    warn.innerHTML = code + '</div>';
  });

  window.electronAPI.addEventListener('warnmsg-upd', (data) => {
    if (warn.dataset.active === '0') return;
    if (warn.dataset.wid !== data.id) return;

    switch (warn.dataset.wtype) {
      case 'progress':
        warn.$('progress').value = data.progress;
        break;
    }
  });

  window.electronAPI.sendCommand('getgames');
})();
