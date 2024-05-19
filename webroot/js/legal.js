(() => {
  const lics = $('#license');
  const licu = $('#licurl');

  $('#close').on('click', () => window.close());

  const updateContents = () => {
    const sel = lics.options[lics.selectedIndex];
    const xhr = new XMLHttpRequest();

    xhr.onload = () => {
      if (xhr.status === 200) {
        licontents.innerText = xhr.response;
      }
    }

    xhr.open('get', sel.dataset.path);
    xhr.send();
  };

  {
    const xhr = new XMLHttpRequest();
    xhr.responseType = 'json';

    xhr.onload = () => {
      if (xhr.status === 200) {
        const htels = [];
        const _jlist = xhr.response;

        for (let i = 0; i < _jlist.length; ++i) {
          const item = _jlist[i];
          htels.push(`<option data-path="${item.file}" data-url="${item.url}">${item.display}</option>`);
        }

        lics.innerHTML = htels.join();
        updateContents();
      }
    };

    xhr.open('get', './3rd_license/list.json');
    xhr.send();
  }

  lics.on('change', updateContents);
})();
