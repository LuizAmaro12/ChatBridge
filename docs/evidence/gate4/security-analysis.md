# Segurança — Gate 4 (18/11/2026)

## Auditorias e decisão

| Projeto | Completa | `--omit=dev` | Advisories distintos |
|---|---|---|---|
| Web | 12 altos | 0 | 1: picomatch |
| Mobile | 27: 25 altos, 2 moderados | 27: 25 altos, 2 moderados | 2: picomatch e minimatch |
| tests/integration | 0 | 0 | 0 |

Relatórios `*-audit-full.json` e `*-audit-production.json` preservam a resposta npm. Exit 1 nos relatórios com alertas; exit 0 nos demais. `*-tree.json`: `npm ls --all --json`, exit 0 nos três projetos, sem árvore inválida.

As consultas NuGet das duas APIs (`dotnet list ... package --vulnerable --include-transitive --format json`) terminaram com exit 0 e nenhum pacote vulnerável listado. Relatórios `web-api-nuget-audit.json` e `mobile-api-nuget-audit.json`. Ausência de alertas conhecidos não equivale a segurança total.

**Nenhuma dependência foi atualizada.** Os manifests e lockfiles permanecem idênticos ao início do Gate 4. Logo, não existe uma auditoria “depois da correção”: estes são os resultados atuais da investigação. Mobile passou de 28 no histórico para 27 na consulta atual porque `@react-native/community-cli-plugin` deixou de constar como pacote afetado no relatório; nenhum advisory distinto desapareceu. Não atribuir essa variação a correção no projeto.

## Picomatch — alto, transitivo em Web e Mobile

- Instalados: **2.3.2 e 4.0.7**. Advisory **GHSA-fc5q-39xc-vjpf / CVE-2026-112366**, faixa afetada `<=4.0.7`.
- [GitHub Advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) informa ausência de versão corrigida. `npm view picomatch version` retornou **4.0.7**, ainda afetada.
- Web: `@next/eslint-plugin-next → fast-glob → micromatch → picomatch`; `typescript-eslint → typescript-estree → tinyglobby/fdir → picomatch`. Essas dependências são ferramentas de lint/desenvolvimento; auditoria sem dev retorna zero.
- Mobile: `expo → @expo/cli` e `@expo/metro-config → picomatch`; Metro/file-map/micromatch e jest-worker/jest-util; `react-native → tinyglobby/fdir → picomatch`. São cadeias de configuração, descoberta de arquivos, bundling/codegen, não processamento de texto do chat.
- A exploração exige padrões glob adversariais que produzam retrocesso excessivo na expressão regular. Inspeção de `apps/*/src` não encontrou uso dessas bibliotecas, padrões fornecidos por mensagens, armazenamento persistente de JWT ou execução de HTML. Conteúdo é validado pelas APIs e renderizado como texto.
- **Alcançabilidade:** não foi identificado caminho do conteúdo do chat até essas funções. Isso não é prova formal de ausência no bundle ou de segurança de todas as rotas do servidor de desenvolvimento. Build/lint sobre repositórios, configurações ou padrões não confiáveis continua sendo risco de disponibilidade.
- **Decisão:** mantido por ausência de correção publicada segura. Sugestões npm de downgrade do plugin Next/RN não corrigem a biblioteca atual de modo compatível; não aplicadas. Nenhum override ou `audit fix --force`.

## Minimatch — moderado, transitivo Mobile

