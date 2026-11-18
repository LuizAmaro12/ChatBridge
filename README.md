# ChatBridge

MVP de chat entre Next.js/TypeScript e React Native/Expo, cada cliente ligado exclusivamente à sua API ASP.NET Core. As duas APIs trocam mensagens por WebSocket full-duplex.

**Estado: Gate 4 — regressão aprovada com ressalvas de dependências; Web ↔ Android físico validado nos dois sentidos. Resultados e limitações em [PROGRESS](docs/PROGRESS.md).** Fontes de verdade: [Avaliacao.MD](Avaliacao.MD) e [AGENTS.md](AGENTS.md), preservadas. Prazo: 19/11/2026, quinta-feira, 13h (America/Sao_Paulo).

## Estrutura

```text
apps/web/           Next.js (Gate 2)
apps/mobile/        Expo (Gate 3)
services/web-api/   API web (Gate 1)
services/mobile-api/ API mobile (Gate 1)
shared/contracts/   Referência do protocolo; sem biblioteca compartilhada
docs/               Arquitetura, contrato, decisões, testes e evidências
```

## Pré-requisitos e execução das APIs

SDK .NET 10.0.404 (fixado em global.json), Node 24 e npm. SDK 10 instalado e validado lado a lado com 9.0.301. Web: Next.js 16.4.6, React 19.3.1 e TypeScript 5.9. Mobile: Expo 58, React Native 0.88.1, React 19.3.0 e TypeScript 6.0, conforme template oficial e lockfile. Android precisa de SDK/ADB e Expo Go compatível; priorizar aparelho USB autorizado.

Na raiz, em PowerShell:

```powershell
dotnet build services/mobile-api/ChatBridge.Api.csproj
dotnet build services/web-api/ChatBridge.Api.csproj
./scripts/Initialize-Development.ps1
```

O inicializador cria `.env` locais ignorados pelo Git com chaves aleatórias distintas e senha por conta; recusa sobrescrever configurações existentes. Nesta máquina os arquivos já foram criados. Contas: **web-demo** e **mobile-demo**; consulte `DemoUser__Password` no `.env` da API correspondente. Não há senha fixa versionada.

Em dois terminais separados na raiz:

```powershell
./scripts/Run-Api.ps1 -Role mobile
```

```powershell
./scripts/Run-Api.ps1 -Role web
```

O script carrega variáveis apenas no processo e restaura seus valores ao terminar. APIs: `http://localhost:5001` e `http://localhost:5002`. Rotas: `POST /auth/login`, `/ws/chat?access_token=JWT`, `GET /health`; somente Mobile API aceita `/internal/ws` com chave de serviço. Cliente web exige Origin `http://localhost:3000`. Inicialização falha quando segredos/configurações obrigatórias faltam.

## Testes reproduzíveis

Pare as APIs manuais antes do harness: ele precisa das portas 5001/5002 e inicia/encerra apenas seus próprios processos. Credenciais dos testes são efêmeras e independentes dos `.env` locais.

```powershell
npm ci --prefix tests/integration
node tests/integration/run.mjs
dotnet run --project tests/transport/TransportChecks.csproj
```

Integração real: [resultados JSON](docs/evidence/gate1-results.json) e [logs sanitizados](docs/evidence/gate1-services.txt). Testes com peer controlado injetam perda de ACK/heartbeat e não substituem a prova entre as duas APIs. Testes de transporte usam socket simulado para observar concorrência e timeout. No ambiente do agente, builds/testes exigiram execução fora do sandbox por restrições de NuGet e log de eventos Windows.

## Frontend Web (Gate 2)

Com as duas APIs rodando, abra um terceiro terminal:

```powershell
cd apps/web
npm ci
npm run dev
```

Acesse **http://localhost:3000**. Use `web-demo` e a senha local em `services/web-api/.env`. Nenhuma senha é incluída na interface. O único endereço consumido pelo frontend é `NEXT_PUBLIC_API_URL`, com padrão `http://localhost:5001`. Se precisar configurá-lo, copie `.env.example` para `.env.local` em apps/web (ignorado pelo Git). Não use 127.0.0.1:3000 para o site: a Web API valida Origin localhost:3000.

