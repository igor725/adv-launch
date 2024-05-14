(() => {
  $('#buttons').on('click', ({ target }) => {
    console.log(target.dataset.action)
    switch (target.dataset.action) {
      case 'save':
        break;
      case 'reset':
        break;
      case 'exit':
        window.close();
        break;
    }
  });
})();
