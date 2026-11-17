# AGENTS.md — ChatBridge | Guia de execução para agentes de código

> **Missão:** entregar e demonstrar, até **quinta-feira às 13h**, um MVP de chat em tempo real entre um site Next.js e um aplicativo React Native/Expo, usando **dois backends ASP.NET Core independentes** que trocam mensagens por **WebSocket bidirecional**.
>
> **Fonte de verdade:** `Avaliacao.MD` na raiz. Leia-o integralmente no início de cada etapa. Em qualquer conflito, **o documento de avaliação prevalece** sobre este guia, prompts e preferências de implementação. Se um requisito for ambíguo, registre a interpretação e escolha a solução mínima defensável.

## 1. Regras permanentes de trabalho

1. **Não implementar tudo de uma vez.** Planejar → implementar uma fatia vertical → compilar → testar → registrar evidências → prosseguir apenas após autorização do responsável.
2. **MVP primeiro.** Nunca sacrificar autenticação, fluxo bidirecional, validações ou tratamento de falhas para adicionar recursos opcionais.
3. **Não declarar sucesso sem evidência.** Diferenciar explicitamente: implementado, compilado, testado automaticamente, testado manualmente e pendente. Não inventar resultados de testes, screenshots ou métricas.
4. **Mudanças mínimas e rastreáveis.** Antes de alterar contratos, portas, endpoints ou fluxo de autenticação, localizar consumidores nos quatro componentes e atualizar documentação e testes correspondentes.
5. **Sem sobreengenharia.** Não criar banco, filas, microsserviços adicionais, broker, Docker obrigatório, cadastro, notificações, upload, histórico persistente ou múltiplas salas. Não criar abstrações sem responsabilidade clara.
6. **Sem segredos versionados.** Credenciais de demonstração são de desenvolvimento; segredos de assinatura e de transporte devem vir de configuração local/variáveis de ambiente. Fornecer `.env.example` ou equivalente sem valores secretos.
7. **Concluir cada etapa com:** resumo de arquivos alterados, comandos executados, resultados reais, riscos, próximos passos e pontos que exigem decisão humana.
8. **Não sobrescrever alterações do usuário**, apagar arquivos, fazer reset destrutivo ou reestruturar o repositório sem necessidade. Não criar commits automaticamente salvo solicitação.
9. **Comunicação em português brasileiro**, clara e profissional. Código, símbolos e nomes técnicos podem usar inglês consistente.
10. **Prazo é restrição de projeto.** Se houver bloqueio, propor a menor alternativa que ainda cumpra `Avaliacao.MD` e comunicar o trade-off.

## 2. Matriz de prioridade da avaliação

| Critério | Peso | Evidência que queremos apresentar |
|---|---:|---|
| Arquitetura | 40% | Dois backends independentes; responsabilidades separadas; contrato JSON; autenticação separada; decisão documentada sobre topologia WebSocket |
| Engenharia | 25% | Web → mobile e mobile → web funcionando; falha entre serviços reproduzida; testes de login, validação e reconexão |
| Clean Code | 15% | Nomes claros, métodos curtos, DTOs, serviços coesos, configurações externas, tratamento consistente de erros |
| UI/UX | 10% | Login compreensível, chat legível, autoria visível, estados de conexão, erros acionáveis |
| Criatividade | 10% | **Estado de entrega claro**: enviada/confirmada pelo backend remoto/erro; evitar alegar leitura ou entrega garantida |

**Regra de corte:** 80% da pontuação depende de arquitetura, engenharia e legibilidade. Implementar primeiro o que permite provar esses critérios.

## 3. Arquitetura-alvo e limites

```text
Browser Next.js  ── HTTP login + WS autenticado ──> Web API (.NET)
                                                     ⇅
                                             WebSocket entre APIs
                                                     ⇅
Expo React Native ── HTTP login + WS autenticado ──> Mobile API (.NET)
```

