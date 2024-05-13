(() => {
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

    let text = data.text;
    const match = text.match(/^\{\$tr\:(.+)\}$/);
    if (match) text = window.trAPI.get(match[1], { params: data.trparams });

    let code = `<p>${text}</p>`;

    if (data.type === 'progress') {
      code += `<progress class="prdata" min="${data.prmin}" max="${data.prmax}" value="${data.prinit}"></progress>`;
    }

    code += '<div>';
    for (let i = 0; i < data.buttons.length; ++i) {
      let btlab = data.buttons[i];
      const match = btlab.match(/^\{\$tr\:(.+)\}$/);
      if (match) btlab = window.trAPI.get(match[1]);
      code += `<input class="warnbutton" type="button" data-bid="${i}" value="${btlab}" />`;
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
})();
