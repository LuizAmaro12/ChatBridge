import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Vulnerabilities are informational; an unavailable/invalid audit is not a clean audit.
export function classifyAudit(stdout, exitCode) {
  let report;
  try { report = JSON.parse(stdout.replace(/^\uFEFF/, '')); } catch { return { status: 'collection_error' }; }
  const counts = report?.metadata?.vulnerabilities;
  const levels = ['info', 'low', 'moderate', 'high', 'critical'];
  if (report?.error || !counts || !levels.every(k => Number.isInteger(counts[k]) && counts[k] >= 0) ||
      counts.total !== levels.reduce((sum, key) => sum + counts[key], 0) ||
      exitCode !== (counts.total > 0 ? 1 : 0)) return { status: 'collection_error' };
  return { status: counts.total ? 'vulnerabilities_reported' : 'no_known_alerts', counts };
}

export function runAudits(outputDirectory) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  mkdirSync(outputDirectory, { recursive: true });
  const results = [];
  for (const project of ['web', 'mobile']) {
    for (const mode of ['full', 'production']) {
      // Static command only; no user/PR text is interpolated into the shell.
      const command = mode === 'full' ? 'npm audit --json' : 'npm audit --omit=dev --json';
      const child = spawnSync(command, { shell: true, cwd: path.join(root, 'apps', project),
        encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 16 * 1024 * 1024 });
      const name = `${project}-${mode}`;
      writeFileSync(path.join(outputDirectory, `${name}.json`), child.stdout || '{}');
      writeFileSync(path.join(outputDirectory, `${name}-stderr.txt`), child.stderr || '');
      const result = { project, mode, command, exitCode: child.status,
        processError: child.error?.code ?? null, ...classifyAudit(child.stdout || '', child.status) };
      results.push(result);
      if (result.status !== 'no_known_alerts') {
        console.log(`::warning::${name}: ${result.status}; npm exit=${child.status}; total=${result.counts?.total ?? 'unknown'}. Consulte o artifact.`);
      }
    }
  }
  writeFileSync(path.join(outputDirectory, 'results.json'), JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2) + '\n');
  const rows = results.map(r => `| ${r.project} | ${r.mode} | ${r.exitCode ?? 'none'} | ${r.status} | ${r.counts?.high ?? '?'} | ${r.counts?.moderate ?? '?'} | ${r.counts?.critical ?? '?'} | ${r.counts?.total ?? '?'} |`);
  const summary = ['## Auditoria informativa — não é aprovação de segurança', '',
    'Baseline Gate 4: Web 12 altos (produção 0); Mobile 27 (25 altos/2 moderados) em ambas modalidades. Consulte docs/evidence/gate4/security-analysis.md.',
    'Alertas não bloqueiam builds/testes. Falha de consulta/JSON/execução falha este job. Nenhum baseline é subtraído dos resultados. Política de bloqueio por novos riscos ainda não implementada.', '',
    '| Projeto | Modo | Exit npm | Resultado | Altos | Moderados | Críticos | Total |',
    '|---|---|---|---|---|---|---|---|', ...rows, '',
    'As contagens de todas as severidades constam em results.json. no_known_alerts significa ausência de alertas reportados, não ausência de vulnerabilidades.', ''].join('\n');
  writeFileSync(path.join(outputDirectory, 'SUMMARY.md'), summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  console.log(summary);
  return results.some(r => r.status === 'collection_error') ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.env.AUDIT_OUTPUT_DIR) throw new Error('Defina AUDIT_OUTPUT_DIR para não sobrescrever evidências históricas.');
  process.exitCode = runAudits(path.resolve(process.env.AUDIT_OUTPUT_DIR));
}