- **Cada cliente acessa somente seu próprio backend.** Não criar comunicação direta web ↔ mobile ou frontend ↔ backend do outro sistema.
- **Dois processos .NET independentes**, com portas, configurações e ciclo de vida próprios.
- **Uma sala lógica** (`general`) para o MVP. Dados e usuários de demonstração em memória.
- **Login por HTTP** (`POST /auth/login`, ou rota documentada equivalente). Senha inválida retorna resposta clara e segura, sem detalhes de autenticação sensíveis.
- **Chat em tempo real por WebSocket**. Usar WebSocket também entre os backends, não substituir por HTTP polling, REST para troca entre serviços ou SignalR como única comunicação interbackend.
- **Transporte cliente ↔ backend:** WebSocket nativo é a opção inicial para reduzir dependências e facilitar a demonstração. Documentar o motivo.
- **Autenticação:** cada API valida apenas os próprios usuários/tokens; usar JWT ou mecanismo equivalente claramente explicado. Tokens têm expiração. Não confiar em `senderId`, `senderName`, `origin` fornecidos pelo cliente.
- **Autenticação interbackend:** credencial de serviço configurada fora do código e verificada no handshake, com comparação apropriada; nunca confiar apenas em porta/IP local. Não reutilizar token de usuário como identidade do serviço.
- **Topologia sugerida:** Web API atua como cliente WebSocket persistente e conecta ao endpoint interno da Mobile API; o canal estabelecido é **full-duplex**, e ambos podem enviar mensagens. Uma conexão iniciada de um lado já atende ao requisito de bidirecionalidade. Não criar duas conexões espelhadas sem necessidade.
- **Reconexão:** retry com backoff limitado para o canal interbackend; cancelamento correto no encerramento da aplicação; sem loops de CPU ou tempestade de logs.
- **Entrega:** ao enviar, responder ao cliente com sucesso somente quando houver a confirmação definida no contrato; se o backend remoto estiver indisponível, informar falha claramente. Sem banco, não prometer entrega após reinício ou quando o destinatário estiver desconectado.
- **Desconexão do destinatário:** definir e documentar comportamento: se o backend remoto receber, mas o cliente não estiver online, distinguir confirmação do backend de entrega ao usuário. Preferir texto claro na interface a uma garantia falsa.
- **Segurança local:** `ws://` e `http://` somente para desenvolvimento; registrar necessidade de TLS (`wss://`/`https://`) em produção. Cuidado com IP `localhost` no emulador Android e em dispositivos físicos; tornar URLs configuráveis.

### Organização mínima sugerida

```text
chatbridge/
├── Avaliacao.MD
├── AGENTS.md
├── README.md
├── .gitignore
├── apps/
│   ├── web/                  # Next.js + TypeScript
│   └── mobile/               # React Native + Expo
├── services/
│   ├── web-api/              # ASP.NET Core
│   └── mobile-api/           # ASP.NET Core
├── shared/
│   └── contracts/            # Especificação JSON e/ou projeto C# de contratos
└── docs/
    ├── ARCHITECTURE.md
    ├── MESSAGE_CONTRACT.md
    ├── DECISIONS.md
    ├── TEST_PLAN.md
    └── PROGRESS.md
```

**Não criar uma biblioteca C# compartilhada apenas por estética.** Se for usada, limitar a DTOs e contratos de transporte; as duas APIs devem continuar executáveis separadamente. Contratos TypeScript podem ser mantidos localmente em cada frontend ou compartilhados apenas se o ganho justificar a configuração.

## 4. Contrato e protocolo de mensagens

Definir a versão inicial em `docs/MESSAGE_CONTRACT.md` **antes de implementar** os handlers. Usar um envelope com `type` e `messageId`, com exemplos concretos.

Exemplo ilustrativo de mensagem **validada e enriquecida pelo backend**, não de payload confiável enviado pelo frontend:

```json
{
  "type": "chat.message",
  "messageId": "550e8400-e29b-41d4-a716-446655440000",
  "roomId": "general",
  "senderId": "web-demo",
  "senderName": "Usuário Web",
  "origin": "web",
  "content": "Olá!",
  "timestamp": "2026-11-17T22:00:00Z"
}
```

Regras obrigatórias do contrato:

