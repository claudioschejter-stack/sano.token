console.log(
  JSON.stringify({
    appId: Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim()),
    secret: Boolean(process.env.PRIVY_APP_SECRET?.trim()),
    morphoWalletId: Boolean(process.env.PRIVY_MORPHO_LIQUIDITY_WALLET_ID?.trim()),
    morphoAddress: Boolean(process.env.MORPHO_LIQUIDITY_ADDRESS?.trim())
  })
);
