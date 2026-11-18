# Plano de testes

**Gate 1 executado: 18 grupos de integração aprovados e quatro verificações de transporte aprovadas.** Resultados detalhados abaixo e em [evidências](evidence/gate1-results.json). A matriz descreve também testes manuais futuros, que não foram executados. Harness HTTP/WS inicia dois processos com configurações efêmeras, sem depender dos frontends. Manual web no Gate 2, mobile e ponta a ponta no Gate 3, regressão no Gate 4.

| ID | Tipo / gate | Procedimento | Resultado esperado |
|---|---|---|---|
| T01 | Integração G1; manual G2 | Login web correto e abrir WS | JWT web, acesso ao chat |
| T02 | Integração G1; manual G3 | Login mobile correto e abrir WS | JWT mobile, acesso ao chat |
| T03 | Integração G1; manual G2/G3 | Senha errada nas duas APIs | 401 genérico; erro visível, sem acesso |
| T04 | Integração G1; E2E manual G3 | Web envia texto único, ambos conectados | Mobile recebe uma vez, autor web; ACK remoto no web |
| T05 | Integração G1; E2E manual G3 | Mobile envia texto único | Web recebe uma vez, autor mobile; ACK remoto no app |
| T06 | Automatizado G1; manual G2/G3 | Null, vazio, espaços, 2000/2001 unidades, trim | Rejeições/limites conforme contrato; UI bloqueia vazio |
| T07 | Integração G1 | WS sem JWT, inválido, expirado e da outra API | 401 antes de upgrade; expiração de sessão ativa fecha 1008 |
| T08 | Integração G1 | chat.send com autor/origin/timestamp falsos | Envelope usa somente identidade e horário da API |
| T09 | Integração G1; manual G2/G3 | Parar cada peer alternadamente e tentar enviar | Erro correlacionado visível; nenhum falso ACK |
| T10 | Integração G1; E2E G3 | Reiniciar peer e enviar nova mensagem | Canal reconecta; ambos sentidos funcionam; sem replay |
| T11 | Integração G1 | JSON quebrado, binário, fragmentação, >16KiB | Erro/close previsto; nova conexão válida funciona, API viva |
| T12 | Integração G1 | Repetir ID/conteúdo em sequência e simultâneo | Uma publicação, mesmo resultado; conteúdo diferente rejeitado; sem eco |
| T13 | Integração G1 | Handshake interno sem chave/errado/JWT de usuário | 401; chave correta permite canal; segundo canal ativo 409 |
| T14 | Integração G1 | Suprimir ACK e cortar canal após recepção | Timeout 5s ou connection_lost; resultado incerto e sem retry automático |
| T15 | Integração G1; manual G3 | Cliente remoto offline, backend online | ACK remoto sem alegação de entrega; reconectar não recupera texto |
| T16 | Integração G1 | Não responder pong; encerrar processos | Detecção de perda, backoff limitado; cancelamento sem sockets retidos |
| T17 | Automatizado/integração G1 | Saturar pendências/cache; expirar retenção | busy nos limites; liberação por timeout/expiração; memória limitada |
| T18 | Manual G2/G3 | Logout, token vencido, teclado/toque, duas mensagens | Fecha socket; pede login; autoria legível e estado real |
| T19 | Integração/manual G2/G3 | Origin indevido no web; observar URLs dos clientes | Rejeição de Origin; cada cliente acessa só sua API |

Evidência por execução: data/hora São Paulo, versões/commit ou estado Git, comandos, configuração não secreta, IDs de mensagens, resultado esperado/observado e logs sanitizados. Guardar screenshots somente quando realmente capturadas. ACK perdido exige hook de teste ou peer simulado, não inferir a partir de um envio normal.

Gate 1: compilar ambas APIs e executar T01–T17 aplicáveis ao transporte, T19 de Origin. Gates 2/3: validar manualmente as UIs e provar T04/T05 com navegador e emulador reais. Gate 4: repetir matriz crítica com quatro processos iniciados do zero e preparar demonstração de 5–7 minutos. Não marcar teste manual como aprovado por cobertura de harness.

## Execução Gate 1 — 17/11/2026

Comandos: `node tests/integration/run.mjs` e `dotnet run --project tests/transport/TransportChecks.csproj`. Builds dos dois projetos: zero avisos/erros. Integração final 20:49:16–20:49:47 São Paulo, exit 0. Harness grava esperado/observado/status/IDs em [JSON](evidence/gate1-results.json) e [logs](evidence/gate1-services.txt).

| Cenários | Resultado observado / cobertura |
|---|---|
| T01–T03 | PASS: 200 nos logins válidos; 401 nas credenciais inválidas de ambas APIs |
| T04–T05 | PASS: dois processos reais, dois clientes WS, texto/autor/ACK correlacionado nos dois sentidos |
| T06/T08 | PASS: trim, 2000/2001, null/espaços; campos de autor forjados não substituem identidade autenticada |
| T07 | PASS: sem token, inválido, cruzado, issuer/audience errados, expirado; socket ativo fecha 1008 no vencimento |
| T09–T10 | PASS: queda/reinício de cada API, erro sem falso sucesso, reconexão e novas mensagens bidirecionais |
| T11 | PASS: JSON inválido/tipo/sala/ID inválidos, nomes duplicados, fragmentação; binário 1003 e excesso 1009; API continua |
| T12 | PASS: duplicata local simultânea, remota via peer de teste, conflito de conteúdo, ausência de eco, 10 envios concorrentes |
| T13 | PASS: falta/chave de usuário no canal interno rejeitada; serviço real autenticado; segundo canal recebe 409 |
| T14 | PASS com peer de teste: ACK suprimido dá timeout de 5s, resultado incerto, sem replay; ACK tardio/aleatório ignorado; perda durante pendência dá connection_lost |
| T15 | PASS: cliente remoto offline não impede ACK; reconexão não recebe histórico |
| T16 | PASS com peer de teste: ausência de pong gera desconexão/reconexão; heartbeat reduzido para 1s. Cancelamento interno em teste de transporte; Ctrl+C no smoke |
| T17 | PASS: 100 pendências, excesso busy, limpeza após perda; cache reduzido a 2/TTL 2s libera após expiração; máximo 1 cliente no processo de teste |
| T18 | NÃO EXECUTADO: UI/login/logout visual nos gates 2/3 |
| T19 | PASS na API: Origin indevido/ausente rejeitado na web; mobile nativo sem Origin aceito. Inspeção dos frontends NÃO EXECUTADA |

Quatro checks com socket simulado: 20 envios sem sobreposição; writer lento cancelado em 2s; fila de 100 não bloqueia publicação e remove cliente excedente; cancelamento encerra leitura/heartbeat e remove peer. Não substituem a integração real.

Uma regressão intermediária falhou em expiração com 1006; corrigida e repetida com PASS. Limites da evidência: sem carga prolongada, rede móvel real, encerramento sob carga ou medição estatística de backoff/jitter. Publicação em cliente lento validada por simulação controlada, não por throttling real de rede.