- Mensagem do **cliente** contém apenas campos autorizados (por exemplo, `type`, `messageId`, `content`); identidade e horário confiável são gerados no servidor.
- `content`: aplicar `Trim()`, rejeitar `null`, vazio ou somente espaços; definir limite simples de tamanho e erro explícito.
- `messageId`: único; permitir correlação com ACK; deduplicação em memória com limite de retenção, se implementada.
- `timestamp`: UTC em ISO 8601.
- `roomId`: fixo `general` no MVP; validar se recebido.
- Definir `chat.message`, `chat.ack`, `chat.error` e, se necessário, `connection.status`, incluindo esquema mínimo, origem, significado e exemplos.
- ACK do backend remoto **não equivale** a leitura ou entrega ao dispositivo. Documentar sem ambiguidade.
- Evitar eco/loop: mensagem encaminhada entre backends não deve ser reencaminhada de volta. O destinatário publica localmente e responde ACK.
- Correlacionar respostas e falhas pelo `messageId`; timeout de ACK deve ser tratado.
- Documentar o que ocorre se o ACK se perder: evitar alegar exatamente-uma-vez sem persistência. Para o MVP, preferir semântica honesta e tratamento de duplicatas quando viável.
- Validar tamanho máximo dos frames/mensagens e tratar JSON inválido sem derrubar o processo.

## 5. Separação de responsabilidades nos backends

Evitar controladores gigantes e lógica de negócio embutida no loop de transporte.

- **Auth**: valida credenciais e emite/verifica token; contas de teste por backend.
- **Chat validation/service**: valida conteúdo, identifica autor via principal autenticado, constrói envelope confiável e decide encaminhamento.
- **Client connection manager**: controla conexões dos clientes daquele backend, remove sockets encerrados e distribui mensagens.
- **Interbackend transport**: gerencia conexão autenticada, serialização, envio, recepção, ACK, timeout e reconexão.
- **Contracts/DTOs**: tipos explícitos e consistentes.
- **Configuration**: portas, URLs, chaves e timeouts fora da lógica.

Usar DI para componentes com responsabilidades claras. Tratar `CancellationToken`, encerramento de sockets, concorrência no envio e exceções sem silenciá-las. Nunca manter `WebSocket` morto em coleção ativa.

## 6. Interface: mínima, limpa e confiável

Ambos os clientes precisam ter:

1. Tela de login com campos e feedback de credenciais inválidas.
2. Sala de chat após autenticação, com identificação visual do autor.
3. Lista de mensagens e campo de texto; bloquear envio vazio.
4. Estado da conexão (conectado, conectando, desconectado ou falha).
5. Erro visível quando o envio não puder ser encaminhado entre sistemas; não marcar mensagem como entregue prematuramente.
6. Tratamento de sessão/token inválido e encerramento da conexão ao sair.

**Criatividade de baixo risco:** status da mensagem como `Enviando`, `Recebida pelo outro backend` ou `Falha no envio`, conforme eventos realmente implementados. Não inventar confirmação de leitura.

Sem animações complexas, biblioteca visual pesada ou navegação desnecessária. Garantir uso com teclado no navegador e tamanho de toque adequado no mobile.

## 7. Ordem de execução — gates obrigatórios

### Gate 0 — Planejamento (primeira execução)
- Ler `Avaliacao.MD` e este `AGENTS.md`.
- Inspecionar ferramentas e repositório, sem presumir versões instaladas.
- Criar estrutura mínima e documentação: `ARCHITECTURE.md`, `MESSAGE_CONTRACT.md`, `DECISIONS.md`, `TEST_PLAN.md`, `PROGRESS.md`.
- Registrar decisão sobre topologia WebSocket, autenticação interbackend, ACK, timeout e tratamento de falhas.
- **Parar e solicitar revisão. Não implementar chat nesta etapa.**

### Gate 1 — Backends funcionais sem UI
- Criar duas APIs independentes; endpoints de login com contas distintas.
- Implementar autenticação WebSocket do cliente e canal WebSocket autenticado entre APIs.
- Implementar envio nos dois sentidos, validação, identidade confiável e ACK/erro.
- Testar com scripts ou clientes WebSocket, sem depender de Next.js/Expo.
- Testar indisponibilidade de um backend; compilar ambas as APIs.
- **Parar e apresentar evidências.**

### Gate 2 — Web
- Criar login e chat Next.js consumindo **apenas** Web API.
- Testar login inválido, envio, recebimento, autoria, estado e falha.
- **Parar e apresentar evidências.**