JWT, mensagens e rascunho ficam somente em memória; recarregar exige login. A interface distingue conexão com a própria API de disponibilidade do serviço remoto. Confirmação não significa entrega/leitura. Sem confirmação em 12s no navegador, o resultado é incerto; não há reenvio automático. Rascunhos são preservados em indisponibilidade e recuperados, quando possível, em rejeições conhecidas.

Validação e execução de produção, dentro de apps/web:

```powershell
npm run typecheck
npm run lint
npm run build
npm run start
```

Para testar, pare as APIs e o servidor Next manuais, compile ambas APIs pelos comandos anteriores e execute `npm test` em apps/web após o build. O Playwright usa Microsoft Edge instalado, contextos isolados e dois processos .NET com credenciais efêmeras; ocupa 3000/5001/5002 e encerra seus processos ao terminar. Em máquina sem Edge, instalar um navegador de teste compatível e ajustar `channel` na configuração antes de executar. Não usar credenciais de produção nos testes. Evidências: [resultados](docs/evidence/gate2/results.json), [fluxos reais](docs/evidence/gate2/flows.json), [login](docs/evidence/gate2/login-desktop.png) e [chat](docs/evidence/gate2/chat-desktop.png).

Auditoria final: zero alertas em dependências de produção; 12 alertas altos transitivos na cadeia de lint (`picomatch`), sem versão estável corrigida encontrada na consulta. Não foi aplicada atualização forçada. Detalhes em [auditoria](docs/evidence/gate2/dependency-audit.json).

Reavaliação Gate 4: os 12 alertas Web permanecem; Mobile reportou 27 (25 altos/2 moderados), sem mudança de pacotes nem resolução dos dois advisories. Veja a [análise atual por vulnerabilidade, compatibilidade e alcance](docs/evidence/gate4/security-analysis.md). As contagens históricas abaixo são preservadas como evidência da época.

## Aplicativo Android (Gate 3)

Em um quarto terminal, com as duas APIs e o Web em execução, conecte o Android por USB e autorize a depuração. No PowerShell, a partir da raiz:

```powershell
$adbPath = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adbPath devices
# Substitua SERIAL pelo identificador que aparece como device.
& $adbPath -s SERIAL reverse tcp:5002 tcp:5002
& $adbPath -s SERIAL reverse tcp:8081 tcp:8081
cd apps/mobile
npm ci
npm run android
```

O CLI inicia Metro em localhost:8081 e abre o projeto no Expo Go. Na primeira execução pode baixar/instalar o Expo Go oficial compatível. Não é necessário Expo global, conta EAS, publicação ou APK próprio para esta demonstração. Esta validação usa componentes React Native reais dentro do Expo Go, sem WebView. Android físico verificado: Samsung SM-A055M, Android 15.

Use **mobile-demo** e a senha em `services/mobile-api/.env` (`DemoUser__Password`). A senha Web é independente. URL pública padrão: `http://127.0.0.1:5002`; **esse localhost só alcança o computador devido ao adb reverse**, que deve ser refeito após desconectar USB. Metro usa o mesmo mecanismo na porta 8081. Não redirecionar 5001/3000 para o app nem abrir firewall para essa estratégia.

Para emulador Android sem reverse, copie apps/mobile/.env.example para `.env.local` e ajuste `EXPO_PUBLIC_API_URL=http://10.0.2.2:5002`; reinicie Metro após mudar a variável. Isso é configuração alternativa, não evidência de teste em emulador. HTTP/WS apenas no desenvolvimento; produção requer HTTPS/WSS.

JWT, conversa e rascunho ficam em memória. Segundo plano fecha o socket e preserva estado da sessão; retorno reconecta se o token ainda for válido. Não há recepção garantida em segundo plano, histórico offline ou reenvio automático. Se houver três handshakes consecutivos sem sucesso, o botão Reconectar permite nova tentativa. Logout fecha transporte e limpa a sessão. ACK remoto não confirma leitura ou entrega ao aparelho.

Checks em apps/mobile:

```powershell
npm run typecheck
npm test
npx expo-doctor
npm run export
npm audit --json
npm audit --omit=dev --json
```

