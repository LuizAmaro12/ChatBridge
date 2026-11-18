import { test, expect, type Page, type WebSocketRoute } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { credentials, start, stop, stopAll, connected, mobileClient, assertServicesFree } from './services';

const evidence = path.resolve('../../docs/evidence/gate2');
const flows: object[] = [];
async function enter(page: Page) {
  await page.goto('/');
  await page.getByLabel('Usuário', { exact: true }).fill(credentials.web.username);
  await page.getByLabel('Senha', { exact: true }).fill(credentials.web.password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Conversa geral' })).toBeVisible();
  await expect(page.getByText('Você: Conectado', { exact: true })).toBeVisible();
  await expect(page.getByText('Serviço remoto: Disponível', { exact: true })).toBeVisible();
}
test.beforeAll(async () => {
  mkdirSync(evidence, { recursive: true });
  await assertServicesFree(); await start('mobile'); await start('web'); await connected();
});
test.afterAll(async () => {
  await stopAll();
  writeFileSync(path.join(evidence, 'flows.json'), JSON.stringify(flows, null, 2) + '\n');
});

test('W01 login obrigatório, inválido, carregamento e sucesso real', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Conversa geral' })).toHaveCount(0);
  await page.screenshot({ path: path.join(evidence, 'login-desktop.png'), fullPage: true });
  await page.getByLabel('Usuário', { exact: true }).fill(credentials.web.username);
  await page.getByLabel('Senha', { exact: true }).fill('senha-incorreta');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.locator('.login-form').getByRole('alert')).toHaveText('Não foi possível entrar. Confira suas credenciais.');
  let requests = 0;
  await page.route('http://localhost:5001/auth/login', async route => {
    requests++;
    const response = await route.fetch(); // Real API response; delay only to observe loading state.
    await new Promise(resolve => setTimeout(resolve, 400));
    await route.fulfill({ response });
  });
  await page.getByLabel('Senha', { exact: true }).fill(credentials.web.password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Entrando…' })).toBeDisabled();
  await expect(page.getByRole('heading', { name: 'Conversa geral' })).toBeVisible();
  expect(requests).toBe(1);
  await expect(page.getByText('Sua conversa começa aqui')).toBeVisible();
});

