import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

export default class SummaryReporter {
  results = [];
  onBegin() { this.started = new Date().toISOString(); }
  onTestEnd(test, result) {
    this.results.push({ title: test.title, status: result.status, durationMs: result.duration });
  }
  onEnd(result) {
    const directory = path.resolve(process.env.EVIDENCE_DIR || '../../docs/evidence/gate2');
    mkdirSync(directory, { recursive: true });
    writeFileSync(path.join(directory, 'results.json'), JSON.stringify({
      started: this.started, finished: new Date().toISOString(), status: result.status,
      browser: 'Microsoft Edge (Playwright, isolated headless context)', results: this.results,
    }, null, 2) + '\n');
  }
}
