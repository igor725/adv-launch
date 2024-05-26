(() => {
  const terminal = $('#terminal');

  window.terminalAPI = {
    setStatus: (enabled) => {
      terminal.style.opacity = enabled ? 1 : null;
      if (enabled) terminal.innerHTML = '';
    },
    clear: () => {
      terminal.style.opacity = null;
      terminal.innerHTML = '';
    }
  };

  terminal.on('dblclick', (ev) => {
    navigator.clipboard.writeText(terminal.innerText);
  });

  window.electronAPI.addEventListener('term-data', (code) => {
    terminal.innerHTML += code;
    terminal.scrollTop = terminal.scrollHeight;
  });
})();
