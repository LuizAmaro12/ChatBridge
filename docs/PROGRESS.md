# Progresso — ChatBridge

## Gate 3 — resultado final (17/11/2026)

**Aplicativo React Native/Expo implementado e funcionalmente validado no Android físico. Gate 3 pronto para revisão. Gate 4 NÃO iniciado.** Nenhum commit, push, merge ou deploy. Backends, contrato, Avaliacao.MD, AGENTS.md, UI_UX.md e implementação Web preservados; alterações locais anteriores do Gate 2 mantidas.

### Escopo e arquivos

- apps/mobile/App.tsx: sessão em memória e alternância login/chat, Safe Area e status bar.
- src/screens: login HTTP real, chat nativo, lista, estados e compositor com teclado; src/components: marca, botão e balão; src/theme: paleta aprovada.
- src/services: protocolo tipado, HTTP, adaptador WS nativo, ACK/erros/deduplicação/watchdog/reconexão; src/hooks: integração AppState e transporte.
- Configuração Expo/TypeScript, scripts npm, package-lock, .gitignore e .env.example com URL pública. LICENSE/index.ts preservam base do template oficial.
- tests: seis testes de transporte em Node e harness físico Android/Edge com duas APIs reais. Evidências em docs/evidence/gate3.
- README, DECISIONS, TEST_PLAN e este PROGRESS: comandos de execução, decisões, testes e pendências. Nenhuma senha fixa ou token persistido em AsyncStorage.

### Ambiente e decisões

Node 24.18.0, npm 11.16.0, Android SDK/ADB existente fora do PATH; Samsung **SM-A055M, Android 15, 720×1600**, serial R9XX104V6HZ autorizado por USB. Nenhum AVD listado. Expo Go não estava instalado: instalado pelo CLI oficial Expo, sem conta EAS/deploy. Template oficial expo-template-blank-typescript 58.0.35; **Expo 58.0.26, React Native 0.88.1, React 19.3.0, TypeScript 6.0.3**, Safe Area 5.11.1, expo-crypto 58.0.8 e expo-status-bar 58.0.5. [Registro do ambiente](evidence/gate3/environment.json).

USB/reverse nas portas 5002 e 8081, URL Mobile API 127.0.0.1:5002, sem alteração de firewall, PATH ou configurações globais. App acessa apenas Mobile API; browser acessa Web API. Token e histórico só em memória. Background fecha socket/preserva rascunho; retorno verifica validade/reconecta; logout elimina sessão/timers. ACK remoto não é entrega/leitura; nenhum replay automático. Após três handshakes falhos, Reconectar oferece tentativa explícita. ScrollView mede a lista efêmera sem estimativas de altura; não foi otimizado para histórico extenso.

### Comandos e resultados reais

| Comando/verificação | Resultado |
|---|---|
| node --version / npm --version / adb devices / getprop / wm size | Ambiente e aparelho acima confirmados; status device |
| npm view / npm pack expo-template-blank-typescript@58.0.35 / npm install --no-audit | Template estável oficial e dependências instalados; lockfile gerado |
| npx expo install expo-crypto react-native-safe-area-context | Versões compatíveis com SDK 58 instaladas |
| adb reverse tcp:5002 tcp:5002 e tcp:8081 tcp:8081 | HTTP e WS reais acessíveis no Android via USB |
| npm run android | Metro local iniciou; bundle abriu no Expo Go no aparelho físico |
| npm run typecheck | Exit 0 na versão final |
| npm test | Exit 0; **6 testes aprovados**, 0 falhas; sockets controlados, watchdog real de 12s |
| npx expo-doctor | **20/20 checks aprovados**, repetido após finalizar dependências |
| npm ls --depth=0 | Exit 0; versões resolvidas sem dependências inválidas |
| npm run export | Exit 0; bundle Android/Hermes gerado em dist; **não é APK independente** |
| node tests/android-e2e.mjs (npm run test:android) | Exit 0; **10 cenários físicos aprovados**, 0 falhas na rodada final |
| npm audit --json / npm audit --omit=dev --json | Exit 1 por alertas; **28 (26 altos, 2 moderados)** em cada consulta final; dois advisories distintos |
| Inspeção visual de screenshots | Login, chat, teclado aberto, resultado incerto, leitura anterior e sessão expirada conferidos |
| Revisão de segredos/links/diff | Segredos locais não encontrados nos arquivos não ignorados; documentação com links locais válidos; fontes de verdade/backends preservados |

