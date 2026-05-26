import 'dotenv/config';
import { runSyntheticRwaFlow } from '../apps/web/src/lib/admin/syntheticRwaFlow';

function readArg(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

function resolveProjectId(): string | null {
  const projectId = readArg('--project-id');
  if (projectId) {
    return projectId;
  }

  return null;
}

async function main() {
  const projectId = resolveProjectId();
  if (!projectId && !process.argv.includes('--create-demo')) {
    throw new Error('Usá --project-id <id> o --create-demo para crear un asset de prueba.');
  }
  console.log(`[rwa-flow] Testing ${projectId ?? 'new demo project'}`);
  const result = await runSyntheticRwaFlow({ projectId: projectId ?? undefined, createDemo: !projectId });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
