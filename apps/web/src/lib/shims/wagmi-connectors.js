'use strict';

const coinbase = require('../../../../../node_modules/@wagmi/connectors/dist/esm/coinbaseWallet.js');
const metaMaskMod = require('../../../../../node_modules/@wagmi/connectors/dist/esm/metaMask.js');
const injectedMod = require('../../../../../node_modules/@wagmi/core/dist/esm/connectors/injected.js');
const wc = require('../../../../../node_modules/@wagmi/connectors/dist/esm/walletConnect.js');

module.exports = {
  coinbaseWallet: coinbase.coinbaseWallet,
  metaMask: metaMaskMod.metaMask,
  injected: injectedMod.injected,
  walletConnect: wc.walletConnect
};
