# Plano de testes

## CI — cobertura configurada

`.github/workflows/ci.yml` configura builds/restores das APIs, quatro checks de transporte, 18 grupos de integração, Web typecheck/lint/build e W01–W08, Mobile typecheck/seis testes/Expo Doctor/export. Jobs backend/Web isolados e cenários sequenciais dentro deles. Dependências instaladas por npm ci; APIs por lockfiles NuGet. EVIDENCE_DIR temporário mantém histórico intacto.

Auditoria: quatro consultas Web/Mobile (full/omit=dev), sem bloqueio por vulnerabilidade; coleta inválida falha. `node --test scripts/ci/audit.test.mjs` cobre alertas reais reportados, zero alertas, exit inconsistente, erro de endpoint, JSON inválido/nulo, timeout e contagens inválidas. Simulação local de registro indisponível deve retornar exit 1 e quatro estados collection_error, não uma aprovação vazia.

Resultados hospedados devem ser conferidos nos passos/checks e artifacts da execução Actions; não deduzir aprovação da CI a partir do Gate 4. Critérios: falha de build/teste deixa job vermelho; resumo mostra contagens/exit codes npm; erro de infraestrutura é diferente de vulnerabilidade; passos pulados são NÃO EXECUTADOS. Limitações e execução local desta implementação estão em PROGRESS.

**Fora do runner:** M01–M10 no Android físico, ADB/reverse, teclado/Safe Area/AppState no aparelho, conforto de uso e testes manuais humanos. Permanecem validações independentes documentadas nos Gates anteriores. Exportação não é APK, e CI não faz deploy.

## Gate 4 — regressão executada em 18/11/2026

**Rodadas finais aprovadas:** 18 grupos de integração backend, quatro checks de transporte, oito cenários Web, seis testes Mobile e dez cenários no Android físico. Ambos builds .NET sem avisos/erros; Web typecheck/lint/build; Mobile typecheck/export e Expo Doctor 20/20. Não equivale a testes manuais humanos.

- [Resultados backend](evidence/gate4/backend-final/gate1-results.json), [Web W01–W08](evidence/gate4/web-final/results.json) e [Android M01–M10/IDs](evidence/gate4/android/android-results.json).
- [Comandos/checks e falhas iniciais de ambiente](evidence/gate4/checks.json). Falhas de sandbox foram repetidas fora dele; não são aprovação da primeira tentativa.
- `EVIDENCE_DIR` opcional aponta a pasta de cada rodada; instruções no README. Não sobrescrever evidências históricas. Testes de backend/Web/Android usam as mesmas portas e devem executar sequencialmente.
- Android físico Samsung SM-A055M/Android 15, Expo Go, ADB por USB; Edge real isolado. M03 usa ambas APIs reais; M09 usa peer autenticado controlado para perda de ACK. Sem APK próprio.
- Auditorias Web/Mobile completas e omit=dev, integração npm e NuGet das APIs executadas. [Segurança, advisories, alcance e decisão](evidence/gate4/security-analysis.md). Alertas remanescentes não foram classificados como resolvidos.
- UI/UX conferida por código, testes e capturas: login, autoria, feedback, teclado, limites, responsividade e rolagem. Revisão humana recomendada: fazer login nas duas telas, conversar nos dois sentidos, usar Tab/Enter, digitar com teclado virtual e avaliar conforto de leitura; TalkBack/fonte ampliada ainda NÃO EXECUTADOS.
- Permanecem não executados: emulador/iOS, outros dispositivos/navegadores, carga/rede degradada reais, TLS/produção, APK próprio e encerramento sob carga. Não apresentar esses cenários como aprovados.

As seções seguintes são históricas; o estado atual e as ressalvas estão no início de PROGRESS.

## Gate 3 — Android físico e transporte Mobile

**Execução final aprovada: 10/10 cenários físicos e 6/6 testes do transporte.** Android: 17/11/2026, 23:15:06–23:21:30 (São Paulo). Corrigidos handshake Origin e rolagem antes da aprovação. Build/exportação, TypeScript e Expo Doctor aprovados; não houve geração de APK próprio.

Projeto apps/mobile: `npm ci`, `npm run typecheck`, `npm test`, `npx expo-doctor`, `npm run export`; auditorias completa e omit=dev separadas. `export` compila bundle Android/Hermes, não APK. Testes unitários do transporte usam sockets controlados; prova ponta a ponta usa aplicativo React Native real no Expo Go e navegador Next.js real.

`npm run test:android` requer SDK/ADB, um Android USB autorizado (ANDROID_SERIAL quando necessário), Expo Go compatível, Metro em localhost:8081, Edge instalado e dependências Web/tests/integration. Antes: builds de ambas APIs e Web; portas 3000/5001/5002 livres. Harness cria contas/chaves efêmeras nos processos, sem alterar .env. Usa adb reverse 5002/8081 e interage com a UI por ADB. Manter aparelho desbloqueado e reservado; não usar simultaneamente outro dump/UI automation. Para uma execução estável do teste, iniciar Metro com `$env:CI='1'; npm run android` em terminal separado; CI é variável apenas desse processo, desabilitando Fast Refresh.

