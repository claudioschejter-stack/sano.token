'use strict';

const coinbase = require('../../../../../node_modules/@wagmi/connectors/dist/esm/coinbaseWallet.js');
const wc = require('../../../../../node_modules/@wagmi/connectors/dist/esm/walletConnect.js');

module.exports = {
  coinbaseWallet: coinbase.coinbaseWallet,
  walletConnect: wc.walletConnect
};
