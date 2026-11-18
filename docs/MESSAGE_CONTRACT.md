# Contrato JSON v1 — implementado no Gate 1

UTF-8, nomes case-sensitive. Uma mensagem JSON por mensagem WebSocket lógica; aceitar fragmentação acumulando no máximo 16 KiB, inclusive no canal interno. Exceder limite fecha conexão com 1009; binário fecha com 1003. JSON inválido gera erro controlado; não derruba API. `type` obrigatório em todos os eventos. `messageId` UUID não vazio em eventos de chat, exceto erro sem ID recuperável (`null`). Eventos de conexão não usam ID de chat.

## Cliente → própria API

```json
{ "type": "chat.send", "messageId": "550e8400-e29b-41d4-a716-446655440000", "content": "Olá!" }
```

Todos os três campos obrigatórios; content string, aplicar Trim() e aceitar 1–2000 unidades UTF-16 (mesma contagem de string em C#/JS). Null, vazio e espaços: `invalid_content`; acima do limite: `content_too_long`. ID inválido: `invalid_message_id`. Cliente deve criar UUID para cada nova mensagem.

Campos extras de identidade (`senderId`, `senderName`, `origin`, `timestamp`) são ignorados; servidor sempre os reconstrói. Se `roomId` recebido, deve ser `general`; demais campos extras ignorados para compatibilidade. Duplicidade de nomes JSON deve ser rejeitada como `invalid_payload`. Cliente não pode enviar `chat.message` nem `chat.ack` (erro `unsupported_type`).

## API origem → API remota → cliente remoto

```json
{
  "type": "chat.message",
  "messageId": "550e8400-e29b-41d4-a716-446655440000",
  "roomId": "general",
  "senderId": "web-demo",
  "senderName": "Usuário Web",
  "origin": "web",
  "content": "Olá!",
  "timestamp": "2026-11-17T22:00:00Z"
}
```

Todos obrigatórios: strings, UUID válido, timestamp UTC ISO 8601 terminado em Z, roomId general, origin web/mobile, limites de content acima, senderId 1–64 e senderName 1–100 unidades UTF-16. Serviço receptor exige origin correspondente ao peer autenticado e identidade demo prevista para ele. Envelope criado exclusivamente pela API de origem; identidade do cliente nunca é confiável. Rejeição correlacionada com `invalid_payload`. Nenhum reencaminhamento ao serviço de origem.

## ACK remoto → API origem → cliente remetente

```json
{ "type": "chat.ack", "messageId": "550e8400-e29b-41d4-a716-446655440000", "status": "remote_received" }
```

Campos obrigatórios; status literal. API remota envia após receber, validar e aceitar a mensagem. A tentativa de publicação local é independente: sua conclusão e eventuais clientes lentos não atrasam o ACK nem bloqueiam a leitura interbackend. Falhas de publicação são tratadas separadamente e não transformam aceitação remota em confirmação de entrega. Zero clientes conectados também resulta em ACK. API origem só repassa ACK de pendência conhecida e peer esperado. ACK desconhecido/tardio é descartado com log de diagnóstico, sem alterar uma falha já exibida.

| Etapa | Evidência | Texto/efeito |
|---|---|---|
| Cliente enviou | Chamada local de envio | Enviando |
| API origem aceitou | Validação interna; sem ACK de sucesso antecipado | Continua Enviando |
| API remota aceitou | chat.ack remote_received | Recebida pelo outro backend |
| Publicação local tentada | Enfileiramento efêmero por cliente; pode falhar independentemente | Nenhuma confirmação adicional |
| Dispositivo recebeu/leu | Não há protocolo de confirmação do dispositivo | Não afirmar entrega ou leitura |

## Erros

```json
{ "type": "chat.error", "messageId": "550e8400-e29b-41d4-a716-446655440000", "code": "remote_unavailable", "message": "Sem conexão com o outro sistema. Tente novamente após reconectar." }
```

type, messageId, code e message obrigatórios; message string segura, sem stack/segredos. ID null quando JSON inválido ou ID não recuperável; não ecoar ID inválido arbitrário. APIs geram erros para seus clientes; peer pode responder erro de validação com o mesmo ID. Erro de peer desconhecido não afeta outras pendências.

| code | Significado/ação |
|---|---|
| invalid_json / invalid_payload | Corrigir formato; conexão pode continuar |
| invalid_message_id / invalid_room | Corrigir UUID/sala |
| invalid_content / content_too_long | Corrigir texto |
| unsupported_type | Tipo não permitido nesse canal |
| remote_unavailable | Canal indisponível antes do envio; falha clara |
| ack_timeout / connection_lost | Recepção remota incerta; não reenviar automaticamente |
| duplicate_conflict | ID reutilizado com conteúdo diferente |
| busy | Limite de pendências/cache alcançado; tentar depois |
| session_expired | Novo login; fechamento 1008 |

Timeout 5s: “Não foi possível confirmar a recepção; a mensagem pode ter chegado.” Perda do canal durante envio tem mesma incerteza. Sem promessa de exatamente-uma-vez.

## Conexão e heartbeat

```json
{ "type": "connection.status", "interbackend": "connected" }
```

API → seus clientes no início e em transições; campos obrigatórios, interbackend enum `connecting|connected|disconnected`. Estado do socket cliente é controlado pelo próprio frontend, separado do canal remoto. Não usar esse evento como garantia de sucesso de um envio.

```json
{ "type": "connection.ping", "nonce": "550e8400-e29b-41d4-a716-446655440001" }
```

```json
{ "type": "connection.pong", "nonce": "550e8400-e29b-41d4-a716-446655440001" }
```

Somente entre APIs, nonce UUID obrigatório, pong ecoa nonce; ping a cada 10s, timeout 10s. Não publicar em clientes. Tipos aceitos no canal interno: chat.message, chat.ack, chat.error, connection.ping/pong.

## Deduplicação e concorrência

Chave `(origin, senderId, messageId)`, retenção 10 minutos, limite 10.000 entradas por API incluindo pendências. Reserva atômica antes de publicação; guardar conteúdo normalizado e resposta final. Duplicata idêntica em andamento compartilha resultado; já concluída repete resposta sem republicar. Conteúdo diferente gera duplicate_conflict. Cache cheio sem entradas expiradas: busy, sem expulsar entradas válidas. API origem também evita encaminhar novamente ID retido, incluindo falhas de resultado incerto; nova tentativa explícita com novo ID pode duplicar conteúdo.

Reinício ou expiração perde deduplicação. Nenhum replay automático após reconexão; nenhum histórico para clientes offline. Clientes também unem mensagens visíveis pelo ID e origem. Sem loop porque só chat.send local inicia encaminhamento.

Limites implementados adicionais: 100 conexões de cliente por API, 100 eventos na fila de saída por cliente, 100 operações locais simultâneas por cliente e 100 ACKs pendentes por API. Cliente lento é removido/cancelado, sem reverter ACK remoto já emitido. As UIs e sua deduplicação visual serão implementadas nos gates 2/3.