Rodada física final: **17/11/2026, 23:15:06–23:21:30, America/Sao_Paulo** (18/11 UTC no JSON). [Resultados dos dez cenários](evidence/gate3/android-results.json), [seis testes de transporte](evidence/gate3/unit-results.json), [exportação](evidence/gate3/export-result.json). Sem execução manual por pessoa: interação foi automatizada via ADB no aparelho físico e Playwright no Edge, seguida de inspeção visual das capturas. Não confundir com emulador ou testes unitários. APIs/Next iniciados pelo harness foram encerrados por ele; Metro foi encerrado após a rodada (Ctrl+C, código de interrupção do npm). Redirecionamentos USB 5002/8081 removidos ao terminar; reaplicar comandos do README para executar novamente.

### Evidência principal: Web ↔ Android

- Browser Next.js → Web API → Mobile API → Android: ID **c9138329-1b61-42d8-b889-eaba2e6e3b3b**, texto “Ola Android! Mensagem enviada pelo navegador real.”, autor Usuário Web e ACK no navegador.
- Android → Mobile API → Web API → browser: ID **5194158d-f739-448a-8f57-8c92f94393b2**, autor autenticado mobile-demo / Usuário Mobile, texto “Ola Web! Resposta enviada pelo Android fisico.”, ACK apresentado no app.
- Browser sem requisições/conexões à porta 5002 no teste; origem/URLs Mobile verificadas no código/configuração, com apenas sua API e Metro. Não foi feita captura completa de pacotes do aparelho.
- [Fluxos/IDs](evidence/gate3/flows.json), [Android](evidence/gate3/chat-android.png), [browser](evidence/gate3/chat-browser.png), [teclado aberto](evidence/gate3/keyboard-android.png), [falha remota](evidence/gate3/remote-unavailable-android.png), [resultado incerto](evidence/gate3/uncertain-android.png), [rolagem](evidence/gate3/scroll-android.png), [expiração](evidence/gate3/session-expired-android.png).

M01–M10 cobriram login vazio/inválido/válido, ambas direções, autoria/ACK, vazio/2000/2001, parada e retorno de cada API, rascunho, background/foreground, logout, JWT real de 15s, texto multilinha/longo e leitura anterior preservada. M09 substituiu deliberadamente a Web API por **peer de teste autenticado que suprime ACK**, para provocar resultado incerto na Mobile API real; um envio observado, sem replay, ACK tardio não mudou o estado. Essa injeção não substitui a prova entre duas APIs reais de M03.

### Falhas corrigidas e limites

- Android RN sintetizava Origin HTTP no handshake, impedindo conexão apesar de login válido. Confirmado em WebSocketModule.kt; adaptador nativo agora envia Origin vazio, já aceito pela Mobile API com JWT obrigatório. Nenhuma regra de autenticação/CORS dos backends foi alterada.
- Tipos de refs da versão RN exigem ComponentRef; corrigidos e TypeScript repetido. Harness passou a aguardar abertura do Expo Go, decodificar entidades XML e digitar textos longos em blocos: a primeira injeção rápida inseriu somente parte dos 2001 caracteres e não constituía teste válido do limite.
- Fast Refresh interferiu numa rodada de falha/reconexão; execução final usou CI=1 no Metro, sem recarregamento automático. Não tratar essa rodada intermediária como aprovação.
- Teste físico revelou posicionamento incompleto da lista quando balões/status cresciam. Ajustado acompanhamento por gesto e substituída FlatList por ScrollView; M10 passou após a correção. Custo: renderização integral da sessão, não adequada a histórico extenso sem evolução futura.
- NÃO EXECUTADOS: emulador, iOS, outros aparelhos/tamanhos/fontes ampliadas, TalkBack manual, rede celular/Wi-Fi degradada, APK próprio assinado, produção TLS, carga prolongada e funcionamento contínuo em background. App restrito a retrato. Background não garante recepção; processo encerrado perde sessão/conversa.
- Matrizes completas dos Gates 1/2 não repetidas, pois seus códigos não mudaram; integração Gate 3 reexercitou ambos backends e Web real. Alertas de dependências permanecem pendentes na seção seguinte.

### Próximo gate