- Instalado **10.2.6**, por `expo@58.0.26 → @expo/fingerprint@0.21.10 → minimatch@^10.2.6`.
- Advisory **GHSA-g3hv-75wg-m249 / CVE-2026-118764**, afeta `>=7.0.0 <11.0.1`; corrigido em **11.0.1**. Registro npm consultado: última versão **11.0.9**. [Advisory e referências do mantenedor](https://github.com/advisories/GHSA-g3hv-75wg-m249).
- Condição: padrão controlado por atacante e `optimizationLevel >= 2`, com amplificação do pré-processamento e consumo de CPU/memória.
- O código instalado `@expo/fingerprint/build/Options.js` constrói matchers através de `buildPathMatchObjects(ignorePaths)`; `utils/Path.js` passa somente `{ dot: true }`, mantendo otimização padrão **1**. O próprio mantenedor registra esse motivo no código; [fonte Expo](https://github.com/expo/expo/blob/main/packages/@expo/fingerprint/src/Options.ts). O projeto não configura fingerprint ou nível de otimização customizado.
- **Alcançabilidade:** condição vulnerável não alcançada no caminho padrão de fingerprint analisado. É ferramenta de fingerprint/build; não recebe mensagens do usuário. Essa conclusão é restrita a essa configuração/caminho, não uma declaração de risco zero do pacote.
- Verificação executável do helper instalado confirmou `{ dot: true }`, nível efetivo 1 e correspondência de um caminho comum. Hashes e trechos relevantes em `minimatch-reachability.json`; não foi executado payload de negação de serviço.
- `npm view expo version` retornou **58.0.26** e `npm view @expo/fingerprint version dependencies --json` retornou **0.21.10**, ainda com faixa `^10.2.6`. Não foi encontrada atualização compatível do responsável que incorpore a correção.
- **Decisão:** manter a versão compatível, com ressalva explícita. Forçar minimatch 11 atravessaria uma major fora da faixa do consumidor e exigiria aprovação específica e validação própria; não há justificativa para arriscar o SDK nesta entrega. A [orientação Expo](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/) exige manter dependências alinhadas e verificar com Expo Doctor; diagnóstico atual passou 20/20.

## Opções para os riscos remanescentes

1. Entrega de avaliação local com ressalvas: usar código/configurações confiáveis, Metro/Next locais e USB; manter advisories visíveis e reavaliar quando os mantenedores publicarem versões compatíveis. Opção recomendada para o escopo atual, condicionada à regressão funcional.
2. Se a política exigir zero alertas, bloquear essa aprovação de segurança e aguardar correção do picomatch/atualização compatível do Expo. Uma mudança major de minimatch isolada não elimina picomatch e não foi autorizada nem aplicada.

## Revisão do código/configuração

- JWT independente por API, credencial interbackend distinta, comparação criptográfica, origem Web restrita e JWT obrigatório no nativo. Regressão valida tokens inválidos/cruzados/expirados e handshake interno.
- Senhas e chaves locais comparadas com os **119 arquivos rastreados**: nenhuma ocorrência; apenas `.env.example` versionados. Arquivos `.env`, `.env.local`, next-env e resultados temporários ignorados. Ver `security-review.json`.
- Cliente armazena sessão em memória, fecha WS/cancela timers ao sair; a tela desmontada descarta conversa. Não usa localStorage/AsyncStorage nem logs com JWT. URLs públicas contêm apenas endereço da própria API.
- APIs suprimem logs ASP.NET que poderiam registrar query JWT. O harness também verifica ausência de credenciais/tokens nos logs coletados. Sem inspeção de histórico remoto do Git ou garantia de ausência de qualquer segredo desconhecido.
- Limites: 4 KiB HTTP, 16 KiB WS, 2000 unidades UTF-16, filas/conexões/pendências limitadas; validação de identidade no backend; cancelamento e limpeza cobertos pela regressão. Componentes correspondentes das duas APIs são equivalentes, exceto papel em Program.cs.
- HTTP/WS, credenciais demo e ausência de revogação JWT/rate limit de login são limites de demonstração local; não recomendar implantação pública. Nenhuma mudança de firewall, TLS, PATH ou configuração global.
- Binding existente da Mobile API no exemplo e `.env` local: **0.0.0.0:5002**, portanto escuta interfaces IPv4, embora a demonstração use USB/reverse. Isso não equivale a loopback exclusivo; eventual acesso LAN depende da rede/firewall. Os harnesses usam localhost explicitamente. Configuração preservada; para demonstração exclusivamente USB é possível configurar `ASPNETCORE_URLS=http://localhost:5002` no `.env` local. Não houve abertura de firewall nem alegação de isolamento de rede completo.