### Gate 3 — Mobile
- Criar login e chat Expo consumindo **apenas** Mobile API.
- Configurar URL acessível no emulador Android (não presumir que `localhost` aponta para o host).
- Validar ambos os sentidos web ↔ mobile e erros.
- **Parar e apresentar evidências.**

### Gate 4 — Consolidação
- Executar matriz de testes de `docs/TEST_PLAN.md`.
- Revisar nomes, contratos, logs, encerramento e erros.
- Completar README com comandos reais de instalação e execução de **quatro processos**, contas demo e ordem de inicialização.
- Registrar limitações honestas e preparar roteiro de demonstração de 5–7 minutos.
- Só considerar melhorias de UI depois dos testes críticos aprovados.

## 8. Testes obrigatórios e evidências

| ID | Cenário | Resultado esperado |
|---|---|---|
| T01 | Login web válido | Token/sessão web e acesso ao chat |
| T02 | Login mobile válido | Token/sessão mobile e acesso ao chat |
| T03 | Credenciais inválidas em ambos | Erro visível; sem acesso |
| T04 | Web envia para mobile | Mensagem aparece em tempo real com autor correto |
| T05 | Mobile envia para web | Mensagem aparece em tempo real com autor correto |
| T06 | Mensagem vazia ou espaços | Rejeição no backend; interface informa/bloqueia |
| T07 | WebSocket sem autenticação | Rejeição; não aceita mensagem |
| T08 | Tentativa de forjar autor | Backend ignora identidade do cliente e usa autenticação |
| T09 | Backend remoto indisponível | Envio falha e usuário é avisado, sem falso sucesso |
| T10 | Backend remoto retorna | Canal reconecta e nova mensagem trafega |
| T11 | JSON inválido/erro de transporte | Erro controlado; serviço permanece operacional |
| T12 | Mensagem duplicada/eco | Sem loop de encaminhamento; deduplicação conforme contrato |

Registrar em `docs/PROGRESS.md`: data, comando, ambiente, resultado observado e pendências. Testes não executados devem constar como **NÃO EXECUTADOS**, não como aprovados.

## 9. Critérios de pronto (Definition of Done)

Uma etapa só está pronta se:

- Compila e inicia com comandos documentados.
- Cumpre o comportamento esperado do gate.
- Erros relevantes têm feedback e logs adequados.
- Contratos e documentação correspondem ao código real.
- Testes críticos da etapa foram executados e seus resultados registrados.
- Nenhum segredo foi adicionado ao Git.
- A conclusão distingue fatos verificados de hipóteses e limitações.

O **MVP final** está pronto somente quando web e mobile conversam em tempo real nos dois sentidos, cada um via seu backend, com login, identificação confiável do autor, rejeição de mensagens vazias e aviso de falha de conexão.

## 10. Gestão de tempo e contingência

- Prioridade **P0:** dois backends independentes, canal interbackend WS bidirecional, login por backend, chat web/mobile, validações e aviso de falha.
- Prioridade **P1:** testes reproduzíveis, documentação da arquitetura, README operacional, reconexão e status de envio.
- Prioridade **P2:** refinamentos visuais e extras. Não começar P2 com P0 incompleto.
- Reservar o trecho final do prazo para executar tudo do zero, validar no emulador e preparar a demonstração.
- Se o emulador falhar, investigar conectividade e configuração de rede; **não substituir a entrega mobile por uma página web**, pois React Native/Expo é obrigatório.
- Se um recurso opcional ameaçar o prazo, remover ou adiar, registrar a decisão e preservar os requisitos.
- Ao encontrar bloqueio por mais de um ciclo de investigação, relatar causa, evidências, impacto e a menor correção plausível.

## 11. Como o Codex deve responder após cada tarefa

Use sempre este formato resumido:

1. **Escopo realizado** — o que foi realmente modificado.
2. **Arquivos alterados** — caminhos.
3. **Decisões técnicas** — motivo e trade-offs.
4. **Validações executadas** — comandos, resultados, falhas e testes não executados.
5. **Riscos/pendências** — objetivos e priorizados.
6. **Próximo gate** — o que recomenda fazer; aguardar aprovação.

**Lembrete final:** esta avaliação mede principalmente arquitetura, engenharia e capacidade de explicar decisões. Código funcional e verificável, com justificativas simples e precisas, vale mais do que funcionalidades extras não testadas.
