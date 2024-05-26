const fs = require('node:fs');
const crypto = require('node:crypto');
const xparser = require('xml-js');
const CRYPTO_METHOD = 'aes-128-cbc';

module.exports.TrophySharedConfig = class TrophySharedConfig {
  static #keygen_erk = Buffer.alloc(16, 0);
  static #keygen_iv = Buffer.alloc(16, 0);
  static #keygen_set = false;
  #key = null;
  #commid = -1;

  constructor(commid) {
    this.setNetCommID(commid);
  }

  static setERK(key) {
    TrophySharedConfig.#keygen_erk.fill(key, 0, 16, 'hex');
    this.#keygen_set = true;
  }

  getNetCommKey() {
    return this.#key;
  }

  getNetCommID() {
    return this.#commid;
  }

  setNetCommID(id) {
    if (!TrophySharedConfig.#keygen_set) throw new Error('No trophy ERK set');
    if (id < 0) {
      this.#key = null;
      this.#commid = -1;
      return null;
    }

    const key_ciph = crypto.createCipheriv(CRYPTO_METHOD, TrophySharedConfig.#keygen_erk, TrophySharedConfig.#keygen_iv);
    this.#key = key_ciph.update(Buffer.from(`NPWR${String(id).padStart(5, '0')}_00\0\0\0\0`));
    this.#commid = id;
    key_ciph.destroy();

    return this.#key;
  }
};

class TrophyFile {
  static #validhdr = Buffer.from('<!--Sce-Np-Trophy');
  #tsc = null;
  #name = null;
  #bdata = null;
  #isEnc = false;

  constructor(tsc, name, data, flags) {
    this.#isEnc = Boolean(flags & 3 === 3);
    this.#name = name;
    this.#bdata = data;
    this.#tsc = tsc;
  }

  isImage() {
    return this.#name.endsWith('.PNG');
  }

  isXML() {
    return this.#name.endsWith('.ESFM');
  }

  getData() {
    if (this.#isEnc) {
      const buf = this.#bdata;
      const iv = buf.subarray(0, 16);
      const tsc = this.#tsc;

      let key = tsc.getNetCommKey();

      if (key === null) {
        const vh = TrophyFile.#validhdr;

        for (let i = 0; i < 99999; ++i) {
          key = tsc.setNetCommID(i);

          const test_deciph = crypto.createDecipheriv(CRYPTO_METHOD, key, iv);
          if (vh.compare(test_deciph.update(buf.subarray(16, 64)), 0, vh.length) === 0) {
            break;
          }

          key = tsc.setNetCommID(-1);
        }

        if (key === null) throw new Error('Failed to guess netcommid');
      }

      const data_deciph = crypto.createDecipheriv(CRYPTO_METHOD, key, iv);
      const final = Buffer.concat([data_deciph.update(buf.subarray(16)), data_deciph.final()]);
      data_deciph.destroy();

      return final;
    }

    return this.#bdata;
  }

  toString() {
    return `TrophyFile {name: ${this.#name}, encrypted: ${this.#isEnc}}`;
  }
};

module.exports.TrophyDataReader = class TrophyDataReader {
  #gname = 'Unnamed game';
  #trops = [];

  constructor(tf) {
    if (tf instanceof TrophyFile) {
      if (!tf.isXML()) throw new Error('Not a XML file');
      const xdata = xparser.xml2js(tf.getData());
      const trophyroot = xdata.elements.find((el) => el.name === 'trophyconf' && el.type === 'element');

      if (trophyroot) {
        trophyroot.elements.forEach((el) => {
          if (el.name !== 'trophy') {
            if (el.name === 'title-name') {
              try { // Just to be safe
                this.#gname = el.elements[0].text;
              } catch (e) { }
            }
            return;
          }

          const trophy = {
            id: parseInt(el.attributes.id),
            /* Unused for now, so there is no reason to actually send this data */
            // pid: parseInt(el.attributes.pid ?? -1),
            // gid: parseInt(el.attributes.gid ?? -1),
            hidden: el.attributes.hidden === 'yes',
            grade: el.attributes.ttype
          };

          if (el.elements) {
            trophy.name = el.elements.find((el) => el.name === 'name').elements[0].text;
            trophy.detail = el.elements.find((el) => el.name === 'detail').elements[0].text;
          }

          this.#trops.push(trophy);
        });
      }

      return;
    }

    throw new Error('Not a TrophyFile');
  }

  addImages(tp) {
    if (tp instanceof module.exports.Trophies) {
      for (const trop of this.#trops) {
        const pngf = tp.findFile(`TROP${String(trop.id).padStart(3, '0')}.PNG`);
        if (pngf) trop.icon = `data:image/png;base64,${pngf.getData().toString('base64')}`;
      }
      return;
    }

    throw new Error('Not a Trophies');
  }

  get array() {
    return this.#trops;
  }

  get length() {
    return this.#trops.length;
  }

  get name() {
    return this.#gname;
  }

  toString() {
    return `TrophyDataReader ${JSON.stringify(this.#trops, null, 2)}`;
  }
};

module.exports.Trophies = class Trophies {
  static #entries_offset = 96;
  static #entry_size = 64;
  #tsc = null;

  constructor(fpath, commid = -1) {
    this.#tsc = new module.exports.TrophySharedConfig(commid);
    const buf = this.buffer = fs.readFileSync(fpath);

    if (buf.readUint32BE(0) !== 3701624064) throw new Error('Invalid magic');
    if (buf.readUint32BE(4) !== 3) throw new Error('Invalid trp version');

    this.entries_num = buf.readUint32BE(16);
    if (buf.readUint32BE(20) !== Trophies.#entry_size) throw new Error('Invalid entry size');
  }

  getNetCommID() {
    return this.#tsc.getNetCommID();
  }

  resetNetCommID() {
    this.#tsc.setNetCommID(-1);
  }

  findFile(fname) {
    if (fname.length > 32) throw new Error('File name is too length');
    fname = fname.toUpperCase();
    const buf = this.buffer;

    for (let i = 0; i < this.entries_num; ++i) {
      const base = (Trophies.#entries_offset + (i * Trophies.#entry_size));
      if (buf.toString('utf-8', base, base + fname.length) !== fname) continue;

      const pos = Number(buf.readBigUint64BE(base + 32));
      const end = pos + Number(buf.readBigUint64BE(base + 32 + 8));
      const flags = buf.readUint32BE(base + 32 + 16);

      return new TrophyFile(this.#tsc, fname, buf.subarray(pos, end), flags);
    }

    return null;
  }
};
