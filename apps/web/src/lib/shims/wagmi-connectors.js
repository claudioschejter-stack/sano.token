'use strict';

const path = require('path');

const connectorsRoot = path.join(
  __dirname,
  '../../../../../node_modules/@wagmi/connectors/dist/esm'
);

const coinbase = require(path.join(connectorsRoot, 'coinbaseWallet.js'));
const wc = require(path.join(connectorsRoot, 'walletConnect.js'));

module.exports = {
  coinbaseWallet: coinbase.coinbaseWallet,
  walletConnect: wc.walletConnect
};
