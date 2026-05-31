/**
 * @scure/bip32 imports `bytes` from @noble/hashes/_assert; noble-hashes 1.8+ renamed it to `abytes`.
 */
const { abytes, aexists, anumber, aoutput } = require('@noble/hashes/utils');

module.exports = {
  bytes: abytes,
  abytes,
  aexists,
  anumber,
  aoutput
};
