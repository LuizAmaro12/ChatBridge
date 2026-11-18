import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ChatClient } from '../src/services/chat-client';
import { parseServerEvent } from '../src/services/protocol';

class Socket {
  readyState = 0; sent: Record<string, unknown>[] = []; closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  open() { this.readyState = 1; this.onopen?.(); this.receive({ type: 'connection.status', interbackend: 'connected' }); }
  receive(event: unknown) { this.onmessage?.({ data: JSON.stringify(event) }); }
  send(raw: string) { this.sent.push(JSON.parse(raw)); }
  close(code = 1000) { this.closed = true; this.readyState = 3; this.onclose?.({ code }); }
}
const session = () => ({ accessToken: 'test-only', expiresAt: new Date(Date.now() + 60000).toISOString(), user: { id: 'mobile-demo', name: 'Usuário Mobile' } });
const turn = () => new Promise(resolve => setTimeout(resolve, 5));
async function setup() {
  const sockets: Socket[] = [];
  const client = new ChatClient(randomUUID, () => { const s = new Socket(); sockets.push(s); return s as unknown as WebSocket; });
  client.start(session(), () => {}); await turn(); sockets[0].open();
  return { client, sockets, socket: sockets[0] };
}
test('payload mínimo, ACK correlacionado e deduplicação visual', async () => {
  const {client,socket}=await setup();
  try {
    client.setDraft('  teste  '); assert.equal(client.send(),true);
    assert.deepEqual(Object.keys(socket.sent[0]).sort(),['content','messageId','type']);
    assert.equal(socket.sent[0].content,'teste');
    socket.receive({type:'chat.ack',messageId:randomUUID(),status:'remote_received'});
    assert.equal(client.getSnapshot().messages[0].state,'sending');
    socket.receive({type:'chat.ack',messageId:socket.sent[0].messageId,status:'remote_received'});
    assert.equal(client.getSnapshot().messages[0].state,'confirmed');
    assert.equal(client.getSnapshot().messages[0].timestamp,undefined);
    const incoming={type:'chat.message',messageId:randomUUID(),origin:'web',roomId:'general',senderId:'web-demo',senderName:'Usuário Web',content:'oi',timestamp:new Date().toISOString()};
    socket.receive(incoming);socket.receive(incoming);assert.equal(client.getSnapshot().messages.length,2);
  } finally {client.stop();}
});
test('rejeição conhecida restaura rascunho; perda da conexão é incerta e não tem replay',async()=>{
  const {client,socket}=await setup();
  try {
    client.setDraft('rejeitada');client.send();
    socket.receive({type:'chat.error',messageId:socket.sent[0].messageId,code:'remote_unavailable',message:'indisponível'});
    assert.equal(client.getSnapshot().messages[0].state,'failed');assert.equal(client.getSnapshot().draft,'rejeitada');
    client.setDraft('resultado incerto');client.send();const id=socket.sent[1].messageId;
    socket.close(1006);assert.equal(client.getSnapshot().messages[1].state,'uncertain');
    socket.receive({type:'chat.ack',messageId:id,status:'remote_received'});
    assert.equal(client.getSnapshot().messages[1].state,'uncertain');assert.equal(socket.sent.length,2);
  } finally {client.stop();}
});
test('segundo plano fecha socket; retorno abre um só; logout apaga estado',async()=>{
  const {client,socket,sockets}=await setup();
  try {
    client.setDraft('preservar');client.setActive(false);assert.equal(socket.closed,true);
    client.reconnect();assert.equal(sockets.length,1);client.setActive(true);assert.equal(sockets.length,2);
    client.setActive(true);assert.equal(sockets.length,2);assert.equal(client.getSnapshot().draft,'preservar');
    client.stop();assert.equal(sockets[1].closed,true);assert.equal(client.getSnapshot().draft,'');
    client.reconnect();assert.equal(sockets.length,2);
  } finally {client.stop();}
});
test('vazio, limite e protocolo inválido',async()=>{
  const {client,socket}=await setup();try{
    for(const value of ['','   ','x'.repeat(2001)]){client.setDraft(value);assert.equal(client.send(),false);}
    assert.equal(socket.sent.length,0);client.setDraft('x'.repeat(2000));assert.equal(client.send(),true);
    assert.equal(parseServerEvent('{broken'),null);assert.equal(parseServerEvent('{"type":"chat.ack","messageId":"x","status":"remote_received"}'),null);
  }finally{client.stop();}
});
test('watchdog real de 12s: ACK perdido fica incerto, sem reenvio e sem aceitar ACK tardio',async()=>{
  const {client,socket}=await setup();try{
    client.setDraft('ACK perdido');client.send();await new Promise(resolve=>setTimeout(resolve,12100));
    assert.equal(client.getSnapshot().messages[0].state,'uncertain');assert.equal(socket.sent.length,1);
    socket.receive({type:'chat.ack',messageId:socket.sent[0].messageId,status:'remote_received'});
    assert.equal(client.getSnapshot().messages[0].state,'uncertain');
  }finally{client.stop();}
});
test('retorno do background verifica sessão expirada antes de conectar',async()=>{
  const sockets:Socket[]=[];let ended=false;
  const client=new ChatClient(randomUUID,()=>{const s=new Socket();sockets.push(s);return s as unknown as WebSocket;});
  client.start({...session(),expiresAt:new Date(Date.now()+30).toISOString()},()=>{ended=true;});
  await turn();client.setActive(false);await new Promise(resolve=>setTimeout(resolve,50));client.setActive(true);
  assert.equal(ended,true);assert.equal(sockets.length,1);client.stop();
});