Aguardar revisão e autorização explícita para Gate 4. Recomendações: nova auditoria separada por projeto, análise de correções compatíveis, regressão crítica com os quatro componentes iniciados do zero, revisão humana de usabilidade e roteiro de demonstração. Não houve início automático dessa etapa.

## Pendências obrigatórias para o Gate 4 — Auditoria de dependências

**Status: PENDENTE — REVISAR NO GATE 4.**

- Web: preservar os **12 alertas altos** do Gate 2, associados à cadeia de lint (ESLint/plugins/glob → picomatch, ReDoS). Não representam 12 vulnerabilidades distintas. Evidência original: [gate2/dependency-audit.json](evidence/gate2/dependency-audit.json). Auditoria de produção daquela execução: **zero alertas**. Dependências Web não atualizadas neste gate.
- Mobile: auditoria final após dependências de teste reportou **28 alertas (26 altos, 2 moderados)** tanto completa quanto `--omit=dev`. São **dois advisories distintos**, picomatch (GHSA-fc5q-39xc-vjpf) e minimatch (GHSA-g3hv-75wg-m249), propagados pelas cadeias Expo/Metro/React Native/codegen/glob. Instalação inicial e primeira consulta omit=dev reportaram 27; o relatório final prevalece, sem alegar resolução por diferenças de contagem. Relatórios [resumo com data](evidence/gate3/dependency-audit.json), [completo](evidence/gate3/mobile-audit-full.json) e [produção](evidence/gate3/mobile-audit-production.json).
- `--omit=dev` no Expo inclui ferramentas de build transitivas distribuídas como dependencies; isso não prova que todo pacote afetado execute dentro do bundle Android. Não foi feita análise exaustiva de alcançabilidade; não afirmar risco zero nem equiparar automaticamente esse total ao runtime nativo.
- Risco conhecido: entradas adversariais em padrões glob podem provocar consumo excessivo de CPU (ReDoS). Nenhum `npm audit fix --force`, downgrade ou override aplicado. Investigação de correções compatíveis e regressão ficam para Gate 4.
- Ação Gate 4: executar separadamente `npm audit --json` e `npm audit --omit=dev --json` em Web, Mobile e demais projetos npm relevantes; identificar advisories distintos/versões corrigidas, avaliar atualização compatível, repetir builds/testes e manter pendência explícita se não houver correção segura.

## Gate 2 — resultado final (17/11/2026)

**Frontend Web implementado, compilado e validado com navegador real. Gate 2 pronto para revisão; Gate 3 NÃO iniciado.**

### Escopo e arquivos

Criado Next.js App Router/React/TypeScript em apps/web, com tokens CSS e marca TalkToMe conforme UI_UX.md. Componentes de login e chat, sessão apenas em memória, cliente HTTP exclusivo da Web API, gerenciador WS, parser de protocolo, estados de envio/erro e reconexão. Campos rotulados, foco visível, feedback anunciável, teclado Enter/Shift+Enter, texto seguro e layout responsivo.

Organização: `src/app` (layout/rota/ícone), `src/styles` (tokens/layout), `src/components` (marca/login/chat), `src/hooks/use-chat.ts`, `src/lib` (HTTP, tipos, transporte), configuração Next/TS/ESLint/Playwright, package-lock e testes. README, DECISIONS e TEST_PLAN atualizados. Evidências em docs/evidence/gate2. UI_UX.md foi recebido como arquivo não versionado e preservado integralmente. Avaliacao.MD, AGENTS.md, backends, contratos e scripts do Gate 1 não foram alterados. Nenhum commit, merge, push ou deploy.

### Implementado

- Login válido/inválido pela API real, campos obrigatórios, loading e bloqueio de dupla submissão. Nenhuma senha real no frontend.
- Chat de sala general, autoria conforme backend, mensagens próprias/recebidas, horário apenas quando fornecido no envelope, texto longo/multilinha seguro e deduplicação visual por origem/ID.
- Mensagens vazias bloqueadas; limite 2000 unidades UTF-16 após trim. Excesso exibe aviso sem truncamento silencioso.
- Estados Enviando, Recebida pelo serviço remoto, falha conhecida e resultado incerto; nenhum reenvio automático. Rascunho preservado na indisponibilidade; erro conhecido recupera texto quando não há outro rascunho.
- Conexão do navegador separada do canal remoto. Backoff 1–30s, uma conexão, cleanup de timers/listeners e encerramento no logout. Sessão expirada retorna ao login. Sem armazenamento de token em localStorage/sessionStorage.
- Paleta oficial, fontes do sistema, layout desktop/mobile, área de mensagem rolável, compositor visível e preservação da posição ao ler mensagens anteriores.

