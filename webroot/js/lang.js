(() => {
  const avail_langs = [null, 'en', null, null, null, null, null, null, 'ru'];

  const dict = {};

  let translator = null;
  let langready = false;
  let dlang = -1;

  const proms = [];
  for (let i = 0; i < avail_langs.length; ++i) {
    const lname = avail_langs[i];
    if (lname === null) continue;
    proms.push(new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.responseType = 'json';
      xhr.onload = () => {
        if (xhr.status === 200) {
          dict[lname] = xhr.response;
          resolve();
        }
      };
      xhr.onerror = (err) => {
        reject(err.toString());
      };
      xhr.open('GET', `langs/${lname}.json`);
      xhr.send();
    }));
  }

  const checkTranslator = () => {
    if (!langready) throw new Error('Translator is not ready yet!');
  }

  window.trAPI = {
    retranslate: (lang = 1) => {
      dlang = lang;
      checkTranslator();
      translator.language = avail_langs[lang] ?? 'en';
      translator.translateDOM();
    },
    get: (id, params) => {
      checkTranslator();
      return translator.translate(id, params);
    }
  };

  window.electronAPI.addEventListener('set-lang', (lang) => {
    dlang = lang;
    if (langready) window.trAPI.retranslate(dlang);
  });

  Promise.all(proms).then(() => {
    translator = new EOTranslator(dict);
    let int;

    int = setInterval(() => {
      if (!window._onLangReady || dlang === -1) return;
      langready = true;
      clearInterval(int);
      window._onLangReady();
      window.trAPI.retranslate(dlang);
    }, 50);
  });
})();
