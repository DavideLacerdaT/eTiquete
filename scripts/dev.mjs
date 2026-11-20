import { spawn } from 'node:child_process';
const children = [
  spawn(process.execPath, ['services/gateway/server.mjs'], { stdio: 'inherit' }),
  spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', '--config', 'frontend/vite.config.js'],
    { stdio: 'inherit' },
  ),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
for (const child of children) {
  child.on('exit', (code) => stop(code || 0));
  child.on('error', () => stop(1));
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