### Validações executadas

Ambiente: Windows x64, Node 24.18.0, npm 11.16.0, SDK .NET 10.0.404, Next 16.4.6, React 19.3.1, TypeScript 5.9, ESLint 10.15.0, Playwright 1.65.1 e Microsoft Edge instalado. Browser integrado retornou lista vazia; testes foram executados pelo runner Playwright em contexto isolado do Edge, sem usar perfil pessoal.

| Comando/ação | Resultado real |
|---|---|
| Consulta npm de versões/engines/peers | Versões estáveis compatíveis; Node mínimo do Next 20.9 |
| Instalador local / `npm install` | Dependências e lockfile criados; posterior ajuste de plugins de lint compatíveis |
| `npm ci --no-audit` em apps/web | Exit 0; instalação reproduzível de 184 pacotes |
| `npm run typecheck` | Exit 0; geração de tipos Next e TypeScript sem erros |
| `npm run lint` | Exit 0 na configuração final |
| `npm run build` | Exit 0; build de produção, página / pré-renderizada; sem backend paralelo no Next |
| `npm run dev` + GET http://localhost:3000 | Servidor pronto em cerca de 1s; HTTP 200; encerrado após smoke |
| `npm test` | Exit 0; oito cenários Playwright aprovados, zero falhas na última execução |
| `npm ls eslint --depth=2` | Exit 0; sem conflitos de peer dependencies na configuração final |
| `npm audit --omit=dev --json` | Zero vulnerabilidades nas dependências de produção |
| `npm audit --json` | 12 alertas altos transitivos de picomatch na cadeia de lint; pendência registrada abaixo |
| Inspeção de screenshots | Login/chat desktop e mobile, indisponibilidade, sessão expirada e resultado incerto; corrigida ocultação do usuário em telas estreitas |
| `git diff --exit-code -- services scripts tests/integration Avaliacao.MD AGENTS.md` | Sem alterações; regressão completa do Gate 1 não repetida por não haver mudança nesses componentes |

Integração final: **17/11/2026, 21:59:13–21:59:44 (America/Sao_Paulo)**; saída do runner: **8 passed (33.8s)**. Datas no JSON são UTC (18/11). [Resultados por cenário](evidence/gate2/results.json).

### Evidência bidirecional

- Navegador → Web API → Mobile API → cliente WS de teste: ID `5f9d15a7-88f8-4be6-9622-06654c281120`, autor web-demo, texto “Olá, Mobile! A conversa já está funcionando.”; ACK remoto apresentado no navegador.
- Cliente de teste → Mobile API → Web API → navegador: ID `39226d36-6809-480d-bf41-80860723e525`, mensagem de Usuário Mobile renderizada com horário do backend.
- Teste W02 inspecionou origens das requisições/conexões do navegador: apenas frontend e Web API, sem acesso à porta 5002; zero erros JavaScript de página nesse fluxo.
- W03/W04 desligaram e reiniciaram processos reais. W07 reteve um ACK real no caminho de volta, comprovando estado incerto e um único envio; W08 reteve atualização de status para provocar rejeição real do backend. Não são substitutos do fluxo real W02.

[Fluxos/IDs](evidence/gate2/flows.json), [chat desktop](evidence/gate2/chat-desktop.png), [chat em viewport mobile](evidence/gate2/chat-mobile.png), [login](evidence/gate2/login-desktop.png), [falha remota](evidence/gate2/remote-unavailable.png), [resultado incerto](evidence/gate2/uncertain-result.png).

### Falhas resolvidas e limitações

