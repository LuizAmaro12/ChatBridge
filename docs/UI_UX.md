# TalkToMe --- Diretrizes de UI/UX (Web e Mobile)

> **Status:** proposta aprovada para orientar a implementação visual dos
> Gates 2 e 3.\
> **Prioridade:** MVP funcional e consistente antes de polimento
> opcional.\
> **Abrangência:** Next.js (Web) e React Native/Expo (Mobile).\
> **Documento oficial de requisitos:** `Avaliacao.MD`. **Diretrizes de
> execução:** `AGENTS.md`.\
> **Contrato técnico:** `docs/MESSAGE_CONTRACT.md` e
> `docs/ARCHITECTURE.md`.

## 1. Propósito e limites

O TalkToMe é uma aplicação demonstrativa de **conversa em tempo real
entre um usuário Web e um usuário Mobile**, cada um conectado
exclusivamente ao seu respectivo backend ASP.NET Core. As APIs se
comunicam por WebSocket bidirecional.

Este documento define a **experiência visual**, não altera a
arquitetura, o protocolo nem os requisitos oficiais. Havendo conflito,
prevalecem `Avaliacao.MD`, `AGENTS.md` e os contratos técnicos
aprovados. O Codex deve **consultar os nomes reais dos eventos e
campos** antes de implementar a integração: os exemplos visuais abaixo
não autorizam inventar payloads ou endpoints.

### Objetivos de experiência

1.  Usuário entende em poucos segundos onde entrar, escrever e enviar
    uma mensagem.
2.  Envio e recebimento são claros e rápidos; o autor é distinguível sem
    depender apenas de cor.
3.  Estado de conexão e problemas de entrega são transparentes e
    honestos.
4.  Web e Mobile compartilham identidade visual, com comportamentos
    nativos adequados a cada plataforma.
5.  Layout é limpo, responsivo, acessível e demonstrável sem dados
    fictícios.

### Escopo do MVP

**Incluído (P0):** login por plataforma; identificação do usuário
autenticado; chat de uma sala; envio/recebimento de texto; mensagens com
autor e horário quando disponíveis; estado de conexão; estados de envio
coerentes com o protocolo; validação de campo vazio; feedback de erros;
logout; tratamento de sessão expirada; scroll; responsividade Web;
teclado e Safe Area no Mobile.

**Refinamentos (P1, somente após P0 testado):** transições discretas,
skeleton/placeholder de conexão, atalhos de teclado, ajustes de
acessibilidade, polimento de espaços e tipografia, indicação visual
sutil de reconexão.

**Fora do escopo (não exibir controles fictícios):** tela de
configurações, perfil editável, avatar com upload, cadastro, múltiplas
conversas, grupos, anexos, imagens, áudios, chamadas, busca de
mensagens, notificações push, indicadores de digitação, confirmação de
leitura, status de presença do destinatário, histórico persistente,
preferências de tema e dashboard. Não implementar nada disso sem nova
aprovação explícita.

**Observação:** o botão de logout é uma ação de sessão, não uma tela de
configurações. Um pequeno menu de conta pode ser usado **apenas se**
oferecer uma ação real de sair; preferir botão direto pela simplicidade.

## 2. Identidade visual

### Direção de arte

Visual **moderno, minimalista, profissional e acolhedor**, com
superfícies claras, bordas suaves, bastante espaço em branco, hierarquia
tipográfica forte e azul como cor de ação. Evitar excesso de gradientes,
efeitos chamativos, imagens decorativas, menus sem função e componentes
de redes sociais.

### Paleta oficial inicial

  -----------------------------------------------------------------------
  Token                   Valor                   Aplicação
  ----------------------- ----------------------- -----------------------
  `color.primary`         `#2563EB`               Botões, links, foco,
                                                  mensagens próprias

  `color.primaryHover`    `#1D4ED8`               Hover/pressionado em
                                                  ação principal

  `color.primarySoft`     `#DBEAFE`               Realce suave, estados
                                                  informativos

  `color.text`            `#0F172A`               Texto principal

  `color.textSecondary`   `#475569`               Metadados, texto
                                                  auxiliar

  `color.background`      `#F8FAFC`               Fundo da aplicação

  `color.surface`         `#FFFFFF`               Cartões, painel de
                                                  chat, inputs

  `color.surfaceMuted`    `#F1F5F9`               Mensagens recebidas,
                                                  áreas secundárias

  `color.border`          `#E2E8F0`               Divisórias e bordas

  `color.success`         `#16A34A`               Conexão ativa e
                                                  feedback positivo

  `color.warning`         `#D97706`               Reconectando,
                                                  confirmação incerta

  `color.danger`          `#DC2626`               Falha, validação,
                                                  sessão expirada
  -----------------------------------------------------------------------

