(() => {
  const trlist = $('#trophieslist');
  const ltrops = $('#gamesummary .ltrops');

  let unlockstyle = null;

  window.trophyAPI = {
    updateTrophies: (data) => {
      const elems = [];
      for (let i = 0; i < data.length; ++i) {
        const ctrop = data[i];
        elems.push(`<div class="row"><img src="${ctrop.icon}" /><div class="info"><p class="name tropid-${ctrop.id}">${ctrop.name}<i class="fa-solid fa-trophy grade-${ctrop.grade}"></i></p><p class="detail">${ctrop.hidden ? '[HIDDEN]' : ctrop.detail}</p></div></div>`);
      }
      trlist.innerHTML = elems.join('');
      ltrops.children[3].innerText = data.length;
    },
    setError: (err) => {
      trlist.innerHTML = `<p style="width: 100%; height: 100%; display: flex; align-items: center; text-align:center;">${err}</p>`;
    },
    updateAchieved: (data) => {
      if (unlockstyle === null) {
        unlockstyle = document.createElement('style');
        document.head.appendChild(unlockstyle);
      }

      const stgen = [];
      for (let i = 0; i < data.length; ++i) {
        stgen.push(`.tropid-${data[i][0]} { color: green; }`);
      }
      unlockstyle.textContent = stgen.join('');

      ltrops.children[1].innerText = data.length;
    },
    setStatus: (enabled) => {
      ltrops.dataset.hidden = enabled ? 0 : 1;
      if (!enabled) trlist.innerHTML = '';
    }
  };

  const toggle = () => {
    trlist.style.display = 'flex';
    /**
     * We should let CSS recalculate the div,
     * otherwise there's no animation for us
    */
    setTimeout(() => {
      const ltrop_bound = ltrops.getBoundingClientRect();
      const trlist_bound = trlist.getBoundingClientRect();
      trlist.style.left = `${(ltrop_bound.left + (ltrop_bound.width / 2)) - (trlist_bound.width / 2)}px`;

      const hidden = trlist.dataset.hidden === '1';
      trlist.dataset.hidden = hidden ? '0' : '1';

      setTimeout(() => {
        if (trlist.dataset.hidden === '1')
          trlist.style.display = 'none';
      }, 300);
    }, 0);
  };

  const hideList = () => {
    if (trlist.dataset.hidden !== '1') toggle();
  }

  window.on('keyup', (ev) => {
    if (ev.code === 'Escape') hideList();
  }, true);

  window.on('click', ({ target }) => {
    if (target === ltrops || ltrops.contains(target)) toggle();
    else if (target !== trlist && !trlist.contains(target)) hideList();
  }, true);
})();