- Sandbox bloqueou npm e execução/limpeza de processos dos testes; reexecução autorizada fora dele passou.
- Smoke de desenvolvimento revelou geração automática de apps/web/AGENTS.md pelo Next. Configurado `agentRules: false` usando a documentação local da versão instalada; o próprio Next removeu somente o bloco/arquivo gerado. AGENTS.md original da raiz permaneceu intacto. Dev verificado novamente com HTTP 200; configuração não altera o comportamento do chat.
- Seletores iniciais de teste confundiam alerts da aplicação com anunciador do Next, e nome do usuário com rótulo aninhado. Corrigidos e repetidos; não foi necessário modificar backend.
- Lint encontrou catch vazio no helper: documentado o caso esperado de porta sem serviço. ESLint 9 estava descontinuado e o config agregado Next incluía plugins sem peer para ESLint 10; substituído por plugins diretos compatíveis, removendo 156 pacotes.
- **Pendência de dependências de desenvolvimento:** npm reporta 12 alertas altos transitivos pela vulnerabilidade ReDoS de picomatch. A última versão estável disponível consultada (4.0.7) ainda consta na faixa afetada; nenhuma correção forçada/downgrade foi aplicada. Auditoria de produção sem alertas. Ver [relatório](evidence/gate2/dependency-audit.json). Reavaliar quando houver versão corrigida.
- Responsividade executada em 320, 375, 768, 1280 e 1440 px no Edge; não é teste de app nativo nem teclado virtual. NÃO EXECUTADOS: Expo, dispositivo físico, Firefox/Safari, leitor de tela real, carga prolongada e produção com TLS.
- Memória apenas: refresh perde conversa/sessão. ACK não confirma entrega/leitura. Fechamento de handshake sem detalhe HTTP não permite distinguir credencial inválida de todas as falhas de rede; após três falhas oferece reconectar ou entrar novamente.

### Próximo gate

Aguardar revisão e autorização do Gate 3. O Mobile poderá reutilizar tokens visuais e semântica de estados, mantendo acesso exclusivo à Mobile API. Nenhum arquivo de implementação Expo foi criado.

## Gate 1 — resultado final (17/11/2026)

**P0 implementado e testado. P1 implementado e testado nos cenários abaixo. Gate 1 pronto para revisão; Gate 2 NÃO iniciado.**

### Implementação

Dois projetos executáveis ASP.NET Core net10.0 em services/web-api e services/mobile-api, sem dependência entre projetos. Em cada um: Auth, Configuration, Contracts, Chat e Transport, compostos por DI no Program.cs. Login HTTP, JWT independente, validação de Origin, WS autenticado de cliente, credencial de serviço, canal único full-duplex, identidade confiável, validação de conteúdo/JSON e ACK correlacionado.

P1: backoff limitado, heartbeat, deduplicação/cache em memória, limites de clientes/pendências/filas, timeouts de envio, ACK tardio ignorado e cancelamento ligado ao encerramento. Publicação local independente do ACK remoto. Sem interfaces, banco, histórico persistente, commits ou pushes.

Arquivos: projetos e componentes em `services/*-api`, lockfiles NuGet, `global.json`, scripts de configuração/execução, `tests/integration` (ws com lockfile), `tests/transport`, README e documentação/evidências. Avaliacao.MD e AGENTS.md preservados. Dois `.env` locais foram gerados e a regra Git de exclusão foi verificada; senhas/chaves não foram impressas nem incluídas nos exemplos.

### Comandos e resultados reais

| Comando | Resultado |
|---|---|
| Instalador oficial SDK 10.0.404 + `dotnet --list-sdks` / `dotnet --info` | Exit 0; SDKs 9.0.301 e 10.0.404 presentes; Windows x64 |
| `dotnet build services/web-api/ChatBridge.Api.csproj --nologo` | Sucesso; 0 avisos, 0 erros |
| `dotnet build services/mobile-api/ChatBridge.Api.csproj --nologo` | Sucesso; 0 avisos, 0 erros |
| Builds finais dos dois projetos com `--no-restore --nologo` | Sucesso; 0 avisos, 0 erros em ambos |
| `npm install ws --save-exact` em tests/integration | ws 8.23.0; auditoria npm informou 0 vulnerabilidades |
| `node tests/integration/run.mjs` (versão final) | Exit 0; 18 grupos aprovados; 0 reprovados |
| `dotnet run --project tests/transport/TransportChecks.csproj` | Exit 0; quatro verificações de transporte aprovadas |
| `./scripts/Initialize-Development.ps1` | Gerou configurações locais aleatórias; Git ignora ambos `.env` |
| `./scripts/Run-Api.ps1 -Role mobile` e `-Role web` | APIs iniciaram em 5002/5001, canal conectado; Ctrl+C encerrou ambas com exit 0 |
| Comparação dos oito componentes correspondentes das APIs via Node | Sem divergência; Program difere pela identidade do serviço |
| `git diff --check` e comparação de Avaliacao.MD/AGENTS.md | Sem problemas de whitespace; fontes de verdade preservadas |
| Checagem documental/segredos via Node | 47 arquivos rastreados ou não ignorados examinados; oito exemplos JSON e 16 links locais válidos; nenhum dos segredos locais encontrado |
| Reexecução de Initialize-Development.ps1 com configurações existentes | Recusou sobrescrita; hashes dos dois arquivos permaneceram iguais |