As cores são referências visuais compartilhadas, não exigência de
biblioteca de tokens comum entre React e React Native. Evitar contrastes
insuficientes; texto secundário deve permanecer legível. **Não usar
apenas cor** para transmitir status: combinar com rótulo e, quando útil,
ícone.

### Tipografia

-   Fonte preferencial: **Inter**, caso já esteja disponível sem custo
    de configuração relevante; alternativa segura: stack de fontes do
    sistema (Web) e fontes nativas (Mobile).
-   Título da aplicação: 20--24 px, semibold/bold.
-   Título da conversa: 16--18 px, semibold.
-   Corpo das mensagens: 14--16 px, regular, altura de linha
    confortável.
-   Metadados e horários: 12--13 px, contraste suficiente.
-   Botões e inputs: 14--16 px, semibold/regular conforme função.
-   Não reduzir fonte para caber textos; permitir quebra de linha e
    crescimento dos balões.

### Espaçamento, formas e efeitos

-   Escala: 4, 8, 12, 16, 24 e 32 px.
-   Raios: 8 px em controles pequenos; 12--16 px em cartões e inputs;
    16--20 px nos balões de mensagem.
-   Sombras discretas, principalmente na superfície do chat Web;
    preferir bordas e contraste suave.
-   Alvos de toque no Mobile: preferencialmente **44--48 dp ou mais**.
-   Animações opcionais: 120--200 ms, sutis, sem prejudicar desempenho
    ou acessibilidade.

## 3. Arquitetura da experiência

Fluxo mínimo em cada plataforma:

``` text
Abrir aplicativo
  └── Tela de login
       ├── Credenciais inválidas → mensagem clara e tentativa novamente
       └── Login válido → Tela de chat
            ├── Conectando / reconectando / conectado / desconectado
            ├── Enviar mensagem
            ├── Receber mensagem
            ├── Ver status honesto de envio
            └── Sair → limpar sessão e voltar ao login
```

Não introduzir telas intermediárias, onboarding ou seleção de conversa.
Há apenas **uma conversa/sala** prevista para o MVP.

### 3.1 Tela de login --- Web

-   Fundo `background`, cartão branco centralizado, largura aproximada
    de 360--420 px.
-   Marca **TalkToMe** e subtítulo curto: "Converse em tempo real entre
    Web e Mobile".
-   Campos claramente rotulados: usuário e senha.
-   Botão primário "Entrar" ocupando a largura do formulário.
-   Erro de autenticação abaixo do formulário, sem revelar se o usuário
    ou a senha está incorreto.
-   Durante login: botão em estado de carregamento e protegido contra
    duplo envio.
-   Não mostrar credenciais de teste na tela; documentá-las no README e
    mantê-las em configurações locais apropriadas.
-   Não adicionar "Esqueci minha senha", "Criar conta" ou links sem
    implementação.

### 3.2 Tela de login --- Mobile

-   Mesma hierarquia visual e paleta, com conteúdo em coluna e margens
    de 20--24 dp.
-   Respeitar Safe Area, teclado, rolagem em telas pequenas e botão
    visível quando possível.
-   Campos com `autoCapitalize` apropriado, senha oculta e controle de
    visibilidade somente se implementado de fato.
-   Mostrar erros perto do formulário e feedback de carregamento.
-   Não depender de imagens remotas para o logo; logotipo tipográfico é
    suficiente.

### 3.3 Tela de chat --- Web

**Layout desktop sugerido:** cabeçalho global discreto; área central de
conversa com largura máxima de aproximadamente 880--960 px; cabeçalho da
sala; histórico **somente da sessão atual**; compositor fixo na parte
inferior do painel.

Uma barra lateral **não é obrigatória**. Se utilizada em telas grandes,
deve conter apenas informações reais (marca, identificação da sala,
usuário conectado e ação de sair), **nunca uma lista fictícia de
conversas**. Em telas menores, usar layout de coluna única.

**Cabeçalho da conversa:** "Conversa geral" ou nome da sala definido no
contrato; identificação do usuário logado; status de conexão com rótulo
textual; ação "Sair".

**Área de mensagens:** mensagens próprias alinhadas à direita e
recebidas à esquerda. Mostrar nome do remetente quando necessário,
horário discreto quando disponível e texto com quebra de linha. Balões
próprios em azul com texto branco; recebidos em superfície cinza-clara
com texto escuro. Garantir contraste adequado. Não inventar histórico:
ao iniciar sem mensagens, mostrar estado vazio.