`export` gera bundle Android/Hermes em dist; não é um APK assinado. Testes unitários usam transporte controlado e não substituem a execução física. Para reproduzir a automação Android: instalar também dependências em apps/web e tests/integration, compilar APIs e Web, manter Metro e Android conectados, parar APIs/Next manuais e executar `npm run test:android` em apps/mobile. O harness inicia processos temporários nas portas 3000/5001/5002, usa Edge instalado e ADB, digita credenciais efêmeras, grava capturas reais e encerra seus processos. Reserve o aparelho para o teste. `ANDROID_SERIAL` seleciona o dispositivo quando necessário. Veja [resultados físicos](docs/evidence/gate3/android-results.json).

Auditoria Mobile é separada da Web. Relatórios [completo](docs/evidence/gate3/mobile-audit-full.json) e [omit=dev](docs/evidence/gate3/mobile-audit-production.json); alertas transitivos permanecem pendentes para Gate 4. Em Expo, ferramentas de build também chegam como dependencies, portanto omit=dev não equivale à análise do bundle instalado. Os **12 alertas altos do Web não foram resolvidos**.

## Execução dos quatro componentes

Quatro terminais, na ordem abaixo; preparar USB/reverse conforme a seção Mobile.

| Ordem | Diretório | Comando previsto | Endereço |
|---|---|---|---|
| 1 | raiz | `./scripts/Run-Api.ps1 -Role mobile` | http://localhost:5002 |
| 2 | raiz | `./scripts/Run-Api.ps1 -Role web` | http://localhost:5001 |
| 3 | apps/web | `npm run dev` | http://localhost:3000 |
| 4 | apps/mobile | `npm run android` | Metro localhost:8081; Android por USB |

Para Mobile e Web, executar npm ci no diretório correspondente. Para APIs, os builds acima restauram os pacotes necessários.

Os `.env.example` registram nomes de configurações sem segredos. Next/Expo poderão carregar suas cópias `.env.local`; .NET **não carrega dotenv automaticamente**: use Run-Api.ps1 ou exporte os valores no terminal da respectiva API (`$env:NOME='valor'`). Chaves JWT diferentes por API; chave interbackend igual apenas nos dois serviços. Nunca colocar segredos nas variáveis públicas dos clientes.

No dispositivo físico, preferir USB/reverse: dispensa IP LAN e alteração de firewall. Os backends mantêm suas configurações locais aprovadas; testes usam localhost. CORS HTTP da Web API autoriza somente `http://localhost:3000`; Origin é validado separadamente no WebSocket. O cliente nativo usa Origin vazio e JWT, comportamento já previsto pela Mobile API.

O exemplo e a configuração local existente da Mobile API usam **0.0.0.0:5002**, escutando interfaces IPv4; USB não garante isolamento de rede. Para uso exclusivamente local/USB, pode-se definir `ASPNETCORE_URLS=http://localhost:5002` no `.env` da Mobile API. Não abrir firewall nem expor os serviços HTTP/WS publicamente.

## Regressão e evidências do Gate 4

Os harnesses aceitam `EVIDENCE_DIR` opcional, sem alterar os cenários. Use caminhos absolutos e uma pasta nova por execução para preservar evidências anteriores. Sem essa variável, os destinos históricos dos Gates 1–3 continuam sendo usados.

Após os builds e checks acima, com portas 3000/5001/5002 livres, execute na raiz, sequencialmente:

```powershell
$evidenceRoot = Join-Path (Get-Location) 'docs/evidence/minha-regressao'
$env:EVIDENCE_DIR = Join-Path $evidenceRoot 'backend'
node tests/integration/run.mjs
dotnet run --project tests/transport/TransportChecks.csproj
$env:EVIDENCE_DIR = Join-Path $evidenceRoot 'web'
npm test --prefix apps/web
$env:EVIDENCE_DIR = Join-Path $evidenceRoot 'android'
npm run test:android --prefix apps/mobile
Remove-Item Env:EVIDENCE_DIR
```

Para o último comando, mantenha Android desbloqueado/autorizado e Metro do **TalkToMe** na porta 8081. Em outro terminal, inicie-o com `cd apps/mobile`, `$env:CI='1'` e `npm run start`: CI evita recarregamentos durante a automação. O harness abre Expo Go e configura reverse 5002/8081. Não use simultaneamente o aparelho ou outro Metro nessa porta. Ao terminar, encerre Metro com Ctrl+C e remova somente os redirecionamentos usados: `adb -s SERIAL reverse --remove tcp:5002` e `adb -s SERIAL reverse --remove tcp:8081` (use o caminho completo do ADB se necessário).