Integração final: **17/11/2026, 20:49:16–20:49:47 (America/Sao_Paulo)**, Node v24.18.0 / Windows, SDK 10.0.404. JSON de evidências usa UTC: [gate1-results.json](evidence/gate1-results.json). Logs dos serviços: [gate1-services.txt](evidence/gate1-services.txt), com checagem automática de ausência das senhas, chaves e JWTs utilizados no teste.

Provas entre processos reais e dois clientes WebSocket:

- Web → Mobile: ID `8ba6dda5-0ccb-4b16-b31d-754a2b06f07e`, texto “Web → Mobile: integração real”, autor web-demo, ACK remote_received correlacionado.
- Mobile → Web: ID `763d1654-81a3-4574-874b-17f5524e874d`, texto “Mobile → Web: integração real”, autor mobile-demo, ACK remote_received correlacionado.
- Interrupção/reinício de cada API: remetente viu remote_unavailable, sem falso ACK; novas mensagens trafegaram em ambos os sentidos após reconectar.

### Falhas encontradas e resolvidas

- Sandbox bloqueou consulta de rede, NuGet.Config, registro npm e inicialização por log de eventos Windows. Reexecuções autorizadas fora do sandbox concluíram. O primeiro uso do CLI exibiu criação automática de certificado de desenvolvimento no perfil do sandbox; não foi executado comando de confiança de certificado nem alteração global manual.
- Regressão encontrou encerramento 1006 em vez de 1008 na expiração. Correção: aguardar resposta de fechamento por janela limitada antes de cancelar o leitor; matriz repetida e aprovada.
- Smoke dos scripts encontrou overload incompatível de String.Split no PowerShell 5.1. Corrigido para operador `-split`; ambos comandos de inicialização passaram depois.

### Limitações e testes não executados

- Não há UI; testes manuais navegador/Expo, T18 e apresentação real web ↔ mobile: **NÃO EXECUTADOS**, pertencem aos gates 2/3.
- Falhas de ACK/heartbeat são injetadas por peer WS controlado conectado à Web API real. Os fluxos T04/T05 usam ambas APIs reais. Diferenciar esses tipos de evidência.
- Cliente lento/concorrência interna/cancelamento foram verificados com socket simulado. Rede real degradada, carga prolongada e exaustão extrema de memória: **NÃO EXECUTADAS**. Sem alegação de teste de carga ou desempenho.
- Backoff/reconexão foram observados; não se aferiu estatisticamente jitter nem cada degrau até 30s.
- Encerramento Ctrl+C verificado sem tráfego de cliente pendente; cancelamento com leitor ativo coberto pelo teste de transporte. Encerramento sob carga: **NÃO EXECUTADO**.
- HTTP/WS são de desenvolvimento; sem revogação JWT no logout, persistência ou garantia de entrega ao dispositivo. Perda de ACK permanece resultado incerto; nenhum replay automático.
- Manutenção de implementações locais equivalentes exige atualizar ambos os lados e regressão. Contas demo devem manter os IDs definidos no contrato.

### Próxima etapa

Após revisão/autorização, Gate 2: Next.js consumindo exclusivamente Web API. Endpoints/contrato/configuração já disponíveis; usar a conta local web-demo, JWT em memória e Origin localhost:3000. Nenhuma pendência funcional P0 impede iniciar essa integração. AVD/Expo continuam para Gate 3.

## Gate 1 — instalação do SDK autorizada

Em 17/11/2026, o responsável autorizou o instalador oficial Microsoft do SDK .NET 10 LTS Windows x64, preservando .NET 9, e a continuidade automática do Gate 1 após validação.

