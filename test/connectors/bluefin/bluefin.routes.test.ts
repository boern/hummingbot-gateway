describe('Bluefin CLMM Routes', () => {
  // Import and run tests for each CLMM route
  require('./clmm-routes/poolInfo.test');
  require('./clmm-routes/positionsOwned.test');
  require('./clmm-routes/positionInfo.test');
  require('./clmm-routes/quotePosition.test');
  require('./clmm-routes/openPosition.test');
  require('./clmm-routes/addLiquidity.test');
  require('./clmm-routes/removeLiquidity.test');
  require('./clmm-routes/collectFees.test');
  require('./clmm-routes/closePosition.test');
  require('./clmm-routes/quoteSwap.test');
  require('./clmm-routes/executeSwap.test');
});
