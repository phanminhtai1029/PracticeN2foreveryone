import { describe, it, expect } from 'vitest';
import { loadAttempt, saveAttempt, clearAttempt, newAttempt } from '../web/state/attemptStore';

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
  };
}

describe('attemptStore', () => {
  it('starts on paper unless listening only', () => {
    expect(newAttempt('x', ['vocab', 'listening'], 'custom', 5).stage).toBe('paper');
    expect(newAttempt('x', ['listening'], 'custom', 5).stage).toBe('listening');
  });

  it('round-trips answers and audio position', () => {
    const s = memoryStorage();
    const a = newAttempt('2023-12', ['vocab', 'grammar', 'reading', 'listening'], 'full', 1000);
    a.answers = { q1: 2, 'l1-1': 3 };
    a.audioPos = 123.4;
    a.listeningStarted = true;
    saveAttempt(a, s);
    expect(loadAttempt('2023-12', s)).toEqual(a);
    expect(loadAttempt('other', s)).toBeNull();
    clearAttempt('2023-12', s);
    expect(loadAttempt('2023-12', s)).toBeNull();
  });

  it('returns null for corrupted data', () => {
    const s = memoryStorage();
    s.setItem('n2:attempt:x', '{not json');
    expect(loadAttempt('x', s)).toBeNull();
    s.setItem('n2:attempt:x', JSON.stringify({ examId: 'x' }));
    expect(loadAttempt('x', s)).toBeNull();
  });
});
