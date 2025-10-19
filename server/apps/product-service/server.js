import { startProductService } from './src/index.js';

startProductService().catch((error) => {
  console.error('[product-service] Unable to start service:', error);
  process.exit(1);
});
