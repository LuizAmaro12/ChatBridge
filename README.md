# ChatBridge

MVP de chat entre Next.js/TypeScript e React Native/Expo, cada cliente ligado exclusivamente à sua API ASP.NET Core. As duas APIs trocam mensagens por WebSocket full-duplex.

**Estado: Gate 1 — APIs implementadas; evidências e limitações em [PROGRESS](docs/PROGRESS.md).** Frontends ainda não implementados. Fontes de verdade: [Avaliacao.MD](Avaliacao.MD) e [AGENTS.md](AGENTS.md), preservadas. Prazo: 19/11/2026, quinta-feira, 13h (America/Sao_Paulo).

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

SDK .NET 10.0.404 (fixado em global.json), Node 24 e npm para o harness de integração. SDK 10 instalado e validado lado a lado com 9.0.301. Android/AVD e versões Next.js/Expo pertencem aos próximos gates.

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

## Execução futura dos quatro componentes

Quatro terminais, na ordem abaixo. Comandos dos frontends são **futuros, indisponíveis e não executados**.

| Ordem | Diretório | Comando previsto | Endereço |
|---|---|---|---|
| 1 | raiz | `./scripts/Run-Api.ps1 -Role mobile` | http://localhost:5002 |
| 2 | raiz | `./scripts/Run-Api.ps1 -Role web` | http://localhost:5001 |
| 3 | apps/web | `npm run dev -- --port 3000` | http://localhost:3000 |
| 4 | apps/mobile | `npx expo start --port 8081` | Metro 8081; abrir Android |

Nos próximos gates, instalar clientes com `npm ci` após existirem projetos e lockfiles. Para APIs, os comandos acima já restauram os pacotes necessários.

Os `.env.example` registram nomes de configurações sem segredos. Next/Expo poderão carregar suas cópias `.env.local`; .NET **não carrega dotenv automaticamente**: use Run-Api.ps1 ou exporte os valores no terminal da respectiva API (`$env:NOME='valor'`). Chaves JWT diferentes por API; chave interbackend igual apenas nos dois serviços. Nunca colocar segredos nas variáveis públicas dos clientes.

No emulador Android padrão, Mobile API: `http://10.0.2.2:5002`. No dispositivo físico, usar IP LAN do computador e permitir somente a rede local necessária no firewall. Binding mobile planejado: `0.0.0.0:5002`; web API: `localhost:5001`. HTTP/WS apenas em desenvolvimento; produção exigiria HTTPS/WSS. CORS HTTP da Web API autoriza somente `http://localhost:3000`; validar Origin separadamente no WebSocket. Mobile nativo não depende de CORS.

## Documentação

- [Arquitetura](docs/ARCHITECTURE.md)
- [Contrato v1](docs/MESSAGE_CONTRACT.md)
- [Decisões e limitações](docs/DECISIONS.md)
- [Plano de testes](docs/TEST_PLAN.md)
- [Progresso, ambiente e riscos](docs/PROGRESS.md)

Sem banco, Docker obrigatório, publicação ou histórico persistente. ACK indica aceitação pelo backend remoto, nunca entrega/leitura. Gate 2 depende de revisão e autorização explícita.
