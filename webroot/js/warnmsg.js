(() => {
  const trAPI = window.trAPI ?? window.opener.trAPI;
  const warn = $('#warnmsg');

  window.warnAPI = {
    send: (data) => {
      const wrap = $('#wrapper');

      if (data.hidden) {
        wrap.dataset.ready = 1;
        warn.dataset.active = 0;
        return;
      }

      wrap.dataset.ready = 0;
      warn.dataset.wid = data.id;
      warn.dataset.wtype = data.type;
      warn.dataset.active = 1;

      let text = data.text;
      const match = text.match(/^\{\$tr\:(.+)\}$/);
      if (match) text = trAPI.get(match[1], data.trparams);

      let code = `<p>${text}</p>`;

      if (data.type === 'progress') {
        code += `<progress class="prdata" min="${data.prmin}" max="${data.prmax}" value="${data.prinit}"></progress>`;
      }

      code += '<div>';
      for (let i = 0; i < data.buttons.length; ++i) {
        let btlab = data.buttons[i];
        const match = btlab.match(/^\{\$tr\:(.+)\}$/);
        if (match) btlab = trAPI.get(match[1]);
        code += `<input class="warnbutton" type="button" data-bid="${i}" value="${btlab}" />`;
      }

      warn.innerHTML = code + '</div>';
    },
    getCurrentId: () => {
      if (warn.dataset.active !== '1') return null;
      return warn.dataset.wid;
    },
    update: (data) => {
      if (warn.dataset.active === '0') return;
      if (warn.dataset.wid !== data.id) return;

      if (data.text) {
        let text = data.text;
        const match = text.match(/^\{\$tr\:(.+)\}$/);
        if (match) text = trAPI.get(match[1], data.trparams);
        warn.$('p').innerText = text;
      }

      switch (warn.dataset.wtype) {
        case 'progress':
          warn.$('progress').value = data.progress;
          break;
      }
    },
    callback: null
  };

  warn.on('click', ({ target }) => {
    if (!target.classList.contains('warnbutton') || !window.warnAPI.callback) return;
    window.warnAPI.callback({ event: 'click', id: warn.dataset.wid, resp: parseInt(target.dataset.bid) });
  }, true);

  window.on('keydown', ({ code }) => {
    if (warn.dataset.active !== '1' || !window.warnAPI.callback) return;
    window.warnAPI.callback({ event: 'key', id: warn.dataset.wid, code: code });
  });
})();
