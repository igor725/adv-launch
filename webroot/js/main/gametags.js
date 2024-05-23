(() => {
  const gitlabs = $('#gitinfo');

  // todo: Check the game ID
  window.electronAPI.addEventListener('set-gtags', (msg) => gitlabs.innerHTML = msg.html);

  gitlabs.on('wheel', (ev) => gitlabs.scrollLeft += ev.deltaY * 0.1);
})();
