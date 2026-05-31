'use strict';

const path = require('path');

const connectorsRoot = path.join(
  path.dirname(require.resolve('@wagmi/connectors/package.json')),
  'dist/esm'
);

const coinbase = require(path.join(connectorsRoot, 'coinbaseWallet.js'));
const wc = require(path.join(connectorsRoot, 'walletConnect.js'));

module.exports = {
  coinbaseWallet: coinbase.coinbaseWallet,
  walletConnect: wc.walletConnect
};
