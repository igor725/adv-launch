(() => {
  const avail_langs = [
    null, // Japanese
    'en', // EnglishUS
    null, // French
    null, // Spanish
    null, // German
    null, // Italian
    null, // Dutch
    null, // PortuguesePT
    'ru', // Russian
    null, // Korean
    null, // ChineseTraditional
    null, // ChineseSimplified
    null, // Finnish
    null, // Swedish
    null, // Danish
    null, // Norwegian
    null, // Polish
    null, // PortugueseBR
    null, // EnglishUK
    null, // Turkish
    null, // SpanishLA
    null, // Arabic
    null, // FrenchCA
    null, // Czech
    null, // Hungarian
    null, // Greek
    null, // Romanian
    null, // Thai
    null, // Vietnamese
    null, // Indonesian
  ];

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
      return translator.translate(id, { params });
    }
  };

  window.electronAPI.addEventListener('set-lang', (lang) => {
    dlang = lang;
    if (langready) window.trAPI.retranslate(dlang);
  });

  Promise.allSettled(proms).finally(() => {
    translator = new EOTranslator(dict);
    translator.fallbacklang = 'en';
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
