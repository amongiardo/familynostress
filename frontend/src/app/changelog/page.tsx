import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import type { ChangelogEntry } from '@/types';

function parseChangelog(raw: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  let current: ChangelogEntry | null = null;

  for (const line of raw.split('\n')) {
    if (line.startsWith('## ')) {
      if (current) entries.push(current);
      const header = line.replace(/^##\s+/, '').trim();
      const [versionPart, datePart] = header.split(' - ');
      current = {
        version: versionPart?.trim() || 'n/a',
        date: datePart?.trim() || '',
        title: '',
        items: [],
      };
      continue;
    }

    if (!current) continue;

    if (line.startsWith('### ')) {
      current.title = line.replace(/^###\s+/, '').trim();
      continue;
    }

    if (line.startsWith('- ')) {
      current.items.push(line.replace(/^- /, '').trim());
    }
  }

  if (current) entries.push(current);
  return entries;
}

export default function ChangelogPage() {
  const repoRoot = path.join(process.cwd(), '..');
  const version = fs.readFileSync(path.join(repoRoot, 'VERSION'), 'utf8').trim();
  const changelogRaw = fs.readFileSync(path.join(repoRoot, 'CHANGELOG.md'), 'utf8');
  const entries = parseChangelog(changelogRaw);

  return (
    <main className="changelog-page">
      <div className="changelog-shell">
        <section className="changelog-hero">
          <p className="text-uppercase fw-bold text-success small mb-2">Release Notes</p>
          <h1 className="mb-2">Changelog Family Planner</h1>
          <p className="text-muted mb-3">
            Storico sintetico delle versioni rilasciate in produzione.
          </p>
          <div className="d-flex flex-wrap gap-3 align-items-center">
            <span className="badge text-bg-success">Versione attuale {version}</span>
            <Link href="/login" className="version-link">
              Torna al login
            </Link>
          </div>
        </section>

        <section className="changelog-list">
          {entries.map((entry) => (
            <article key={`${entry.version}-${entry.date}`} className="changelog-card">
              <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-2">
                <div>
                  <h2 className="mb-1">Versione {entry.version}</h2>
                  {entry.title ? <div className="fw-semibold">{entry.title}</div> : null}
                </div>
                <span className="text-muted small">{entry.date}</span>
              </div>
              <ul className="mb-0">
                {entry.items.map((item, index) => (
                  <li key={`${entry.version}-${index}`}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
