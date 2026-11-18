# ChatBridge

MVP de chat entre Next.js/TypeScript e React Native/Expo, cada cliente ligado exclusivamente à sua API ASP.NET Core. As duas APIs trocam mensagens por WebSocket full-duplex.

**Estado: Gate 3 — APIs, frontend Web e aplicativo React Native/Expo implementados; validações e limitações em [PROGRESS](docs/PROGRESS.md).** Fontes de verdade: [Avaliacao.MD](Avaliacao.MD) e [AGENTS.md](AGENTS.md), preservadas. Prazo: 19/11/2026, quinta-feira, 13h (America/Sao_Paulo).

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

## Documentação

- [Arquitetura](docs/ARCHITECTURE.md)
- [Contrato v1](docs/MESSAGE_CONTRACT.md)
- [Decisões e limitações](docs/DECISIONS.md)
- [Plano de testes](docs/TEST_PLAN.md)
- [Progresso, ambiente e riscos](docs/PROGRESS.md)
- [Identidade visual Web/Mobile](docs/UI_UX.md)

Sem banco, Docker obrigatório, publicação ou histórico persistente. ACK indica aceitação pelo backend remoto, nunca entrega/leitura. Gate 4 depende de revisão e autorização explícita.
