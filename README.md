# ChatBridge

MVP de chat entre Next.js/TypeScript e React Native/Expo, cada cliente ligado exclusivamente à sua API ASP.NET Core. As duas APIs trocam mensagens por WebSocket full-duplex.

**Estado: Gate 0 — planejamento preparado para revisão. Não existem aplicações executáveis, login ou chat implementados.** Fontes de verdade: [Avaliacao.MD](Avaliacao.MD) e [AGENTS.md](AGENTS.md), preservadas. Prazo interpretado: 19/11/2026, quinta-feira, 13h (America/Sao_Paulo).

## Estrutura

```text
apps/web/           Next.js (Gate 2)
apps/mobile/        Expo (Gate 3)
services/web-api/   API web (Gate 1)
services/mobile-api/ API mobile (Gate 1)
shared/contracts/   Referência do protocolo; sem biblioteca compartilhada
docs/               Arquitetura, contrato, decisões, testes e evidências
```

## Pré-requisitos e execução planejada

Node LTS e npm; SDK .NET suportado; Android SDK/emulador e um AVD para demonstração. Inventário real em [PROGRESS](docs/PROGRESS.md). Apenas .NET 9.0.301 foi encontrado: preparar SDK .NET 10 LTS antes do Gate 1, sem instalação automática neste gate. Versões exatas de Next.js/Expo e lockfiles serão fixados nos gates respectivos após conferir compatibilidade.

Quatro terminais, na ordem abaixo. **Comandos futuros, ainda indisponíveis e não executados**; nomes dos projetos serão confirmados ao gerar scaffolds.

| Ordem | Diretório | Comando previsto | Endereço |
|---|---|---|---|
| 1 | services/mobile-api | `dotnet run --no-launch-profile` | http://localhost:5002 |
| 2 | services/web-api | `dotnet run --no-launch-profile` | http://localhost:5001 |
| 3 | apps/web | `npm run dev -- --port 3000` | http://localhost:3000 |
| 4 | apps/mobile | `npx expo start --port 8081` | Metro 8081; abrir Android |

Instalação futura: `dotnet restore` em cada API e `npm ci` em cada cliente após existirem projetos e lockfiles. Não executar agora. Contas previstas: `web-demo` / `mobile-demo`; senhas fornecidas localmente, ainda não criadas.

Os `.env.example` registram nomes de configurações sem segredos. Next/Expo poderão carregar suas cópias `.env.local`; .NET **não carrega dotenv automaticamente**: fornecer os valores no terminal da respectiva API (`$env:NOME='valor'`) ou via User Secrets após criar o projeto. Chaves JWT diferentes por API; chave interbackend igual apenas nos dois serviços. Nunca colocar segredos nas variáveis públicas dos clientes.

No emulador Android padrão, Mobile API: `http://10.0.2.2:5002`. No dispositivo físico, usar IP LAN do computador e permitir somente a rede local necessária no firewall. Binding mobile planejado: `0.0.0.0:5002`; web API: `localhost:5001`. HTTP/WS apenas em desenvolvimento; produção exigiria HTTPS/WSS. CORS HTTP da Web API autoriza somente `http://localhost:3000`; validar Origin separadamente no WebSocket. Mobile nativo não depende de CORS.

## Documentação

- [Arquitetura](docs/ARCHITECTURE.md)
- [Contrato v1](docs/MESSAGE_CONTRACT.md)
- [Decisões e limitações](docs/DECISIONS.md)
- [Plano de testes](docs/TEST_PLAN.md)
- [Progresso, ambiente e riscos](docs/PROGRESS.md)

Sem banco, Docker obrigatório, publicação ou histórico persistente. Gate 1 depende de revisão e autorização explícita.
