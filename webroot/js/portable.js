(() => {
  $('#buttons').on('click', ({ target }) => {
    if (target.tagName !== 'BUTTON') return;
    window.electronAPI.setPortable(target.dataset.portable === '1');
    window.close();
  });
})();