**Compositor:** campo de texto de uma ou poucas linhas, botão "Enviar"
com ícone opcional e rótulo acessível; `Enter` envia e `Shift+Enter`
quebra linha **somente se** campo multiline for adotado. Desabilitar
envio vazio ou durante estado que não permite enviar. Limitar tamanho
conforme contrato técnico e informar ao usuário.

**Responsividade:** abaixo de \~768 px, ocultar elementos secundários,
reduzir margens e manter cabeçalho, mensagens e compositor utilizáveis.
Evitar rolagem horizontal.

### 3.4 Tela de chat --- Mobile

-   Cabeçalho compacto com título "Conversa geral", status de conexão e
    ação "Sair" acessível.
-   Lista de mensagens flexível, ocupando o espaço disponível.
-   Balões próprios à direita e recebidos à esquerda, mesmos tokens e
    hierarquia da Web.
-   Compositor preso à base da área útil, respeitando Safe Area e
    teclado (`KeyboardAvoidingView` ou estratégia compatível testada).
-   Botão de envio com área de toque confortável; manter feedback de
    pressionamento e acessibilidade.
-   Scroll para a mensagem mais recente quando o usuário estiver próximo
    do fim; **não forçar o scroll** se estiver lendo mensagens
    anteriores.
-   Testar textos longos, teclado aberto, tela pequena e rotação apenas
    se houver tempo; priorizar Android de demonstração.

## 4. Estados visuais e microcopy

### 4.1 Conexão

  -----------------------------------------------------------------------
  Estado                  Texto sugerido          Comportamento
  ----------------------- ----------------------- -----------------------
  Inicial                 "Conectando..."         Mostrar carregamento
                                                  discreto; não prometer
                                                  envio

  Ativa                   "Conectado"             Permitir compor/enviar

  Reconectando            "Reconectando..."       Preservar texto
                                                  digitado; bloquear
                                                  novos envios se canal
                                                  indisponível

  Inativa                 "Desconectado"          Informar
                                                  indisponibilidade e
                                                  tentativa de reconexão,
                                                  quando houver

  Sessão expirada         "Sua sessão expirou.    Encerrar sessão e
                          Entre novamente."       retornar ao login
  -----------------------------------------------------------------------

**Importante:** "Conectado" indica conexão do cliente com sua própria
API. **Não afirmar que o destinatário está online**, a menos que exista
evento confiável no protocolo para isso.

### 4.2 Estados de mensagem

Os estados apresentados devem refletir **exatamente os eventos
efetivamente disponíveis em `docs/MESSAGE_CONTRACT.md`**. Não inventar
ACKs adicionais.

  -----------------------------------------------------------------------
  Estado de UI            Texto/feedback          Regra
  ----------------------- ----------------------- -----------------------
  Enviando                "Enviando..."           Aguardando resultado
                                                  local/remoto

  Aceita localmente       "Processando..."        Exibir somente se o
                                                  protocolo distinguir
                                                  esse marco

  Aceita remotamente      "Recebida pelo serviço  ACK `remote_received`;
                          remoto"                 **não equivale a
                                                  entrega ao
                                                  dispositivo**

  Falha conhecida         "Não foi possível       Erro comprovado, com
                          enviar"                 explicação curta

  Resultado incerto       "Não foi possível       Timeout/ACK ausente;
                          confirmar o             não afirmar que a
                          recebimento"            mensagem não chegou
  -----------------------------------------------------------------------

Evitar ícones de dupla marca de leitura, "Entregue" ou "Lida". Não
reenviar automaticamente mensagens com resultado incerto; isso pode
duplicá-las. Uma eventual ação manual de tentar novamente requer
comportamento de idempotência explicitamente previsto e testado; se não
houver, não oferecer o botão.

### 4.3 Estado vazio

Mensagem central, curta e discreta:

> **Sua conversa começa aqui**\
> Envie uma mensagem para iniciar o chat.

Não criar mensagens simuladas de demonstração na interface real. Em
testes automatizados, usar fixtures apenas no ambiente de teste.

### 4.4 Validações e erros

-   Mensagem vazia/espaços: impedir envio; preferir botão desabilitado e
    feedback curto se necessário.
-   Mensagem acima do limite: indicar limite conforme contrato, sem
    truncar silenciosamente.
-   Falha de login: "Não foi possível entrar. Confira suas credenciais."
-   Falha de rede: "Sem conexão com o serviço. Tentando reconectar..."
    somente quando realmente houver tentativa.
