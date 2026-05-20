import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function probePort(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: '127.0.0.1' });
    socket.setTimeout(1_500);
    socket.on('connect', () => {
      socket.end();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => resolve(false));
  });
}

function run(command, args, label) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, FORCE_COLOR: '1' }
  });

  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`[dev:all] ${label} exited with code ${code}`);
    }
  });

  return child;
}

async function main() {
  const postgresUp = await probePort(5432);
  const redisUp = await probePort(6379);

  console.log('\n🚀 Sanova RWA — dev:all\n');

  if (!postgresUp) {
    console.warn('⚠️  PostgreSQL no responde en localhost:5432');
    console.warn('   La API fallará sin base de datos. Opciones:');
    console.warn('   • npm run infra:up   (requiere Docker)');
    console.warn('   • Instalar PostgreSQL local y ejecutar npm run db:push\n');
  } else {
    console.log('✅ PostgreSQL detectado en :5432');
  }

  if (!redisUp) {
    console.warn('ℹ️  Redis no detectado en :6379 — usando BULL_ENABLED=false (ya en .env)\n');
  } else {
    console.log('✅ Redis detectado en :6379');
  }

  console.log('\n→ Web:  http://localhost:3000/marketplace');
  console.log('→ API:  http://localhost:4000/api/v1/health\n');

  const api = run('npm', ['run', 'api:dev'], 'API');
  const web = run('npm', ['run', 'web:dev'], 'Web');

  const stopAll = () => {
    api.kill('SIGINT');
    web.kill('SIGINT');
    process.exit(0);
  };

  process.on('SIGINT', stopAll);
  process.on('SIGTERM', stopAll);
}

main().catch((error) => {
  console.error('[dev:all] Failed:', error);
  process.exit(1);
});
