# Gate 4 — diagnóstico inicial (18/11/2026)

- Git inicialmente limpo, branch main; nenhuma alteração local a preservar. Sem commit/push nesta etapa.
- Ambiente confirmado: Node 24.18.0, npm 11.16.0, SDKs .NET 9.0.301 e 10.0.404. Dependências diretas instaladas correspondem aos manifests; npm ls --depth=0 aprovado em Web/Mobile.
- Web: Next 16.4.6, React 19.3.1, TypeScript 5.9.3. Mobile: Expo 58.0.26, RN 0.88.1, React 19.3.0, TypeScript 6.0.3. Lockfiles npm por projeto e NuGet por API presentes.
- Problemas comprovados nesta inspeção: ADB ainda não enumera aparelho, inclusive fora do sandbox. Necessário resolver conexão para repetir teste físico. Não foi demonstrado novo defeito funcional da aplicação.
- Vulnerabilidades reportadas: Web mantém 12 alertas altos na consulta inicial (picomatch transitivo); histórico Mobile tem 28 alertas (26 altos/2 moderados), picomatch e minimatch. Contagens são pacotes afetados, não advisories distintos. Investigação atual e auditorias completas ainda em execução.
- Limitações aceitas: sessão/histórico em memória, ACK apenas de backend, resultado incerto sem replay, HTTP/WS local, sem revogação de JWT, ScrollView para conversa efêmera, sem recepção garantida em background.
- Testes pendentes desta etapa: builds das duas APIs, 18 grupos de integração, quatro checks de transporte, oito cenários Web, seis testes Mobile, Expo Doctor/export e dez cenários físicos. Evidências anteriores não equivalem a regressão atual.
- Fora do escopo: features, redesign, refatoração estrutural, APK obrigatório, TLS/deploy, slides e roteiro.
- Harnesses existentes gravam nas pastas históricas: será adicionado destino opcional de evidências para preservar integralmente os registros anteriores, sem mudar os cenários ou o comportamento do produto.
- npm audit falhou no sandbox por acesso à rede/cache; consulta repetida fora dele. Nenhum pacote foi atualizado antes deste diagnóstico. Sugestões automáticas de downgrade não serão aplicadas.
