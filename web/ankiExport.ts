import type { AnkiKind, AnkiNote } from '../shared/anki';

/**
 * Builds the .apkg in the browser and hands it to the download manager.
 * SQLite (sql.js, about 650KB of wasm) and the zip writer load only when someone exports.
 */
export async function downloadApkg(deck: string, notes: Record<AnkiKind, AnkiNote[]>, filename: string) {
  const [{ default: initSqlJs }, { default: wasmUrl }, { buildApkg }] = await Promise.all([
    import('sql.js'),
    import('sql.js/dist/sql-wasm.wasm?url'),
    import('../shared/apkg'),
  ]);
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const bytes = await buildApkg(SQL, { deck, notes });

  const url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