- `dotnet --list-sdks` antes da instalação: somente 9.0.301.
- Metadados oficiais `https://builds.dotnet.microsoft.com/dotnet/release-metadata/10.0/releases.json`: latest-sdk 10.0.404 estável.
- Instalador: `https://builds.dotnet.microsoft.com/dotnet/Sdk/10.0.404/dotnet-sdk-10.0.404-win-x64.exe`, salvo no TEMP do usuário.
- SHA512 conferido com metadados: `c86b0aeb8c5ce0cd6dd290fb2b10bb112302d849d05cbcbcbc0ed4e5a15f66d1376e05bc77910bf66580d6a779390ec863e2bd6e51e7e21880d587b8b30c7b08`.
- `Get-AuthenticodeSignature`: Valid, signatário Microsoft Corporation (.NET).
- Instalador iniciado com `/install /quiet /norestart /log`, sem comando de remoção ou modificação do SDK 9. Log: `%TEMP%/talktome-dotnet10-install.log`.
- Instalação concluída após confirmação UAC pelo responsável: InstallerExitCode=0, sem reinicialização. `dotnet --list-sdks`: 9.0.301 e 10.0.404 lado a lado em Program Files/dotnet/sdk. `dotnet --info`: SDK 10.0.404, MSBuild 18.9.15, RID win-x64, host/runtime 10.0.15. SDK 9.0.301 preservado. Nenhuma configuração global manual alterada; global.json será restrito ao repositório.

A primeira consulta de rede no sandbox falhou; repetida com permissão elevada, funcionou. Nenhuma alteração de target framework ou configuração global manual foi feita.

## Gate 1 — preparação autorizada, aguardando SDK

Gate 0 aprovado pelo responsável; execução exclusiva do Gate 1 autorizada no pedido anexado. Releitura integral da avaliação, guia e documentação realizada. Nova execução de `dotnet --list-sdks` encontrou somente 9.0.301; .NET 10 não está disponível no dotnet atual. Git inicialmente limpo. `Get-Command winget -ErrorAction SilentlyContinue` não retornou executável nesta sessão.

Ajustados ARCHITECTURE.md e MESSAGE_CONTRACT.md conforme refinamento explícito do pedido: ACK confirma aceitação remota e não aguarda publicação aos clientes. Nenhum consumidor implementado existe para atualizar.

Preparação do ambiente depende da autorização específica exigida na seção 3 do pedido de Gate 1. Procedimento proposto: instalar SDK .NET 10 para Windows pelo instalador oficial Microsoft, manter SDK 9 existente e validar `dotnet --list-sdks` / `dotnet --info` após instalação. Nenhuma instalação iniciada; target permanece .NET 10.

P0 implementado: NÃO. P0 testado: NÃO EXECUTADO. P1 implementado: NÃO. P1 testado: NÃO EXECUTADO. Builds e comunicação bidirecional: NÃO EXECUTADOS. Próximo passo: autorização da instalação, validação do SDK e continuidade do Gate 1; Gate 2 não autorizado.

## 17/11/2026 — Gate 0

Planejamento e preparação documental concluídos para revisão; Gate 1 NÃO iniciado. Data de referência America/Sao_Paulo; prazo interpretado como 19/11/2026 às 13h. Leitura integral de Avaliacao.MD, AGENTS.md e pedido anexado realizada. Repositório inicialmente limpo, branch main acompanhando origin/main (sem fetch), commit local `a688617`. Apenas três arquivos versionados: avaliação, guia e .gitignore; apps/docs/services/shared existiam vazios.

Criados README, arquitetura, contrato v1, decisões, plano de testes, este registro, quatro `.env.example` e referência em shared/contracts. Nenhuma funcionalidade implementada; nenhum scaffold/dependência instalado; sem commits, pushes ou alterações nos arquivos originais.

## Inspeções efetivamente executadas

Ambiente: PowerShell 5.1.26100.9549, Windows NT reportado como 10.0.26300.0. Comandos executados na raiz do workspace; caminhos Android abaixo relativos a `%LOCALAPPDATA%/Android/Sdk`.

