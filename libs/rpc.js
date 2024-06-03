const DiscordRPC = require('discord-rpc');

const rpcClient = new DiscordRPC.Client({ transport: 'ipc' });

const STATES = [
  'Browsing the games list',
  'Playing a game'
];

module.exports.DRPC = class DRPC {
  #status = {
    state: '   ',
    details: STATES[0],
    startTimestamp: 0,
    largeImageKey: 'allblack',
    largeImageText: 'The PlayStation 4 emulator',
    // smallImageKey: '',
    // smallImageText: '',
    instance: false
  };

  constructor() {
    this.#status.startTimestamp = Date.now();

    rpcClient.on('ready', () => {
      this.renderStatus();

      setInterval(() => {
        this.renderStatus();
      }, 15e3);
    });

    rpcClient.login({ clientId: '1247271614459023424' }).catch(console.error);
  }

  setGame = (gname = null) => {
    const status = this.#status;

    status.startTimestamp = Date.now();
    status.details = STATES[gname === null ? 0 : 1];
    status.state = gname === null ? '   ' : gname;
  };

  renderStatus = async () => rpcClient.setActivity(this.#status);
};
