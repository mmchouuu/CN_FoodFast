const { startProductService } = require('./src/index');

startProductService().catch((error) => {
  console.error('[product-service] Unable to start service:', error);
  process.exit(1);
});