test('W02 Web ↔ Mobile real, autoria, ACK, texto seguro e compositor', async ({ page }) => {
  let pageErrors = 0;
  page.on('pageerror', () => pageErrors++);
  const endpoints: string[] = [];
  page.on('request', request => endpoints.push(new URL(request.url()).origin));
  page.on('websocket', socket => endpoints.push(new URL(socket.url()).origin));
  const peer = await mobileClient();
  try {
    await enter(page);
    const input = page.getByLabel('Sua mensagem', { exact: true });
    await input.fill('   '); await expect(page.getByRole('button', { name: 'Enviar', exact: true })).toBeDisabled();
    await input.fill('x'.repeat(2001));
    await expect(page.getByText('2.001 / 2.000 · Limite excedido')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enviar', exact: true })).toBeDisabled();
    await input.fill('Olá, Mobile! A conversa já está funcionando.'); await input.press('Enter');
    const received = await peer.receive('Olá, Mobile! A conversa já está funcionando.');
    expect(received.senderId).toBe('web-demo');
    await expect(page.getByText('Recebida pelo serviço remoto', { exact: true })).toHaveCount(1);
    flows.push({ direction: 'browser → Web API → Mobile API → test client', ...received });
    const content = 'Olá, Web! Recebi sua mensagem.\nVamos conversar por aqui.';
    const messageId = await peer.send(content);
    await expect(page.locator('.message-text').filter({ hasText: 'Olá, Web! Recebi sua mensagem.' })).toBeVisible();
    await expect(page.getByText('Usuário Mobile', { exact: true })).toBeVisible();
    await expect(page.locator('time')).toHaveCount(1);
    flows.push({ direction: 'test client → Mobile API → Web API → browser', messageId, content });
    await page.screenshot({ path: path.join(evidence, 'chat-desktop.png'), fullPage: true });
    await peer.send('<img src=x onerror=alert(1)>');
    await expect(page.getByText('<img src=x onerror=alert(1)>', { exact: true })).toBeVisible();
    await expect(page.locator('.message-scroll img')).toHaveCount(0);
    await input.fill('Primeira linha'); await input.press('Shift+Enter'); await input.type('Segunda linha'); await input.press('Enter');
    await peer.receive('Primeira linha\nSegunda linha');
    await input.fill('a'.repeat(2000)); await input.press('Enter'); await peer.receive('a'.repeat(2000));
    expect(endpoints.some(origin => origin.includes(':5002'))).toBe(false);
    expect(endpoints).toContain('ws://localhost:5001');
    expect(pageErrors).toBe(0);
  } finally { peer.close(); }
});

test('W03 serviço remoto indisponível, rascunho e recuperação', async ({ page }) => {
  await enter(page);
  await stop('mobile');
  await expect(page.getByText('Serviço remoto: Indisponível', { exact: true })).toBeVisible();
  await expect(page.getByText('Você: Conectado', { exact: true })).toBeVisible();
  await page.getByLabel('Sua mensagem', { exact: true }).fill('Meu rascunho permanece aqui.');
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(page.locator('.composer').getByRole('alert')).toContainText('Não foi possível enviar');
  await expect(page.getByLabel('Sua mensagem', { exact: true })).toHaveValue('Meu rascunho permanece aqui.');
  await expect(page.getByText('Recebida pelo serviço remoto', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: path.join(evidence, 'remote-unavailable.png'), fullPage: true });
  await start('mobile'); await connected();
  const peer = await mobileClient();
  try {
    await expect(page.getByText('Serviço remoto: Disponível', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Enviar', exact: true }).click();
    await peer.receive('Meu rascunho permanece aqui.');
    await expect(page.getByText('Recebida pelo serviço remoto', { exact: true })).toBeVisible();
  } finally { peer.close(); }
});

test('W04 queda da Web API, reconexão e logout sem reconexões posteriores', async ({ page }) => {
  await enter(page);
  await page.getByLabel('Sua mensagem', { exact: true }).fill('Rascunho durante reconexão');
  await stop('web');
  await expect(page.getByText('Você: Reconectando…', { exact: true })).toBeVisible();
  await start('web'); await connected();
  await expect(page.getByText('Você: Conectado', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Sua mensagem', { exact: true })).toHaveValue('Rascunho durante reconexão');
  let openings = 0;
  page.on('websocket', () => openings++);
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
  await page.waitForTimeout(1500);
  expect(openings).toBe(0);
  await page.reload();
  await expect(page.getByLabel('Senha', { exact: true })).toHaveValue('');
  await expect(page.getByRole('heading', { name: 'Conversa geral' })).toHaveCount(0);
});

test('W05 responsividade, textos longos e rolagem preservada', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.screenshot({ path: path.join(evidence, 'login-mobile.png'), fullPage: true });
  await enter(page);
  const peer = await mobileClient();
  try {
    await expect(page.locator('.account-name')).toBeVisible();
    await expect(page.locator('.account-name')).toContainText('Usuário Web');
    await peer.send('Texto sem espaços: ' + 'a'.repeat(300));
    for (let i = 0; i < 8; i++) await peer.send(`Mensagem ${i + 1}: conferindo a leitura e a rolagem em uma tela menor.`);
    await expect(page.locator('.message-row')).toHaveCount(9);
    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(horizontalOverflow).toBe(false);
    await expect(page.getByLabel('Sua mensagem', { exact: true })).toBeInViewport();
    await page.screenshot({ path: path.join(evidence, 'chat-mobile.png'), fullPage: true });
    await page.locator('.message-scroll').evaluate(element => { element.scrollTop = 0; });
    await page.waitForTimeout(100);
    await peer.send('Nova mensagem enquanto você lê as anteriores.');
    await expect(page.locator('.message-row')).toHaveCount(10);
    expect(await page.locator('.message-scroll').evaluate(element => element.scrollTop)).toBeLessThan(100);
    for (const width of [320, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      await expect(page.getByLabel('Sua mensagem', { exact: true })).toBeInViewport();
    }
  } finally { peer.close(); }
});

test('W07 ACK perdido no navegador: resultado incerto, sem replay ou confirmação tardia', async ({ page }) => {
  let sends = 0;
  let delayedAck = '';
  let routeToBrowser: WebSocketRoute | undefined;
  await page.routeWebSocket('ws://localhost:5001/ws/chat**', route => {
    routeToBrowser = route;
    const server = route.connectToServer();
    route.onMessage(message => {
      if (JSON.parse(String(message)).type === 'chat.send') sends++;
      server.send(message);
    });
    server.onMessage(message => {
      if (JSON.parse(String(message)).type === 'chat.ack') delayedAck = String(message);
      else route.send(message);
    });
  });
  const peer = await mobileClient();
  try {
    await enter(page);
    await page.getByLabel('Sua mensagem', { exact: true }).fill('Confirmação perdida no caminho de volta.');
    await page.getByRole('button', { name: 'Enviar', exact: true }).click();
    await peer.receive('Confirmação perdida no caminho de volta.');
    await expect(page.getByText('Enviando…', { exact: true })).toBeVisible();
    await expect(page.getByText('Não foi possível confirmar o recebimento', { exact: false })).toBeVisible({ timeout: 15000 });
    expect(sends).toBe(1); expect(delayedAck).not.toBe('');
    routeToBrowser!.send(delayedAck);
    await page.waitForTimeout(250);
    await expect(page.getByText('Recebida pelo serviço remoto', { exact: true })).toHaveCount(0);
    await page.screenshot({ path: path.join(evidence, 'uncertain-result.png'), fullPage: true });
  } finally { peer.close(); }
});

test('W08 falha conhecida recebida da API recupera o texto', async ({ page }) => {
  let hideStatus = false;
  await page.routeWebSocket('ws://localhost:5001/ws/chat**', route => {
    const server = route.connectToServer();
    server.onMessage(message => {
      if (hideStatus && JSON.parse(String(message)).type === 'connection.status') return;
      route.send(message);
    });
  });
  await enter(page);
  hideStatus = true; // Reproduce a stale status followed by the real backend rejection.
  await stop('mobile');
  await page.getByLabel('Sua mensagem', { exact: true }).fill('Uma falha conhecida preserva este texto.');
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(page.getByText('Não foi possível enviar', { exact: false })).toBeVisible();
  await expect(page.getByLabel('Sua mensagem', { exact: true })).toHaveValue('Uma falha conhecida preserva este texto.');
  await expect(page.getByText('Recebida pelo serviço remoto', { exact: true })).toHaveCount(0);
  await start('mobile'); await connected();
});

test('W06 sessão curta expira e exige novo login', async ({ page }) => {
  await stop('web'); await start('web', 3); await connected();
  await enter(page);
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible({ timeout: 8000 });
  await expect(page.getByText('Sua sessão expirou. Entre novamente.')).toBeVisible();
  await expect(page.getByLabel('Senha', { exact: true })).toHaveValue('');
  await page.screenshot({ path: path.join(evidence, 'session-expired.png'), fullPage: true });
});
