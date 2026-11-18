# Decisões — 17/11/2026

## Concretizadas no Gate 1

- SDK oficial Microsoft 10.0.404 instalado com autorização, assinatura e SHA512 verificados; SDK 9.0.301 preservado. global.json local fixa SDK estável. Pacote JwtBearer 10.0.15 e lockfiles NuGet; harness usa ws 8.23.0 com lockfile npm.
- Refinamento solicitado: ACK remoto não espera publicação para dispositivos. ClientHub apenas enfileira em buffers limitados; writers isolados têm timeout de 2s. Isso preserva a aceitação remota mesmo sem cliente conectado ou quando ele é lento.
- Mantidas duas aplicações sem referência de uma API à outra e sem biblioteca de regras comum. Implementações locais de autenticação/transporte/DTOs têm correspondência deliberada para cumprir o isolamento aprovado. Custo: corrigir os dois lados em conjunto, verificado por comparação de arquivos e regressão em ambos os sentidos. Extração futura só com responsabilidade e autorização claras.
- Configuração local gerada com segredos aleatórios, sem senha fixa no código. Scripts PowerShell restauram variáveis do processo; não modificam ambiente global. TokenSeconds substitui TokenMinutes para permitir teste rápido de expiração; padrão permanece uma hora.
- Testes de chat usam duas APIs reais; peer WS controlado apenas para suprimir ACK/pong e injetar erros. Socket simulado apenas em quatro testes de concorrência/cancelamento. Não apresentar essas simulações como prova de entrega entre APIs.
- Corrida real identificada na regressão: cancelamento imediato de ReceiveAsync após CloseOutput podia produzir 1006 na expiração. Corrigido com janela limitada para a resposta de fechamento antes de cancelar. Integração repetida após correção.

As decisões abaixo preservam o registro histórico do Gate 0; instalação e implementação agora seguem o estado acima.

Propostas para revisão do Gate 0; detalhes operacionais em ARCHITECTURE e MESSAGE_CONTRACT. Nenhum conflito identificado entre avaliação e guia. Interpretações: uma conexão full-duplex satisfaz bidirecionalidade; ACK de backend não é entrega ao usuário; prazo corresponde a 19/11/2026 às 13h em São Paulo.

| Decisão | Problema / alternativas | Justificativa e consequência |
|---|---|---|
| Uma conexão iniciada pela Web API | Duas conexões espelhadas ou polling | Full-duplex cobre os dois sentidos, reduz corrida/loops; Web API controla retry |
| WS nativo nos três enlaces | SignalR adicionaria protocolo e dependência | Atende diretamente a avaliação; gerenciar concorrência, heartbeat e reconexão explicitamente |
| JWT por API, chaves/issuer/audience separados | Sessões opacas também seriam válidas | Validação local e expiração explícitas; logout não revoga token roubado |
| JWT na query da rota WS | Cookie cross-origin ou ticket descartável | Compatibilidade navegador/Expo com fluxo mínimo; requer TLS fora do desenvolvimento e supressão de query nos logs |
| Chave de serviço no header do handshake | Token de usuário ou confiança em IP | Separa identidade do serviço; configuração local, comparação constante e sem fallback inseguro |
| ACK remoto + timeout de 5s | Sucesso logo no envio ou ACK do dispositivo | Feedback honesto com pequena complexidade; não garante leitura/entrega e pode haver resultado incerto |
| Deduplicação limitada em memória | Persistência ou nenhum controle | Evita duplicatas durante janela; perde proteção após reinício/10min |
| Estrutura documental sem scaffolds no Gate 0 | Gerar quatro apps agora | Evita dependências e código fora do escopo; builds ficam para os gates de implementação |
| .NET 10 LTS como alvo proposto | Usar SDK 9 instalado | Versão suportada; exige preparar SDK antes do Gate 1. Não instalado neste trabalho |
| Sem monorepo tooling/biblioteca C# inicial | Nx/Turborepo/projeto comum | Quatro diretórios independentes, menor setup; manter DTOs alinhados pela especificação |

## Compatibilidade e fontes oficiais

Consulta em 17/11/2026: [.NET 8/9 encerraram suporte em 10/11/2026](https://devblogs.microsoft.com/dotnet/dotnet-8-9-end-of-support/). Preferir .NET 10 LTS e confirmar patch suportado na preparação do Gate 1. O SDK 9.0.301 instalado não satisfaz esse alvo; nenhuma compilação foi tentada.

[Next.js informa Node mínimo 20.9](https://nextjs.org/docs/app/getting-started/installation); Node observado 24.18.0 supera esse mínimo, mas instalação/build do projeto ainda precisam comprovar compatibilidade. [Expo requer Node LTS](https://docs.expo.dev/get-started/create-a-project/); selecionar SDK e versões React/React Native conjuntamente pelo template oficial, fixar lockfile e executar diagnóstico no Gate 3. Não presumir Expo Go/AVD já operacionais.

## Limites deliberados

Uma sala, duas contas demo, dados em memória, sem cadastro, armazenamento persistente, notificações, upload, broker ou publicação. Texto puro nos clientes, sem HTML executável. HTTP/WS restritos a desenvolvimento. A solução não pretende ser uma implantação de produção.

Preparação do SDK e AVD deve ocorrer antes dos gates dependentes; instalações/configurações do sistema serão tratadas separadamente com autorização necessária. Nenhuma decisão pendente impede revisar este planejamento.
