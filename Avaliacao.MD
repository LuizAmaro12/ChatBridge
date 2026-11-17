**Prazo de entrega — Quinta-feira 13:00**

Desenvolva um chat em tempo real entre um site e um aplicativo mobile. Uma pessoa logada no site deve conseguir conversar com outra pessoa logada no app. Cada cliente se comunica com seu próprio backend, e os dois backends trocam mensagens por WebSocket.

### Stack obrigatória

- **Frontend web** — Next.js
- **Aplicativo mobile** — React Native com Expo
- **Backend web e backend mobile** — dois serviços independentes em ASP.NET Core (.NET)
- **Comunicação entre os backends** — WebSocket bidirecional

### Requisitos

1. **Login.** O site e o app devem validar as credenciais no respectivo backend. Disponibilize uma conta de teste por sistema e informe o usuário quando as credenciais forem inválidas.
2. **Chat.** Após o login, o usuário entra em uma sala compartilhada e pode enviar mensagens de texto. Cada mensagem deve exibir seu autor. A troca deve funcionar nos dois sentidos, com o recebimento em tempo real.
3. **Validação.** Cada backend deve aceitar mensagens apenas de usuários autenticados, identificar o autor pela autenticação e rejeitar mensagens vazias.
4. **Falha de conexão.** Se a conexão entre os sistemas estiver indisponível, a interface deve avisar o usuário ao tentar enviar uma mensagem.

Você pode manter os dados em memória e demonstrar o app em um emulador. Cadastro, histórico persistente e publicação são opcionais.

### Critérios de avaliação

| Critério | Peso | O que será avaliado |
|---|---:|---|
| **Arquitetura de software** | **40%** | Responsabilidades de cada componente, separação entre autenticação, regras do chat e transporte, contrato de mensagens entre os backends e justificativa das decisões. |
| **Engenharia** | **25%** | Funcionamento de ponta a ponta, tratamento de falhas e como você verificou os cenários principais. |
| **Clean Code** | **15%** | Clareza dos nomes, legibilidade e facilidade para entender e alterar o código. |
| **UI/UX** | **10%** | Clareza do fluxo de login e chat, feedback de erros e usabilidade no navegador e no celular. |
| **Criatividade e inovação** | **10%** | Uma decisão de produto ou de implementação que resolva bem um problema do chat. Pode ser um detalhe pequeno, desde que você consiga explicar o valor dele. |