| Comando/verificação | Resultado observado |
|---|---|
| `Get-Content -Encoding UTF8 Avaliacao.MD` e `AGENTS.md` | Leitura integral; requisitos incorporados |
| `rg --files`, `Get-ChildItem -Force`, inspeção recursiva das quatro pastas | Sem código de aplicações |
| `node --version` / `npm --version` | v24.18.0 / 11.16.0 |
| `dotnet --list-sdks` | Apenas 9.0.301 em Program Files/dotnet/sdk |
| `Get-Command node,npm,dotnet,java,adb,emulator,expo,next -ErrorAction SilentlyContinue` | Node/npm/dotnet no PATH; demais não encontrados no PATH |
| `npm list -g --depth=0` | Lista global vazia; não é necessário Next/Expo global |
| Consulta ANDROID_HOME/ANDROID_SDK_ROOT | HOME aponta ao SDK local; SDK_ROOT vazio |
| `platform-tools/adb.exe version` | ADB 1.0.41, pacote 37.0.0-14910828 |
| `emulator/emulator.exe -version` | 36.6.11.0 |
| `emulator/emulator.exe -list-avds` | Nenhum nome retornado; emulador não iniciado |
| Java do Android Studio: `jbr/bin/java.exe -version` | OpenJDK 21.0.6; presente fora do PATH |
| Listagem SDK platforms | android-27, 33, 34, 35, 36, 37.0 |
| `Get-NetTCPConnection -State Listen` filtrado por 3000/5001/5002/8081 | Sem entradas retornadas; consulta usou SilentlyContinue, não prova disponibilidade/binding |
| `git status --short --branch`, `git log -1 --oneline`, `git ls-files` | Estado inicial limpo e arquivos acima; remoto não consultado |
| Consulta web oficial Next/Expo/.NET | Fontes e implicações registradas em DECISIONS.md |
| `git diff --exit-code -- Avaliacao.MD AGENTS.md .gitignore` | Sem alterações nos três arquivos originais |
| `git diff --check` | Sem saída; cobre diff rastreado, não os novos arquivos ainda untracked |
| `git check-ignore apps/web/.env.local services/web-api/.env` | Ambos ignorados |
| `git check-ignore apps/web/.env.example services/web-api/.env.example` | Sem correspondências (exit 1 esperado): exemplos não ignorados |

Primeira checagem de links via Node falhou porque este PROGRESS.md ainda não havia sido criado; arquivo adicionado antes da repetição final. Repetição via script Node enviado pelo stdin: exit 0, sete arquivos Markdown verificados, sete exemplos JSON válidos, nove links locais existentes, nenhum espaço ao final das linhas e placeholders SigningKey/ServiceKey/Password vazios nos dois exemplos das APIs.

Compilação e inicialização: NÃO EXECUTADAS, sem projetos nesta etapa. Testes automatizados funcionais, integração HTTP/WS, testes manuais web/mobile e T01–T19: NÃO EXECUTADOS. Verificação documental não representa teste de aplicação. Android/Expo Go, rede física, restore/downloads e compatibilidade real das dependências não foram testados.

## Riscos e ações

| Prioridade / risco | Probabilidade / impacto | Mitigação |
|---|---|---|
| P0: SDK disponível fora de suporte | Confirmado / alto para escolha de plataforma | Preparar .NET 10 LTS antes do Gate 1; instalação exige fluxo de autorização aplicável |
| P0: nenhum AVD listado | Alta / alto para demonstração mobile | Preparar AVD pelo Android Studio antes do Gate 3; não substituir app por web |
| P0: prazo curto e gates sequenciais | Alta / alto | Gates 1 e 2 em 17–18/11, Gate 3 em 18/11; reservar manhã de 19/11 para Gate 4, sujeito à revisão e tempo disponível |
| P1: rede/emulador/portas ainda não validados | Média / alto | Testar binding e 10.0.2.2, revisar firewall somente se necessário |
| P1: restore e versões Next/Expo não validados | Média / médio | Fixar versões/lockfiles e compilar nos gates próprios; sem instalação global |
| P1: perda de ACK/dados em memória | Inerente / médio | Estado incerto explícito, deduplicação limitada e teste T14/T15 |
| P1: JWT na URL | Inerente / médio | Suprimir query dos logs, token em memória e TLS fora do ambiente local |

## Próxima etapa

Revisar arquitetura, contrato e alvo .NET 10. Após autorização explícita, preparar SDK necessário e executar Gate 1: duas APIs independentes, login/WS autenticados, fluxo nos dois sentidos e harness de falha/reconexão. Ao final, compilar, registrar resultados reais e parar para nova revisão. Nenhuma implementação autorizada antecipadamente.