-   Falha desconhecida: "Ocorreu um problema. Tente novamente."
-   Erros não devem limpar o texto digitado sem necessidade.
-   Não mostrar stack trace, URLs internas ou tokens na interface.

## 5. Comportamentos funcionais obrigatórios

### Login e sessão

-   O Web chama **somente a Web API**; o Mobile chama **somente a Mobile
    API**.
-   Manter o token em memória durante a sessão para o MVP, evitando
    persistência desnecessária em `localStorage`, `AsyncStorage` ou
    logs. Se o aplicativo reiniciar, pode exigir novo login.
-   No logout, encerrar WebSocket, cancelar tarefas/reconexões, limpar
    credenciais em memória e voltar ao login.
-   Nunca aceitar identidade do remetente informada pela UI como
    autoridade; renderizar identidade validada recebida do backend.
-   Se a autenticação WebSocket exigir token na URL, construir a URL
    apenas no momento da conexão e não registrá-la; seguir a
    implementação/contrato da API, sem expor token em telemetria.

### Mensagens e ordenação

-   Renderizar mensagens recebidas conforme o contrato existente, usando
    `messageId` como identificador estável quando presente.
-   Deduplicar visualmente mensagens repetidas por identificador, sem
    mascarar erros de protocolo.
-   Preservar texto, quebras de linha e espaços relevantes; impedir HTML
    executável e conteúdo perigoso na renderização.
-   Horário em formato local legível, com tratamento de timestamps
    inválidos; não criar horário falso quando ausente.
-   **Sem banco:** mensagens existem somente durante a sessão/vida útil
    em memória. Recarregar a página ou reiniciar o aplicativo pode
    perder a conversa; não anunciar "histórico salvo".
-   Não apresentar confirmação de leitura ou presença de outro usuário.

### Estados de conexão

-   Ao conectar, atualizar status a partir do evento real da conexão.
-   Em queda, impedir falso estado "Conectado" e preservar o rascunho.
-   Na reconexão, evitar múltiplos sockets e listeners duplicados.
-   Não enviar uma mensagem sem canal disponível; não inventar sucesso.
-   Ao desmontar tela ou sair, encerrar e limpar recursos.

## 6. Acessibilidade e usabilidade

-   Contraste adequado entre texto/fundo e entre balões.
-   Inputs com labels visíveis; não depender apenas de placeholders.
-   Foco de teclado visível na Web; ordem de tabulação natural.
-   Botões com nomes acessíveis; ícones isolados exigem descrição.
-   Mensagens de erro anunciáveis para leitores de tela quando viável.
-   Textos suportam zoom e tamanhos de fonte maiores sem sobreposição.
-   Indicadores de conexão e falha devem conter texto, não apenas pontos
    coloridos.
-   Mobile: alvos de toque confortáveis, Safe Area e teclado sem cobrir
    o compositor.
-   Evitar animações desnecessárias ou que atrapalhem leitores de tela.

## 7. Organização sugerida de componentes

**Web (sugestão, adaptar à estrutura real do Next.js):**

``` text
apps/web/
  src/
    app/                 # rotas e layout
    components/
      auth/              # LoginForm
      chat/              # ChatHeader, MessageList, MessageBubble, MessageComposer
      ui/                # Button, Input, StatusIndicator (somente se úteis)
    hooks/               # estado da sessão/conexão, quando fizer sentido
    lib/                 # cliente HTTP, WebSocket e mapeamento do protocolo
    styles/              # tokens/estilos globais
```

**Mobile (sugestão, adaptar ao Expo escolhido):**

``` text
apps/mobile/
  src/
    screens/             # LoginScreen, ChatScreen
    components/          # ChatHeader, MessageBubble, MessageComposer, StatusIndicator
    services/            # cliente HTTP e WebSocket
    theme/               # tokens de cores, espaçamento e tipografia
```

Evitar componentes artificiais e bibliotecas de UI desnecessárias. É
aceitável que Web e Mobile tenham implementações de componentes
diferentes, desde que usem a mesma linguagem visual e comportamento.

## 8. Estratégia por Gate

### Gate 2 --- Web

1.  Ler `Avaliacao.MD`, `AGENTS.md`, `docs/MESSAGE_CONTRACT.md` e este
    documento.
2.  Inicializar Next.js/TypeScript com dependências mínimas e versão
    compatível.
3.  Implementar tokens e componentes básicos.
4.  Construir login e integrar à **Web API**.
5.  Construir chat e integrar WebSocket real à **Web API**.
6.  Implementar estados de conexão, mensagem, erro e logout.
7.  Testar no navegador com backend em execução, inclusive
    responsividade e expiração de sessão.
