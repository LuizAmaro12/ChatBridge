# Decisões — 17/11/2026

## Gate 4 — estabilização (18/11/2026)

- Arquitetura, protocolo, implementação dos quatro componentes e versões preservados: a regressão não justificou alteração funcional. Ajuste nos quatro arquivos de harness/reporter permite `EVIDENCE_DIR` opcional e preserva evidências históricas; defaults anteriores mantidos.
- Auditoria investigada por advisory, não por contagem: Web 12 altos/produção 0; Mobile 27 (25 altos/2 moderados) nas duas modalidades. A diferença histórica 28→27 não é correção, pois nenhum pacote mudou. Integração npm e consultas NuGet sem alertas conhecidos.
- Picomatch 2.3.2/4.0.7: sem versão corrigida publicada na consulta. Minimatch 10.2.6: correção 11.0.1+, mas fingerprint 0.21.10 ainda exige ^10.2.6; caminho padrão usa otimização 1, enquanto advisory exige >=2. Mantidos com risco/alcance documentados, sem downgrade, override ou atualização major. [Análise e opções](evidence/gate4/security-analysis.md).
- Recomendar avaliação local com ressalvas de dependências; uma exigência de zero alertas permanece não atendida. Upgrade major exigiria aprovação específica e não resolveria o advisory sem patch do picomatch.
- Revisão de UI preserva a identidade aprovada; teste Edge/ADB e inspeção de capturas não substituem avaliação humana de acessibilidade/conforto. Sem redesign ou feature adicional.
- Binding Mobile existente 0.0.0.0:5002 explicitado no README: USB não significa loopback exclusivo. Não alterados `.env`, firewall, PATH ou configuração global. Sem deploy, APK obrigatório, apresentação ou operações de publicação no Git.

## Gate 3 — Android nativo

