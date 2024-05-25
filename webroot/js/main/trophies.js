(() => {
  const trlist = $('#trophieslist');
  const ltrops = $('#gamesummary .ltrops');

  let unlockstyle = null;

  const generateHTML = (data, index) => {
    const elems = [];

    if (index !== undefined) elems.push(`<div${index > 0 ? ' style="display: none;"' : ''}>`);

    for (let i = 0; i < data.length; ++i) {
      const ctrop = data[i];
      elems.push(`<div class="row"><img src="${ctrop.icon}" /><div class="info"><p class="name tropid-${ctrop.id}">${ctrop.name}<i class="fa-solid fa-trophy grade-${ctrop.grade}"></i></p><p class="detail">${ctrop.hidden ? window.trAPI.get('trophies.hidden') : ctrop.detail}</p></div></div>`);
    }

    if (index !== undefined) elems.push('</div>');

    return elems;
  };

  trlist.on('click', ({ target }) => {
    if (!target.classList.contains('mult-btn')) return;
    const cidx = parseInt(target.dataset.id);
    trlist.$$('.multiple>.mult-content>div').forEach((elem, idx) => {
      elem.style.display = cidx === idx ? null : 'none';
    });
  });

  window.trophyAPI = {
    updateTrophies: (data) => {
      if (data.multiple === true) {
        let tropcnt = 0, dataleft = data.count;

        trlist.innerHTML = '<div class="multiple"><div class="mult-list"></div><div class="mult-content"></div></div>';

        setTimeout(() => {
          const receiver = (data) => {
            trlist.$('.multiple>.mult-list').innerHTML += `<div class="mult-btn" data-id="${data.index}">Game ${data.index}</div>`;
            trlist.$('.multiple>.mult-content').innerHTML += generateHTML(data.trophies, data.index).join('');

            tropcnt += data.trophies.length;
            ltrops.children[3].innerText = tropcnt;

            if (--dataleft === 0) window.electronAPI.removeAllListeners(data.id);
          };

          window.electronAPI.addEventListener(data.id, receiver);

          window.electronAPI.multiTrophiesReady(data.id);
        }, 0);
      } else {
        trlist.innerHTML = generateHTML(data).join('');
        ltrops.children[3].innerText = data.length;
      }
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
        if (trlist.dataset.hidden === '1') {
          trlist.scrollTo(0, 0); // Should be called before setting the style, won't work otherwise
          trlist.style.display = 'none';
        }
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
