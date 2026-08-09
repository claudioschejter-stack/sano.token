import { beforeEach, describe, expect, it, vi } from 'vitest';

type Project = { tokenSymbol: string | null; contractAddress: string | null };

let projects: Record<string, Project> = {};
let lookupThrows = false;
const emails: Array<{ subject: string; text: string }> = [];
const slack: string[] = [];

vi.mock('@sanova/database', () => ({
  prisma: {
    project: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        if (lookupThrows) throw new Error('db down');
        return projects[where.id] ?? null;
      }
    }
  }
}));

vi.mock('../email/sendTransactionalEmail', () => ({
  sendTransactionalEmail: async (input: { subject: string; text: string }) => {
    emails.push(input);
  }
}));

const originalFetch = globalThis.fetch;

beforeEach(() => {
  emails.length = 0;
  slack.length = 0;
  lookupThrows = false;
  projects = {
    'proj-uv2': { tokenSymbol: 'ANELO UV2 RWA', contractAddress: '0x1dD753e74C68E5Acfa4846D5336e7D552C999664' },
    'proj-uv3': { tokenSymbol: 'UV3RWA', contractAddress: '0x481fAa4102Fb080e8291cA49d1e70bA42d36c8F1' }
  };
  process.env.AUTH_ADMIN_EMAILS = 'ops@sanova.test';
  process.env.AUTOMATION_SLACK_WEBHOOK_URL = 'https://slack.test/hook';
  globalThis.fetch = (async (_url: string, init: { body: string }) => {
    slack.push(JSON.parse(init.body).text);
    return { ok: true } as Response;
  }) as unknown as typeof fetch;
});

const load = () => import('./automationAlerts');

describe('notifyAutomationIssue', () => {
  it('pone el código del token adelante, sin que el llamador lo pida', async () => {
    const { notifyAutomationIssue } = await load();

    await notifyAutomationIssue({
      projectId: 'proj-uv3',
      title: 'AÑELO - APART HOTEL URBAN VIEW',
      message: 'algo pasó'
    });

    expect(emails[0].subject).toContain('[UV3RWA]');
  });

  it('hace distinguibles dos alertas cuyos títulos son iguales', async () => {
    const { notifyAutomationIssue } = await load();
    const title = 'APART HOTEL URBAN VIEW - AÑELO';

    await notifyAutomationIssue({ projectId: 'proj-uv2', title, message: 'x' });
    await notifyAutomationIssue({ projectId: 'proj-uv3', title, message: 'x' });

    expect(emails[0].subject).not.toBe(emails[1].subject);
    expect(emails[0].subject).toContain('ANELO UV2 RWA');
    expect(emails[1].subject).toContain('UV3RWA');
  });

  it('nombra el contrato sobre el que hay que actuar', async () => {
    const { notifyAutomationIssue } = await load();

    await notifyAutomationIssue({ projectId: 'proj-uv3', title: 'x', message: 'y' });

    expect(emails[0].text).toContain('0x481fAa4102Fb080e8291cA49d1e70bA42d36c8F1');
  });

  it('deja pasar una alerta que no es de un proyecto', async () => {
    const { notifyAutomationIssue } = await load();

    await notifyAutomationIssue({
      projectId: 'platform',
      title: 'Base de datos atrasada',
      message: 'faltan migraciones'
    });

    expect(emails[0].subject).toContain('Base de datos atrasada');
    expect(emails[0].subject).not.toContain('[');
  });

  it('manda el aviso igual si la base no puede resolver el código', async () => {
    // Una base caída es motivo para avisar, no para callarse.
    lookupThrows = true;
    const { notifyAutomationIssue } = await load();

    await notifyAutomationIssue({ projectId: 'proj-uv3', title: 'Vault pausado', message: 'x' });

    expect(emails).toHaveLength(1);
    expect(emails[0].subject).toContain('Vault pausado');
  });

  it('también manda el código a Slack', async () => {
    const { notifyAutomationIssue } = await load();

    await notifyAutomationIssue({ projectId: 'proj-uv2', title: 'x', message: 'y' });

    expect(slack[0]).toContain('ANELO UV2 RWA');
  });

  it('no manda nada si no hay destinatarios configurados', async () => {
    process.env.AUTH_ADMIN_EMAILS = '';
    const { notifyAutomationIssue } = await load();

    await notifyAutomationIssue({ projectId: 'proj-uv3', title: 'x', message: 'y' });

    expect(emails).toHaveLength(0);
  });
});

describe('notifyCircuitBreaker', () => {
  it('también identifica por código, porque comparte el mismo camino', async () => {
    const { notifyCircuitBreaker } = await load();

    await notifyCircuitBreaker('proj-uv3', 'AÑELO - APART HOTEL URBAN VIEW', 'anomalías on-chain');

    expect(emails[0].subject).toContain('[UV3RWA]');
  });
});

globalThis.fetch = originalFetch;
