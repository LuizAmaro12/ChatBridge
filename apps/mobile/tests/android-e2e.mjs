// Real Android UI through ADB; real Next.js through isolated Edge; two real APIs.
// Requires Metro and an opened TalkToMe app in Expo Go. No app-only test hooks.
import { execFileSync, spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import path from 'node:path';
import { chromium, expect } from '../../web/node_modules/@playwright/test/index.mjs';
import WebSocket from '../../../tests/integration/node_modules/ws/wrapper.mjs';
const root = path.resolve(import.meta.dirname, '../../..');
const output = process.env.EVIDENCE_DIR ? path.resolve(process.env.EVIDENCE_DIR) : path.join(root, 'docs/evidence/gate3');
mkdirSync(output, { recursive: true });
const adbPath = path.join(process.env.LOCALAPPDATA, 'Android/Sdk/platform-tools/adb.exe');
const attached = execFileSync(adbPath, ['devices'], { windowsHide: true }).toString()
  .split(/\r?\n/).map(line => line.match(/^(\S+)\s+device$/)?.[1]).filter(Boolean);
const serial = process.env.ANDROID_SERIAL || (attached.length === 1 ? attached[0] : undefined);
if (!serial) throw new Error('Conecte um único Android autorizado ou defina ANDROID_SERIAL.');
const adb = (...args) => execFileSync(adbPath, ['-s', serial, ...args], { windowsHide: true, timeout: 20000 });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const decode = s => s.replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&lt;', '<').replaceAll('&gt;', '>');
function nodes() {
  adb('shell', 'uiautomator', 'dump', '/sdcard/talktome-window.xml');
  return [...adb('shell', 'cat', '/sdcard/talktome-window.xml').toString().matchAll(/<node\s+([^>]+)>?/g)]
    .map(match => Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], decode(m[2])])));
}
async function until(fn, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { const value = await fn(); if (value) return value; await sleep(200); }
  throw new Error('Condição não observada no prazo.');
}
const has = text => nodes().some(n => n.text.includes(text) || n['content-desc'].includes(text));
const waitText = async text => { try { return await until(() => has(text)); } catch { throw new Error(`Texto esperado não localizado: ${text}`); } };
function tapNode(node) {
  if (!node) throw new Error('Controle Android não localizado.');
  const [x1,y1,x2,y2] = node.bounds.match(/\d+/g).map(Number);
  adb('shell','input','tap',String(Math.floor((x1+x2)/2)),String(Math.floor((y1+y2)/2)));
}
function tap(label) { tapNode(nodes().find(n => n['content-desc'] === label && n.clickable === 'true')); }
async function fill(id, value) {
  tapNode(nodes().find(n => n['resource-id'] === id)); await sleep(250);
  adb('shell','input','keycombination','113','29'); adb('shell','input','keyevent','67');
  // Fixtures/passwords are ASCII, shell-quoted; never print credentials or command errors.
  if (value.length > 100) {
    for(let i=0;i<value.length;i+=20){adb('shell','input','text',"'"+value.slice(i,i+20).replaceAll("'","'\\''").replaceAll(' ','%s')+"'");await sleep(120);}
  } else if(value) adb('shell','input','text',"'" + value.replaceAll("'", "'\\''").replaceAll(' ', '%s') + "'");
}
const back = () => adb('shell','input','keyevent','4');
const shot = name => writeFileSync(path.join(output, `${name}.png`), adb('exec-out','screencap','-p'));
const report = { started: new Date().toISOString(), device: { serial, model: adb('shell','getprop','ro.product.model').toString().trim(), android: adb('shell','getprop','ro.build.version.release').toString().trim() }, results: [], flows: [] };
const processes = new Map();
const credentials = Object.fromEntries(['web','mobile'].map(role => [role,{ username: `${role}-demo`, password: randomBytes(16).toString('hex') }]));
const signing = { web: randomBytes(32).toString('hex'), mobile: randomBytes(32).toString('hex') };
const serviceKey = randomBytes(32).toString('hex');
async function start(role, seconds=3600) {
  const port = role === 'web' ? 5001 : 5002;
  const child = spawn('dotnet',[path.join(root,`services/${role}-api/bin/Debug/net10.0/ChatBridge.Api.dll`)],{
    cwd:root,windowsHide:true,stdio:'ignore',env:{...process.env,ASPNETCORE_ENVIRONMENT:'Development',ASPNETCORE_URLS:`http://localhost:${port}`,
      Auth__Issuer:`chatbridge-${role}`,Auth__Audience:`chatbridge-${role}-client`,Auth__SigningKey:signing[role],Auth__TokenSeconds:String(seconds),
      DemoUser__Username:credentials[role].username,DemoUser__Password:credentials[role].password,DemoUser__Name:role==='web'?'Usuário Web':'Usuário Mobile',
      Interbackend__ServiceKey:serviceKey,Interbackend__Url:'ws://localhost:5002/internal/ws',Cors__AllowedOrigin:'http://localhost:3000'}});
  processes.set(role,child);
  await until(async()=>{if(child.exitCode!==null)throw new Error(`API ${role} encerrou.`);try{return(await fetch(`http://localhost:${port}/health`)).ok;}catch{return false;}});
}
async function stop(role) {const child=processes.get(role);if(child&&child.exitCode===null){const done=once(child,'exit');child.kill();await done;}processes.delete(role);}
async function step(id, fn) {
  console.log(`Executando ${id}`);
  try { await fn(); report.results.push({id,status:'passed'}); console.log(`PASS ${id}`); }
  catch (error) { report.results.push({id,status:'failed',reason:error.message.startsWith('Texto esperado')?error.message:'Falha de asserção/controle ADB'}); shot('failure'); throw new Error(`Falha em ${id}; ${report.results.at(-1).reason}; screenshot failure.png.`); }
}
let browser;
try {
  for(const port of [3000,5001,5002]) {let busy=false;try{await fetch(`http://localhost:${port}`,{signal:AbortSignal.timeout(500)});busy=true;}catch{}if(busy)throw new Error(`Pare o serviço na porta ${port} antes do teste.`);}
  adb('reverse','tcp:5002','tcp:5002'); adb('reverse','tcp:8081','tcp:8081');
  adb('shell','am','force-stop','host.exp.exponent');
  adb('shell','am','start','-a','android.intent.action.VIEW','-d','exp://127.0.0.1:8081?__expo_disable_fab=1','host.exp.exponent');
  await until(()=>has('Entre na conversa'),60000);
  await start('mobile'); await start('web');
  const next=spawn(process.execPath,[path.join(root,'apps/web/node_modules/next/dist/bin/next'),'start','--hostname','localhost','--port','3000'],{cwd:path.join(root,'apps/web'),windowsHide:true,stdio:'ignore'});processes.set('next',next);
  await until(async()=>{try{return(await fetch('http://localhost:3000')).ok;}catch{return false;}});
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const events=[]; const requests=[];
  page.on('request',r=>requests.push(new URL(r.url()).origin));
  page.on('websocket',ws=>{requests.push(new URL(ws.url()).origin);ws.on('framereceived',f=>{try{events.push(JSON.parse(String(f.payload)));}catch{}});ws.on('framesent',f=>{try{const m=JSON.parse(String(f.payload));if(m.type==='chat.send')report.flows.push({direction:'browser → Android',...m});}catch{}});});
  await page.goto('http://localhost:3000');
  await page.getByLabel('Usuário').fill(credentials.web.username);await page.getByLabel('Senha',{exact:true}).fill(credentials.web.password);await page.getByRole('button',{name:'Entrar',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Conversa geral'})).toBeVisible();
  await step('M01 campos obrigatórios e login inválido',async()=>{
    await waitText('Entre na conversa');shot('login-android');tap('Entrar');await waitText('Informe usuário e senha.');
    await fill('username','mobile-demo');await fill('password','senha-incorreta');back();tap('Entrar');await waitText('Confira suas credenciais');shot('invalid-login-android');
  });
  await step('M02 login Mobile real e conexão autenticada',async()=>{
    await fill('password',credentials.mobile.password);back();tap('Entrar');await waitText('Conversa geral');await waitText('Canal entre serviços conectado');await waitText('Usuário Mobile');shot('empty-chat-android');
  });
  await step('M03 Web → Android e Android → Web com autoria e ACK',async()=>{
    const text='Ola Android! Mensagem enviada pelo navegador real.';
    await page.getByLabel('Sua mensagem').fill(text);await page.getByRole('button',{name:'Enviar',exact:true}).click();await waitText(text);await waitText('Usuário Web');
    await expect(page.getByText('Recebida pelo serviço remoto',{exact:true})).toBeVisible();
    const reply='Ola Web! Resposta enviada pelo Android fisico.';
    await fill('message-input',reply);shot('keyboard-android');tap('Enviar');await waitText('Recebida pelo serviço remoto');back();
    await expect(page.getByText(reply,{exact:true})).toBeVisible();await expect(page.getByText('Usuário Mobile',{exact:true})).toBeVisible();
    const envelope=events.find(e=>e.type==='chat.message'&&e.content===reply);if(!envelope||envelope.senderId!=='mobile-demo')throw new Error('Autoria inválida');
    report.flows.push({direction:'Android → browser',...envelope});
    if(requests.some(url=>url.includes(':5002')))throw new Error('Browser acessou Mobile API');
    shot('chat-android');await page.screenshot({path:path.join(output,'chat-browser.png')});
  });
  await step('M04 vazio e limite de 2000 caracteres',async()=>{
    await fill('message-input','   ');if(nodes().find(n=>n['content-desc']==='Enviar')?.enabled!=='false')throw new Error('Vazio habilitado');
    await fill('message-input','x'.repeat(2001));await waitText('Limite excedido');if(nodes().find(n=>n['content-desc']==='Enviar')?.enabled!=='false')throw new Error('Excesso habilitado');
    adb('shell','input','keyevent','67');await waitText('2000 / 2000');if(nodes().find(n=>n['content-desc']==='Enviar')?.enabled!=='true')throw new Error('Limite rejeitado');
    await fill('message-input','');back();
  });
  await step('M05 Web API indisponível, rascunho e recuperação',async()=>{
    await stop('web');await waitText('Canal entre serviços indisponível');await fill('message-input','Rascunho preservado durante queda da Web API');tap('Enviar');await waitText('Seu texto foi preservado');back();shot('remote-unavailable-android');
    await start('web');if(await page.getByRole('button',{name:'Reconectar',exact:true}).isVisible())await page.getByRole('button',{name:'Reconectar',exact:true}).click();await waitText('Canal entre serviços conectado');tap('Enviar');await waitText('Recebida pelo serviço remoto');
    await expect(page.getByText('Rascunho preservado durante queda da Web API',{exact:true})).toBeVisible({timeout:20000});
  });
  await step('M06 Mobile API indisponível e reconexão',async()=>{
    await fill('message-input','Rascunho na queda da Mobile API');back();await stop('mobile');await waitText('Reconectando');
    tap('Enviar');await waitText('Seu texto foi preservado');await start('mobile');if(nodes().some(n=>n['content-desc']==='Reconectar'))tap('Reconectar');await waitText('Canal entre serviços conectado');tap('Enviar');
    await expect(page.getByText('Rascunho na queda da Mobile API',{exact:true})).toBeVisible({timeout:20000});
  });
  await step('M07 segundo plano e retorno preservam rascunho',async()=>{
    await fill('message-input','Rascunho ao retornar');back();adb('shell','input','keyevent','3');await sleep(1000);
    adb('shell','am','start','-a','android.intent.action.VIEW','-d','exp://127.0.0.1:8081','host.exp.exponent');
    await waitText('Rascunho ao retornar');await waitText('Canal entre serviços conectado');tap('Enviar');
    await expect(page.getByText('Rascunho ao retornar',{exact:true})).toBeVisible();
  });
  await step('M09 ACK suprimido por peer de teste: incerto e sem replay',async()=>{
    await stop('web');await waitText('Canal entre serviços indisponível');
    const peer=new WebSocket('ws://localhost:5002/internal/ws',{headers:{Authorization:`Bearer ${serviceKey}`}});
    const received=[];
    peer.on('message',raw=>{const e=JSON.parse(String(raw));if(e.type==='connection.ping')peer.send(JSON.stringify({type:'connection.pong',nonce:e.nonce}));if(e.type==='chat.message')received.push(e);});
    await once(peer,'open');
    try {
      await waitText('Canal entre serviços conectado');await fill('message-input','Mensagem com ACK suprimido');tap('Enviar');back();
      await waitText('Não foi possível confirmar o recebimento');shot('uncertain-android');
      if(received.length!==1)throw new Error('Replay indevido');
      peer.send(JSON.stringify({type:'chat.ack',messageId:received[0].messageId,status:'remote_received'}));
      await sleep(1000);await waitText('Não foi possível confirmar o recebimento');
      report.flows.push({direction:'Android → controlled test peer (ACK deliberately suppressed)',...received[0],observedSendCount:received.length});
    } finally {peer.close();await once(peer,'close');}
    await start('web');if(await page.getByRole('button',{name:'Reconectar',exact:true}).isVisible())await page.getByRole('button',{name:'Reconectar',exact:true}).click();await waitText('Canal entre serviços conectado');
  });
  await step('M10 textos multilinha, longos e rolagem preservada',async()=>{
    const multiline='Primeira linha\nSegunda linha';
    await page.getByLabel('Sua mensagem').fill(multiline);await page.getByRole('button',{name:'Enviar',exact:true}).click();await waitText('Primeira linha');await waitText('Segunda linha');
    for(let i=0;i<14;i++){await page.getByLabel('Sua mensagem').fill(`Mensagem de rolagem ${i} - `+'texto longo '.repeat(8));await page.getByRole('button',{name:'Enviar',exact:true}).click();}
    await waitText('Mensagem de rolagem 13');
    adb('shell','input','swipe','350','550','350','1120','600');
    const before=nodes().filter(n=>n.text.startsWith('Mensagem de rolagem')).map(n=>n.text);
    if(!before.length)throw new Error('Rolagem não observada');
    await page.getByLabel('Sua mensagem').fill('Nova mensagem enquanto leio anteriores');await page.getByRole('button',{name:'Enviar',exact:true}).click();await sleep(800);
    const after=nodes().filter(n=>n.text.startsWith('Mensagem de rolagem')).map(n=>n.text);
    if(!before.some(t=>after.includes(t)))throw new Error('Posição de leitura perdida');shot('scroll-android');
  });
  await step('M08 logout limpa sessão; expiração real exige novo login',async()=>{
    tap('Sair');await waitText('Entre na conversa');if(nodes().find(n=>n['resource-id']==='password')?.text)throw new Error('Senha retida');
    await stop('mobile');await start('mobile',15);
    await fill('username','mobile-demo');await fill('password',credentials.mobile.password);back();tap('Entrar');await waitText('Conversa geral');
    await waitText('Sua sessão expirou');shot('session-expired-android');
  });
} catch(error) { console.error(error.message.startsWith('Falha em')?error.message:'Harness interrompido; investigar ambiente/controle de UI.');process.exitCode=1; }
finally {
  report.finished=new Date().toISOString();writeFileSync(path.join(output,'android-results.json'),JSON.stringify(report,null,2)+'\n');
  await browser?.close();for(const role of [...processes.keys()])await stop(role);
}
