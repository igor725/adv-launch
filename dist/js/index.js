(() => {
  $('.tb-button.close').on('click', () => {
    window.electronAPI.sendCommand('quit');
  });

  $('.tb-button.options').on('click', () => {
    window.electronAPI.sendCommand('showsettings');
  });

  const bgimage = $('#bgimage');
  const gamelist = $('#gamelist');
  let loadBGandSound = null;
  let selectedGame = null;
  let playingAmbientFor = null;

  const fetchGame = (node) => {
    if (loadBGandSound != null) {
      clearTimeout(loadBGandSound);
      loadBGandSound = null;
    }

    const { gpath, gid } = node.dataset;
    if (playingAmbientFor == gid) return;

    loadBGandSound = setTimeout(() => {
      window.electronAPI.sendCommand('getbgaudio', gpath);
      playingAmbientFor = gpath;
    }, 1200);
  };

  gamelist.on('click', ({ target }) => {
    if (!target.classList.contains('gb-info')) return;
    const gbadge = target.parentNode;
    if (selectedGame != null) {
      $(`.gamebadge[data-gid="${selectedGame}"]`).classList.remove('selected');
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
      fetchGame($(`.gamebadge[data-gid="${selectedGame}"]`));
    } else {
      bgimage.style.backgroundImage = '';
      window.electronAPI.sendCommand('stopaudio');
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

  window.electronAPI.sendCommand('getgames');
})();
