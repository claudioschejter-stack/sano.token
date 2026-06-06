const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true'
});

/** @param {import('next').NextConfig} config */
module.exports = function wrapWithAnalyzer(config) {
  return withBundleAnalyzer(config);
};
