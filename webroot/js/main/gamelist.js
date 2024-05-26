(() => {
  const gamelist = $('#gamelist');
  const bgimage = $('#bgimage');
  const gsummary = $('#gamesummary');

  const getGameBadgeById = (id) => $(`.gamebadge[data-gid="${id}"]`);
  const isGameBadge = (target) => target.classList.contains('gamebadge');
  const getGameTitleFromBadge = (target) => target.$('.gbi-name').innerText;
  const getGameTitleIdFromBadge = (target) => target.dataset.gid;
  const getGamePathFromBadge = (target) => target.dataset.gpath;
  const getGameVersionFromBadge = (target) => target.dataset.gver;

  const statusColors = ['#e74c3c', '#e08a1e', '#f9b32f', '#1ebc61'];
  const statusTitle = ['Nothing', 'Intro', 'Ingame', 'Playable'];

  const formatTime = (ms) => {
    const seconds = Math.floor(Math.abs(ms / 1000));

    if (seconds < 1) {
      return window.trAPI.get('main.gamesummary.playtime.duration.null');
    } else if (seconds < 60) {
      return window.trAPI.get('main.gamesummary.playtime.duration.seconds', { value: seconds });
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return window.trAPI.get('main.gamesummary.playtime.duration.minutes', { value: minutes });
    } else {
      const hours = seconds / 3600;
      const floored = Math.floor(hours);
      return window.trAPI.get('main.gamesummary.playtime.duration.hours', {
        value: ((hours - floored > 0.25) ? hours.toFixed(2) : hours)
      });
    }
  };

  let loadBGandSound = null;
  let selectedGame = null;
  let playingAmbientFor = null;

  window.gamelistAPI = {
    getSelectedGame: () => selectedGame != null ? getGameBadgeById(selectedGame) : null,
    preventFetching: () => {
      window.electronAPI.sendCommand('stopaudio');

      if (loadBGandSound != null) {
        clearTimeout(loadBGandSound);
        loadBGandSound = null;
      }
    },
    fetchGame: (node, force = false) => {
      if (node === null) node = window.gamelistAPI.getSelectedGame();
      if (loadBGandSound != null) {
        clearTimeout(loadBGandSound);
        loadBGandSound = null;
      }

      const { gpath, gid, gtroph, gipatch } = node.dataset;
      if (playingAmbientFor == gid && !force) return;

      loadBGandSound = setTimeout(() => {
        const possible_paths = [];
        if (gipatch) possible_paths.push(gipatch);
        possible_paths.push(gpath);
        window.electronAPI.sendCommand('getgamesum', { gpath: possible_paths, gid: gid });
        if (gtroph) {
          window.electronAPI.readTrophies(possible_paths).then((data) => {
            window.trophyAPI.updateTrophies(data);
          }).catch((err) => {
            window.trophyAPI.setError(err.toString());
          });
        }

        window.trophyAPI.setStatus(!!gtroph);
        playingAmbientFor = gid;
      }, 1200);
    }
  };

  const createContextFor = (gbadge, x, y) => {
    const data = {
      x: x, y: y,
      gid: getGameTitleIdFromBadge(gbadge),
      gpath: getGamePathFromBadge(gbadge),
      gver: getGameVersionFromBadge(gbadge),
      gtitle: getGameTitleFromBadge(gbadge),
      patches: []
    };

    const patches = gbadge._patches;
    for (let i = 0; i < patches.length; ++i) {
      data.patches.push({
        path: patches[i].path,
        version: patches[i].version
      });
    }

    window.electronAPI.buildGameContextMenu(data);
  };

  gamelist.on('click', ({ target: gbadge }) => {
    if (!isGameBadge(gbadge)) return;
    if (selectedGame != null) {
      window.gamelistAPI.getSelectedGame().classList.remove('selected');
    }
    const gstatus = gbadge.$('.gbi-status');
    if (gstatus) gamelist.style.setProperty('--selection-color', gstatus.style.color);
    else gamelist.style.setProperty('--selection-color', null);
    gbadge.classList.add('selected');
    selectedGame = gbadge.dataset.gid;
    window.terminalAPI.clear();
  }, true);

  gamelist.on('dblclick', ({ target: gbadge }) => {
    if (!isGameBadge(gbadge)) return;
    window.electronAPI.sendCommand('rungame', {
      path: getGamePathFromBadge(gbadge),
      gid: getGameTitleFromBadge(gbadge),
      dblclick: true
    });
  });

  gamelist.on('mouseover', ({ target: gbadge }) => {
    if (!isGameBadge(gbadge)) return;
    window.gamelistAPI.fetchGame(gbadge);
  }, true);

  gamelist.on('mouseout', ({ target: gbadge }) => {
    if (!isGameBadge(gbadge)) return;
    if (selectedGame != null) {
      window.gamelistAPI.fetchGame(null);
    } else {
      playingAmbientFor = null;
      gsummary.style.opacity = 0;
      bgimage.style.backgroundImage = '';
      window.gamelistAPI.preventFetching();
    }
  }, true);

  $('#gamefilter').on('input', ({ target }) => {
    const filter = target.value.toLowerCase();
    for (let elem = gamelist.firstChild; elem !== null; elem = elem.nextSibling) {
      if (!isGameBadge(elem)) return;
      elem.style.display = filter === '' ? null : (getGameTitleIdFromBadge(elem).toLowerCase().indexOf(filter) === -1 && getGameTitleFromBadge(elem).toLowerCase().indexOf(filter) === -1) ? 'none' : null;
    }
  });

  window.electronAPI.addEventListener('set-glcols', (value) => {
    gamelist.style.minWidth = gamelist.style.maxWidth = `${16 + (value * 138)}px`;
  });

  window.electronAPI.addEventListener('set-gstatus', (msg) => {
    if (msg.status < 0) return;

    const gamebadge = gamelist.$(`.gamebadge[data-gid="${msg.gid}"]`);
    if (gamebadge !== null && gamebadge.$('.gbi-status') === null) {
      const node = document.createElement('div');
      node.classList = 'gbi-status fa-solid fa-circle';
      node.title = statusTitle[msg.status];
      node.style.color = statusColors[msg.status];
      gamebadge.$('.gb-info').appendChild(node);
    }
  });

  const gids = {};

  window.electronAPI.addEventListener('clear-glist', () => {
    gamelist.innerHTML = '';
    Object.keys(gids).forEach(key => delete gids[key]);
  });

  window.electronAPI.addEventListener('add-game', (msg) => {
    if (msg.ispatch) {
      const gamebadge = gamelist.$(`.gamebadge[data-gid="${msg.id}"]`);
      if (gamebadge === null) {
        console.warn(`Patch v${msg.version} for ${msg.id} was ignored, since there is no applicable game!`);
        return;
      }

      gamebadge._patches.push({
        version: msg.version,
        path: msg.path,
        icon: msg.icon
      });

      return;
    }

    if (gids[msg.id]) return;
    gids[msg.id] = true;

    const rootel = document.createElement('div');
    rootel.classList = 'gamebadge';
    rootel.dataset.gid = msg.id;
    rootel.dataset.gver = msg.version;
    rootel.dataset.gpath = msg.path;
    rootel._patches = [];

    if (msg.icon)
      rootel.style.backgroundImage = `url(data:image/png;base64,${msg.icon})`;

    const hoviel = document.createElement('div');
    hoviel.classList = 'gb-info';
    rootel.appendChild(hoviel);

    if (msg.trophies) {
      rootel.dataset.gtroph = msg.trophies;
      const trophyel = document.createElement('div');
      trophyel.classList = 'gbi-trophy fa-solid fa-trophy';
      hoviel.appendChild(trophyel);
    }

    const nameel = document.createElement('div');
    nameel.classList = 'gbi-name';
    nameel.innerText = msg.title;
    hoviel.appendChild(nameel);

    gamelist.appendChild(rootel);
  });

  gamelist.on('contextmenu', (ev) => {
    if (!isGameBadge(ev.target)) return;
    ev.preventDefault();
    createContextFor(ev.target, ev.clientX, ev.clientY);
  }, true);

  window.electronAPI.addEventListener('set-bg-image', (image) => {
    if (image == null) {
      bgimage.style.backgroundImage = null;
      return;
    }

    bgimage.style.backgroundImage = `url(data:image/png;base64,${image})`;
  });

  window.electronAPI.addEventListener('gamesum', (data) => {
    const lrun = gsummary.$('.lrun p:nth-child(2)');
    const lplay = gsummary.$('.lplay p:nth-child(2)');
    window.trophyAPI.updateAchieved(data.trophies);
    if (data.patch) getGameBadgeById(data.gid).dataset.gipatch = data.patch;
    lrun.innerText = data.lastrun === -1 ? 'Never' : (new Date(data.lastrun)).toLocaleDateString();
    lplay.innerText = formatTime(data.playtime);
    gsummary.style.opacity = 1;
  });
})();
