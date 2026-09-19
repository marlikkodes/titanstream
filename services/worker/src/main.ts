import dotenv from 'dotenv';
dotenv.config();

console.log('====================================================');
console.log('🚀 TitanStream Operations & Queue Worker Active');
console.log('====================================================');

let isShuttingDown = false;

async function runSweeperCycle() {
  if (isShuttingDown) return;
  console.log(`[WorkerHeartbeat] Running background sweeper cycle at ${new Date().toISOString()}...`);
  // Background queue processing routines for payment order expirations, ledger sweepers, & automated notifications
}

// Run initial sweep cycle
runSweeperCycle();

// Run every 60 seconds
const timer = setInterval(runSweeperCycle, 60000);

function handleShutdown(signal: string) {
  console.log(`[Worker] Received ${signal}. Shutting down gracefully...`);
  isShuttingDown = true;
  clearInterval(timer);
  process.exit(0);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
