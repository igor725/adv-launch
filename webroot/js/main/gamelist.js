(() => {
  const gamelist = $('#gamelist');
  const bgimage = $('#bgimage');
  const gsummary = $('#gamesummary');

  const isGameBadge = (target) => target.classList.contains('gamebadge');
  const getGameTitleFromBadge = (target) => target.$('.gbi-name').innerText;
  const getGameTitleIdFromBadge = (target) => target.dataset.gid;
  const getGamePathFromBadge = (target) => target.dataset.gpath;
  const getTrophiesPathFromBadge = (target) => target.dataset.gtroph;
  const getGameVersionFromBadge = (target) => target.dataset.gver;

  const formatTime = (ms) => {
    const seconds = Math.floor(Math.abs(ms / 1000));

    if (seconds < 1) {
      return 'Unplayed';
    } else if (seconds < 60) {
      return seconds + (seconds > 1 ? ' seconds' : ' second');
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return minutes + (minutes > 1 ? ' minutes' : ' minute');
    } else {
      const hours = seconds / 3600;
      const floored = Math.floor(hours);
      return ((hours - floored > 0.25) ? hours.toFixed(2) : hours) + (hours > 1 ? ' hours' : ' hour');
    }
  };

  let loadBGandSound = null;
  let selectedGame = null;
  let playingAmbientFor = null;

  window.gamelistAPI = {
    getSelectedGame: () => selectedGame != null ? $(`.gamebadge[data-gid="${selectedGame}"]`) : null,
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

      const { gpath, gid, gtroph } = node.dataset;
      if (playingAmbientFor == gid && !force) return;

      loadBGandSound = setTimeout(() => {
        window.electronAPI.sendCommand('getgamesum', { gpath: gpath, gid: gid });
        if (gtroph) {
          window.electronAPI.readTrophies(gtroph).then((data) => {
            if (getTrophiesPathFromBadge(node) != gtroph) return;
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
    gbadge.classList.add('selected');
    selectedGame = gbadge.dataset.gid;
  }, true);

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

  const paths = {};

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

    if (paths[msg.path]) return;
    paths[msg.path] = true;

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
      bgimage.style.backgroundImage = '';
      return;
    }
    bgimage.style.backgroundImage = `url(data:image/png;base64,${image})`;
  });

  window.electronAPI.addEventListener('gamesum', (data) => {
    const lrun = gsummary.$('.lrun p:nth-child(2)');
    const lplay = gsummary.$('.lplay p:nth-child(2)');
    window.trophyAPI.updateAchieved(data.trophies);
    lrun.innerText = data.lastrun === -1 ? 'Never' : (new Date(data.lastrun)).toLocaleDateString();
    lplay.innerText = formatTime(data.playtime);
    gsummary.style.opacity = 1;
  });
})();
