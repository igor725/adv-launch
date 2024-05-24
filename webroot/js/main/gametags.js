(() => {
  const gitlabs = $('#gitinfo');

  // todo: Check the game ID
  window.electronAPI.addEventListener('set-gtags', (msg) => {
    gitlabs.innerHTML = msg.html;
    gitlabs.dataset.issue = msg.iid;
  });

  gitlabs.on('click', () => {
    window.electronAPI.sendCommand('openissue', parseInt(gitlabs.dataset.issue));
  });

  gitlabs.on('wheel', (ev) => gitlabs.scrollLeft += ev.deltaY * 0.1);
})();
