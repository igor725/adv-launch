(() => {
  const tutorialScript = [
    { action: 'bgimg', image: 'screen1_a' },
    { action: 'hint', text: 'welcome', tc: true, tx: 50, ty: 50 },
    { action: 'bgimg', image: 'screen1_b' },
    { action: 'hint', clip: { sx: 0, ex: 28.22, sy: 4.31, ey: 8.10 }, text: 'filter', tx: 0 },
    { action: 'hint', clip: { sx: 0, ex: 28.22, sy: 8.27, ey: 100 }, text: 'list', tx: 28.32, ty: 54.13 },
    { action: 'bgimg', image: 'screen1_c' },
    { action: 'hint', clip: { sx: 11.45, ex: 13.39, sy: 34.14, ey: 36.89 }, text: 'tropicon', tx: 0 },
    { action: 'bgimg', image: 'screen1_a' },
    { action: 'hint', clip: { sx: 90.30, ex: 100, sy: 0, ey: 3.62 }, text: 'tbtn', xalign: 'right', tx: 0 },
    { action: 'hint', clip: { sx: 71.77, ex: 100, sy: 93.10, ey: 100 }, text: 'abtn', tey: true, xalign: 'right', tx: 0, ty: 93.10 },
    { action: 'bgimg', image: 'screen2' },
    { action: 'hint', clip: { sx: 58.58, ex: 69.06, sy: 93.10, ey: 100 }, text: 'trophybtn', teycx: true, tx: 63.86, ty: 93.10 },
    { action: 'bgimg', image: 'screen2_a' },
    { action: 'hint', clip: { sx: 44.03, ex: 82.74, sy: 37.07, ey: 92.07 }, text: 'trophytrk', teycx: true, tx: 63.86, ty: 37.07 },
    { action: 'bgimg', image: 'screen2_c' },
    { action: 'hint', clip: { sx: 44.42, ex: 83.12, sy: 37.06, ey: 92.07 }, text: 'trophylst', teycx: true, tx: 63.86, ty: 37.07 },
    { action: 'bgimg', image: 'screen3' },
    { action: 'hint', clip: { sx: 31.23, ex: 67.21, sy: 23.27, ey: 26.72 }, text: 'bgmvol', tcx: true, tx: 50 },
    { action: 'hint', clip: { sx: 31.23, ex: 67.21, sy: 27.75, ey: 31.20 }, text: 'ghtoken', tcx: true, tx: 50 },
    { action: 'hint', clip: { sx: 31.23, ex: 67.21, sy: 31.80, ey: 35.25 }, text: 'emupath', tcx: true, tx: 50 },
    { action: 'hint', clip: { sx: 31.23, ex: 67.21, sy: 35.86, ey: 39.31 }, text: 'updch', tcx: true, tx: 50 },
    { action: 'hint', clip: { sx: 31.23, ex: 67.21, sy: 39.65, ey: 43.10 }, text: 'updfr', tcx: true, tx: 50 },
    { action: 'hint', clip: { sx: 31.23, ex: 67.21, sy: 44.14, ey: 57.58 }, text: 'gsd', tcx: true, tx: 50 },
    { action: 'hint', clip: { sx: 31.23, ex: 67.21, sy: 58.62, ey: 62.07 }, text: 'gsdbtn', tcx: true, tx: 50 },
    { action: 'bgimg', image: 'screen4' },
    { action: 'hint', clip: { sx: 31.23, ex: 67.21, sy: 43.27, ey: 55.17 }, text: 'gbacntl', tcx: true, tx: 50 },
    { action: 'hint', clip: { sx: 31.23, ex: 67.21, sy: 56.72, ey: 60.17 }, text: 'currusr', tcx: true, tx: 50 },
    { action: 'hint', clip: { sx: 31.23, ex: 67.21, sy: 60.52, ey: 63.97 }, text: 'troperk', tcx: true, tx: 50 },
    { action: 'hint', clip: { sx: 31.23, ex: 67.21, sy: 64.65, ey: 68.11 }, text: 'masterdevice', tcx: true, tx: 50 },
    { action: 'hint', clip: { sx: 31.23, ex: 67.21, sy: 68.45, ey: 71.90 }, text: 'mastervol', tcx: true, tx: 50 },
    { action: 'hint', clip: { sx: 31.23, ex: 67.21, sy: 72.75, ey: 76.21 }, text: 'lang', tcx: true, tx: 50 },
    { action: 'hint', clip: { sx: 31.23, ex: 67.21, sy: 76.55, ey: 80.00 }, text: 'fullscreen', tcx: true, tx: 50 },
    { action: 'hint', text: 'end', tc: true, tx: 50, ty: 50 },
  ];

  const nextKeys = {
    'Space': true,
    'Enter': true
  };

  const tutorClick = (wrap) => new Promise((resolve) => {
    const keyev = ({ code }) => {
      if (code === 'Escape') resolve(true);
      else if (nextKeys[code]) resolve(false);
      else return;

      window.off('keyup', keyev);
      wrap.off('click', clickev);
    };

    const clickev = () => {
      wrap.off('click', clickev);
      window.off('keyup', keyev);
      resolve(false);
    };

    wrap.on('click', clickev);
    window.on('keyup', keyev);
  });

  const renderStep = async ({ wrap, bgimg, frsel, text }, stepid) => {
    const step = tutorialScript[stepid];
    if (!step) throw 'end';

    switch (step.action) {
      case 'bgimg':
        bgimg.src = `./img/tutor/${step.image}.png`;
        break;
      case 'hint':
        if (step.clip) {
          const sc = step.clip;
          frsel.style.clipPath = `polygon(0% 0%,
            0% 100%,
            ${sc.sx}vw 100%,
            ${sc.sx}vw ${sc.sy}vh,
            ${sc.ex}vw ${sc.sy}vh,
            ${sc.ex}vw ${sc.ey}vh,
            ${sc.sx}vw ${sc.ey}vh,
            ${sc.sx}vw 100%,
            100% 100%,
            100% 0%)`;
        } else {
          frsel.style.clipPath = null;
        }
        if (step.tc) text.style.transform = 'translate(-50%, -50%)';
        else if (step.tcx) text.style.transform = 'translateX(-50%)';
        else if (step.tey) text.style.transform = 'translateY(-100%)';
        else if (step.teycx) text.style.transform = 'translate(-50%, -100%)';
        else text.style.transform = null;

        text.style.left = text.style.right = null;
        text.style[step.xalign ?? 'left'] = `${step.tx}vw`;
        text.style[step.yalign ?? 'top'] = `${step.ty ?? step.clip.ey}vh`;
        text.innerText = window.trAPI.get(`tutorial.${step.text}`);
        if (await tutorClick(wrap)) throw 'cancelled';
        break;

      default: throw 'unknown action';
    }

    return stepid;
  };

  const renderStepPromise = (elems, stepid) =>
    renderStep(elems, stepid).then((previd) => renderStepPromise(elems, previd + 1));

  const runTutorial = (elems) => {
    renderStepPromise(elems, 0).catch((err) => {
      elems.wrap.remove();
    });
  };

  window.tutorAPI = {
    start: () => {
      // One tutorial course at the time, don't overdo it
      if ($('#tutor-wrapper')) return;

      const wrap = document.createElement('div');
      wrap.id = 'tutor-wrapper';

      const bgimg = document.createElement('img');
      wrap.appendChild(bgimg);

      const frsel = document.createElement('div');
      frsel.classList = 'selector';
      wrap.appendChild(frsel);

      const text = document.createElement('p');
      wrap.appendChild(text);

      runTutorial({ wrap, bgimg, frsel, text });

      document.body.appendChild(wrap);
    },
  };
})();
