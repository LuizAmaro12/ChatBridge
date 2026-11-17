# Plano de testes

**Todos os testes funcionais abaixo estão NÃO EXECUTADOS.** Gate 0 valida documentação/estrutura, não funcionalidades. Automação prevista no Gate 1: harness de integração HTTP/WS iniciando dois processos com configurações de teste, sem depender dos frontends. Testes unitários apenas para validação/correlação que tragam evidência útil. Manual web no Gate 2, mobile e ponta a ponta no Gate 3, regressão no Gate 4.

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