- Template oficial expo-template-blank-typescript 58.0.35, obtido pelo npm pack para preservar o .env.example preexistente. Expo 58.0.26, React Native 0.88.1 e React 19.3.0 em conjunto; dependências nativas escolhidas via expo install. Lockfile local; sem instalação global. Referências oficiais: [criação](https://docs.expo.dev/get-started/create-a-project/) e [Expo Go Android](https://expo.dev/go?device=true&platform=android&sdkVersion=58).
- Expo Go oficial no Samsung SM-A055M/Android 15 autorizado. Não há necessidade funcional de development build: HTTP, WS, crypto e Safe Area são compatíveis. Exportação Hermes valida bundle, não produz APK independente. Nenhuma publicação EAS.
- USB com adb reverse 5002 e 8081 permite Mobile API/Metro locais sem mudança de firewall. URL EXPO_PUBLIC_API_URL pública, padrão 127.0.0.1:5002; alternativa 10.0.2.2 documentada para emulador. Não redirecionar Web API para Android.
- Componentes nativos separados em screens/components/theme; transporte e protocolo em services; hook de ciclo de vida em hooks. Conceitos do Web reutilizados em código local, sem componentes DOM nem dependência runtime do frontend Web.
- A implementação Android do React Native gera Origin HTTP por padrão. Confirmado no WebSocketModule.kt instalado. Adaptador native-socket envia Origin vazio, aceito pela política nativa existente com JWT obrigatório. Não relaxar Origin da Web API nem mudar backend para acomodar o cliente.
- UUID nativo via expo-crypto, injetado no transporte para teste sem ambiente nativo. Sessão/JWT somente em memória. Ao sair, o transporte elimina snapshot, token, listeners de socket e timers; hook remove listener AppState.
- Em segundo plano, fechar socket, cancelar retry e converter pendências em resultado incerto. Preservar rascunho/conversa enquanto o processo existir; retorno verifica expiração e reconecta sem replay. Não prometer execução/recepção contínua em background.
- ACK remote_received só confirma serviço remoto. Watchdog local 12s cobre ausência de resposta ao dispositivo; timeout interbackend continua 5s. Erro conhecido recupera texto se não houver outro rascunho; resposta tardia não sobrescreve estado terminal. Timestamp próprio não é inventado.
- Safe Area nativa, KeyboardAvoidingView/resize, ScrollView para a lista efêmera da sessão, alvos de toque de pelo menos 48dp, fontes do sistema e paleta aprovada. FlatList inicialmente usado calculava scrollToEnd antes de estabilizar a altura de balões/status; simplificado para medir o conteúdo real. Trade-off: renderiza toda a conversa da sessão, sem otimização para histórico extenso (fora do MVP). Usuário/autor visíveis, textos quebram linha, envio vazio/excessivo bloqueado. Tentativa com canal indisponível produz aviso e preserva texto.
- Testes físicos via ADB e navegador Edge isolado/Playwright, sem hooks de teste no aplicativo. Credenciais efêmeras por API. Cenário de ACK ausente usa peer WS controlado autenticado, identificado separadamente da prova Web ↔ Android por duas APIs reais.
- Alertas npm são registrados separadamente por projeto/comando. Preservados os 12 altos do Web; Mobile também tem alertas transitivos Expo/Metro/codegen. Nenhum audit fix --force; avaliar compatibilidade e alcançabilidade no Gate 4, mantendo status PENDENTE.

## Gate 2 — frontend Web

- Next.js App Router 16.4.6 e React 19.3.1, versões estáveis consultadas no registro npm e compatíveis com Node 24.18.0. Sem API routes/proxy de chat no Next: o navegador chama exclusivamente a Web API existente.
- Sessão em estado React, HTTP em lib/api, protocolo tipado/validado em lib/protocol e ciclo de vida WS em lib/chat-client. useSyncExternalStore conecta o transporte aos componentes, sem biblioteca de estado adicional. Token não é persistido; logout fecha conexão/cancela timers e remove sessão.
- Mantido o protocolo dos backends. Mensagens próprias não têm horário fabricado: o ACK não contém timestamp, portanto horário é exibido só nos envelopes recebidos. Deduplicação visual por origem/ID; respostas tardias não alteram estado terminal.
- Reconexão do navegador com backoff 1–30s, uma conexão por cliente, reset após 30s estáveis; três handshakes consecutivos sem abrir encerram a tentativa automática e oferecem ação real de reconectar/novo login. Browser não expõe HTTP 401 do handshake: não se presume motivo de autenticação a partir de falha de rede. Expiração é tratada por expiresAt/evento real/fechamento 1008.
- Watchdog do cliente de 12s evita estado Enviando indefinido se a resposta se perder entre Web API e navegador. Não substitui timeout interbackend de 5s e não reenvia mensagens. Estados conhecidos de rejeição recuperam rascunho se o usuário ainda não digitou outro texto; resultado incerto não gera tentativa automática.
- Botão Enviar permanece acionável para texto válido durante indisponibilidade, permitindo o feedback exigido ao tentar enviar. O transporte bloqueia o envio real sem canal e mantém rascunho; vazio/excesso de tamanho desabilitam o botão. Essa interpretação mantém o requisito oficial de aviso na tentativa.
- CSS próprio com tokens aprovados, fontes do sistema, SVG simples para marca/ícones, sem fontes remotas ou biblioteca visual. Nome do usuário permanece visível em telas estreitas. UI_UX.md original preservado.
- Browser integrado sem navegador disponível (lista vazia). QA via Playwright/Edge instalado, contexto isolado, sem alterar configurações globais ou acessar perfil pessoal. W01 apenas atrasa resposta real para observar loading; W07/W08 interceptam eventos reais para injetar falhas, não substituem a integração das APIs.
- ESLint 10 com plugins diretos compatíveis (Next, React Hooks e TypeScript); config agregado do Next trouxe plugins com peer limitado a ESLint 9 e foi removido. Instalação pelo lockfile e lint verificados. Alertas transitivos de picomatch em ferramentas de desenvolvimento permanecem documentados; produção sem alertas na consulta.

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