8.  Atualizar `README.md`, `docs/PROGRESS.md` e testes pertinentes.
9.  **Parar e aguardar aprovação antes do Gate 3.**

### Gate 3 --- Mobile

1.  Reutilizar paleta, tipografia, espaçamento, linguagem e estados do
    Gate 2.
2.  Inicializar Expo/React Native com configuração mínima.
3.  Construir login e integrar exclusivamente à **Mobile API**.
4.  Construir chat com WebSocket real, Safe Area e teclado.
5.  Testar no Android (emulador ou aparelho físico), validando IP/porta
    acessíveis.
6.  Executar demonstração Web ↔ Mobile com ambos os backends.
7.  Registrar evidências e pendências; não avançar automaticamente ao
    Gate 4.

### Gate 4 --- Integração e polimento

-   Testar fluxo ponta a ponta com dois usuários reais de demonstração.
-   Conferir autoria, ordem, status, falhas, reconexão e logout.
-   Corrigir bugs e inconsistências visuais; polir sem expandir escopo.
-   Preparar roteiro curto de apresentação e comandos reproduzíveis.

## 9. Critérios de aceite visual e funcional

### Web

-   [ ] Login com campos claros, feedback e autenticação real na Web
    API.
-   [ ] Tela de chat responsiva, sem scroll horizontal.
-   [ ] Mensagens próprias/recebidas distinguíveis por alinhamento, nome
    e estilo.
-   [ ] Envio/recebimento real via WebSocket, sem comunicação direta com
    a Mobile API.
-   [ ] Estado de conexão correto, inclusive queda e reconexão.
-   [ ] Status de envio sem falsa confirmação de entrega/leitura.
-   [ ] Erros, sessão expirada e logout tratados.
-   [ ] Sem botões decorativos ou funcionalidades fictícias.

### Mobile

-   [ ] Mesma identidade visual, adaptada ao formato mobile.
-   [ ] Login real na Mobile API.
-   [ ] Chat com mensagens legíveis, teclado e Safe Area corretos.
-   [ ] Envio/recebimento real via WebSocket, sem comunicação direta com
    a Web API.
-   [ ] Estados de conexão, envio e erro consistentes com a Web.
-   [ ] Logout encerra conexão e limpa a sessão.
-   [ ] Teste em Android documentado.

### Comum

-   [ ] Funcionalidades obrigatórias da avaliação preservadas.
-   [ ] Nenhuma mudança de contrato/API sem justificativa e validação de
    regressão.
-   [ ] Nenhum segredo real exposto no repositório ou frontend.
-   [ ] Nenhum recurso de configurações, presença, histórico ou leitura
    prometido sem implementação.
-   [ ] Evidências de testes reais registradas, sem afirmar testes não
    executados.

## 10. Decisões e trade-offs

  -----------------------------------------------------------------------
  Decisão                 Motivo                  Limitação assumida
  ----------------------- ----------------------- -----------------------
  Uma conversa/sala       Atende ao objetivo com  Não há lista de
                          menor risco             conversas

  Sem tela de             Não contribui para o    Preferências não são
  configurações           requisito central       editáveis

  Sem persistência        Respeita o escopo e o   Histórico pode
                          prazo                   desaparecer após
                                                  reinício

  Login simples           Demonstra autenticação  Sem
                          independente            cadastro/recuperação de
                                                  senha

  Mesma paleta Web/Mobile Coerência visual na     Componentes serão
                          avaliação               nativos de cada
                                                  plataforma

  Status de ACK rigoroso  Evita promessas falsas  Não há confirmação de
                          de entrega              leitura

  Design primeiro no Gate Permite referência      Não deve atrasar
  2                       concreta ao Mobile      integração funcional
  -----------------------------------------------------------------------

## 11. Instrução operacional para o Codex

Ao receber este arquivo, **não iniciar o Gate 2 apenas por lê-lo**.
Primeiro confirmar leitura, apontar conflitos reais com o contrato
existente e registrar a referência em `README.md` ou documentação
pertinente se solicitado. A implementação do Gate 2 só começa mediante
autorização explícita.

Durante os Gates 2 e 3: priorizar P0, preservar APIs e contratos
aprovados, não criar funcionalidades fora do escopo, não executar
commits/pushes sem autorização, registrar verificações reais e parar no
limite de cada Gate.

------------------------------------------------------------------------

**Regra final:** aparência profissional deve reforçar a confiabilidade
do chat, não competir com o funcionamento. Uma tela simples que envia,
recebe e explica corretamente o estado das mensagens vale mais do que um
painel sofisticado com recursos fictícios.
