# Progresso — ChatBridge

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
