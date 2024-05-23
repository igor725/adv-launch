const fs = require('node:fs');
const https = require('follow-redirects').https;
const path = require('node:path');
const { parentPort } = require('node:worker_threads');

let atoken = undefined;
let homedir = undefined;
let compatdata = undefined;

const ptimer = (ms) => new Promise((resolve) => setTimeout(() => resolve(), ms));

const addDefaultHeaders = (headers) => {
  const defheaders = { 'User-Agent': 'ADVL psOff/1.0' };
  if (atoken) defheaders.Authorization = `Bearer ${atoken}`;
  return Object.assign(defheaders, headers);
};

const loadJSON = (url, headers = undefined) =>
  new Promise((resolve, reject) => {
    const jheaders = { 'Accept': ['application/vnd.github+json'] };
    https.get(url, { headers: addDefaultHeaders(Object.assign(jheaders, headers)) }, async (resp) => {
      if (parseInt(resp.headers['x-ratelimit-remaining']) < 1) await ptimer(1000);
      let data = '';

      if (resp.headers['content-type'].indexOf('application/json') == -1) {
        resp.destroy('Not a json response');
        return;
      }

      resp.on('data', (chunk) => {
        data += chunk;
      });

      resp.on('end', () => {
        resolve(JSON.parse(data));
      });
    }).on('error', (err) => {
      reject(err);
    });
  });

const TITLE_ID_REGEXP = /^\[(\w{4}\d{5})\]\:/;

const downloader = ({ games, labels }, page = 1) =>
  loadJSON(`https://api.github.com/search/issues?q=repo:SysRay/psOff_compatibility%20is:issue%20is:open&per_page=100&page=${page}`).then((data) => {
    const items = data.items;

    for (let i = 0; i < items.length; ++i) {
      const issue = items[i];
      const ilabels = issue.labels;

      for (let i = 0; i < ilabels.length; ++i) {
        const label = ilabels[i];
        if (labels.findIndex((_lab) => _lab.name === label.name) != -1) continue;
        labels.push({
          name: label.name,
          color: label.color,
          description: label.description
        });
      }

      games.push({
        id: issue.number,
        gid: TITLE_ID_REGEXP.test(issue.title) ? issue.title.match(TITLE_ID_REGEXP)[1] : '',
        labels: issue.labels.map((label) => labels.findIndex((_lab) => _lab.name === label.name))
      });
    }

    if (data.total_count > games.length)
      return downloader({ games, labels }, page + 1);
  });

const downloadWholeDataBase = async () => {
  const dbpath = path.join(homedir, '/compatibility.json');

  try {
    const stat = fs.statSync(dbpath);
    if (Date.now() - stat.mtimeMs < 604800000 /* Cache the compat list for one week */) {
      return JSON.parse(fs.readFileSync(dbpath));
    }
  } catch (e) {
    console.error('[GAMETAGS] Failed to read cached database: ', e.toString());
  }

  const data = {
    games: [],
    labels: []
  };

  downloader(data, 1).then(() => {
    try {
      fs.writeFileSync(dbpath, JSON.stringify(data));
    } catch (e) {
      console.error('[GAMETAGS] Failed to save the database: ', e.toString());
    }
  }).catch((err) => {
    console.error('[GAMETAGS] Failed to download the database: ', err.toString());

    try {
      Object.assign(data, JSON.parse(fs.readFileSync(dbpath)));
    } catch (err2) {
      console.error('[GAMETAGS] Fallback to cached database failed: ', err2.toString());
      throw err;
    }
  });

  return data;
};

const commandHandler = async (msg) => {
  try {
    switch (msg.act) {
      case 'init': {
        homedir = msg.udir;
        atoken = msg.token;

        downloadWholeDataBase().then((data) => {
          compatdata = data;
        }).catch((err) => {
          console.error('[GAMETAGS] Failed to initialize database: ', err.toString());
        });
      } break;

      case 'request': {
        let htcode = undefined;

        const gissue = compatdata.games.find((game) => game.gid.toUpperCase() === msg.gid.toUpperCase());

        if (gissue) {
          const labels = gissue.labels;
          htcode = labels.map((idx) => {
            const label = compatdata.labels[idx];
            // const m = label.color.match(/([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})/);
            // const tc = `rgb(${(255 - parseInt(m[1], 16))},${(255 - parseInt(m[2], 16))},${(255 - parseInt(m[3], 16))})`;
            return `<div class="gitbadge" style="background-color: #${label.color}a9;" title="${label.description}">${label.name}</div>`
          });
        }

        if (htcode)
          parentPort.postMessage({ resp: 'gametags', gid: msg.gid, iid: gissue.id, html: htcode.join('') });
        else
          parentPort.postMessage({ resp: 'gametags', gid: msg.gid, iid: 0, html: '' });
      } break;

      default: {
        console.error('[GAMETAGS] Unhandled command ', msg.act);
      } break;
    }
  } catch (err) {
    parentPort.postMessage({ resp: 'error', text: err.toString() });
  }
};

parentPort.on('message', commandHandler);