Relatórios e ressalvas da rodada do Gate 4: [PROGRESS](docs/PROGRESS.md), [checks](docs/evidence/gate4/checks.json) e [segurança](docs/evidence/gate4/security-analysis.md). Testes via Edge/ADB são automatizados; não equivalem a uma avaliação manual humana.

## Integração contínua (GitHub Actions)

Workflow [CI](.github/workflows/ci.yml): PRs destinados à main, pushes na main e execução manual (`workflow_dispatch`). Quatro jobs isolados em Windows Server 2025, Node 24 e .NET conforme global.json:

| Job | Verificações |
|---|---|
| Backends | Restore com lockfiles, builds Debug das duas APIs, quatro checks de transporte e integração entre APIs reais |
| Web | npm ci, typecheck, lint, build de produção, Edge e oito cenários Playwright W01–W08 |
| Mobile | npm ci, typecheck, seis testes, Expo Doctor 1.21.8 e exportação Android/Hermes; não gera APK |
| Auditoria informativa | npm audit completo e omit=dev separados para Web/Mobile; JSON, contagens, códigos de saída, avisos e resumo |

Falha de build/teste faz o respectivo job falhar; passos dependentes ficam não executados. Vulnerabilidades npm são informativas inicialmente: o job verde significa **coleta concluída**, não aprovação de segurança. Erro de consulta, timeout ou JSON inválido faz o job de auditoria falhar. Baseline histórico: Web 12 altos/produção 0; Mobile 27 (25 altos/2 moderados). Nenhum alerta é subtraído ou tratado como corrigido. Consultas podem mudar com o registro; a análise histórica permanece em [segurança Gate 4](docs/evidence/gate4/security-analysis.md). Bloqueio por novos advisories/aumento de severidade fica para uma política futura.

Relatórios ficam nos artifacts `ci-backends`, `ci-web`, `ci-mobile-export-metadata` e `ci-audit-informational`, retidos por sete dias. `EVIDENCE_DIR` aponta ao diretório temporário do runner; arquivos históricos não são sobrescritos. Logs de cada comando ficam nos passos da execução. Upload é tentado mesmo após falha; se o processo não chegou a gerar relatório, o log informa ausência. Não são enviados .env, node_modules, traces de autenticação ou bundle completo.

Não são necessários secrets pessoais: os testes criam credenciais efêmeras. Permissão do workflow limitada a leitura do conteúdo, sem credencial Git persistida. Cache npm usa cada lockfile; não há cache de node_modules nem cache NuGet adicional. PR atualizado cancela sua execução anterior. Jobs têm timeouts e máquinas independentes, portanto não disputam portas.

**CI não implementa CD/deploy.** Android físico/ADB/Expo Go e validação manual permanecem locais e independentes; `test:android` não executa no runner comum.

Após publicar a branch com autorização, abra PR para main e acompanhe a aba **Actions → CI** ou os checks do PR. Inspecione os quatro jobs, o resumo de auditoria e os artifacts, inclusive em falhas. O disparo manual estará disponível quando o workflow existir na branch padrão. Não há badge de sucesso antecipado: validação local não equivale à execução real no GitHub.

Para conferir apenas o coletor localmente, sem alterar evidências históricas:

```powershell
node --test scripts/ci/audit.test.mjs
$env:AUDIT_OUTPUT_DIR = Join-Path $env:TEMP 'talktome-audit-local'
node scripts/ci/audit.mjs
Remove-Item Env:AUDIT_OUTPUT_DIR
```

## Referências do projeto

- [Arquitetura](docs/ARCHITECTURE.md)
- [Contrato v1](docs/MESSAGE_CONTRACT.md)
- [Decisões e limitações](docs/DECISIONS.md)
- [Plano de testes](docs/TEST_PLAN.md)
- [Progresso, ambiente e riscos](docs/PROGRESS.md)
- [Identidade visual Web/Mobile](docs/UI_UX.md)

Sem banco, Docker obrigatório, publicação ou histórico persistente. ACK indica aceitação pelo backend remoto, nunca entrega/leitura. Gate 4 concluído para revisão humana, com riscos de dependências explicitados; nenhuma publicação automática.