| ID | Cenário físico automatizado | Evidência/critério |
|---|---|---|
| M01 | Campos vazios, credenciais inválidas | Mensagens na tela; API real, sem acesso ao chat |
| M02 | Login mobile válido | Usuário Mobile, socket autenticado e canal remoto conectado |
| M03 | Navegador → Android e retorno | Duas APIs reais, autores, IDs e ACK; browser não chama porta 5002; screenshots de ambos |
| M04 | Vazio e 2000/2001 | Envio vazio/excessivo desabilitado; 2000 habilitado; digitação ADB em blocos |
| M05 | Parar/reiniciar Web API | Aviso na tentativa, rascunho preservado, nova mensagem chega ao browser |
| M06 | Parar/reiniciar Mobile API | Desconexão do app, preservação do rascunho e nova mensagem após retorno |
| M07 | Home/retorno ao app | Rascunho preservado; socket restabelecido sem replay |
| M08 | Logout e expiração real | Campos/sessão limpos; JWT de 15s emitido pela Mobile API expira e retorna ao login |
| M09 | Suprimir ACK com peer de teste autenticado | Mobile API real retorna resultado incerto; um envio; ACK tardio não vira sucesso |
| M10 | Multilinha, textos longos e scroll | Mensagens reais pelo Web; leitura anterior não é forçada ao fim |

Consultar [resultado de cada cenário e data](evidence/gate3/android-results.json); cenários ausentes ou com failed não são aprovados. M09 usa peer controlado no lugar da Web API apenas para injetar perda de ACK; a prova entre os dois backends reais é M03. Após falhas prolongadas de handshake, harness usa Reconectar quando oferecido — não confundir isso com reconexão automática ilimitada.

Seis testes unitários adicionais: payload mínimo/ACK/deduplicação; rejeição/rascunho/perda incerta; AppState/um socket/logout; limites/JSON inválido; watchdog real de 12s/ACK tardio/sem replay; expiração antes de reconectar. São testes do código TypeScript Mobile em Node, não testes de UI física.

Validação visual: screenshots reais login/chat, teclado aberto, falha remota e expiração. Safe Area e compositor conferidos no Samsung SM-A055M (720×1600, Android 15). Não substituir essa evidência por viewport de navegador. NÃO EXECUTADOS: emulador, iOS, outro tamanho de aparelho, rotação (app restrito a retrato), TalkBack manual, rede celular/Wi-Fi real degradada, APK independente assinado, execução prolongada em background e carga prolongada. Validação humana de conforto de digitação/leitura permanece recomendada; automação por ADB não equivale a avaliação subjetiva manual.

Auditoria: preservar registro dos 12 alertas altos do Web e analisar separadamente Mobile. Gate 4 deve reconsultar advisories, atualizações compatíveis e impacto nos builds/testes. Não aplicar audit fix --force neste gate.

## Gate 2 — navegador real

Comandos em apps/web: `npm ci --no-audit`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`. Playwright inicia Next em produção, dois backends reais e cliente WS mobile de teste. Microsoft Edge headless em contexto isolado; Node 24.18.0, Windows x64. Evidências em [resultados](evidence/gate2/results.json) e [IDs dos fluxos](evidence/gate2/flows.json).

| ID | Verificação | Cobertura |
|---|---|---|
| W01 | Login obrigatório, inválido, carregamento, sucesso e estado vazio | API real; atraso controlado da resposta real para observar loading; um único POST |
| W02 | Web ↔ cliente mobile por ambas APIs, autor e ACK; vazio, 2000/2001, Shift+Enter, HTML textual seguro | Sem acesso do navegador à Mobile API; nenhum erro JS de página no cenário |
| W03 | Mobile API indisponível e retorno | Estado local conectado separado do remoto; tentativa mostra erro, rascunho preservado, envio após reconexão |
| W04 | Queda/retorno Web API e logout | Reconexão automática; rascunho mantido; logout sem novos sockets; reload volta ao login |
| W05 | Responsividade e rolagem | 320/375/768/1280 px, desktop 1440; sem overflow horizontal; compositor acessível; texto longo; leitura anterior não é deslocada; usuário visível |
| W06 | Sessão de 3s emitida pela API | Expira, encerra chat, exibe aviso e pede novo login; senha vazia |
| W07 | ACK perdido no retorno ao navegador | Mensagem chegou ao cliente real; resposta real é suprimida; estado incerto em 12s, um único envio, ACK tardio ignorado |
| W08 | Rejeição real com estado remoto desatualizado | Status de conexão é retido pelo teste; API retorna erro real, UI mostra falha conhecida e recupera texto |

As capturas em evidence/gate2 foram produzidas pelos testes e inspecionadas visualmente. Duas falhas iniciais eram seletores ambíguos para role=alert (anunciador do Next), e uma para texto exato do usuário com rótulo aninhado; corrigidas nos testes. Falha de lint no helper (catch vazio) corrigida com descrição do caso esperado.

Backends/contrato/scripts do Gate 1 não foram alterados; não houve necessidade de repetir sua matriz completa. O Gate 2 exercita os dois processos reais novamente. NÃO EXECUTADOS: Expo, dispositivo físico, Firefox/Safari, leitor de tela real, teclado virtual móvel e carga prolongada. A responsividade testada é viewport de navegador desktop, não aplicativo nativo.

O resumo e o resultado final de cada execução são gravados em results.json; consultar PROGRESS para a última execução validada.

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
