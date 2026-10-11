import { describe, it, expect } from 'vitest';
import { validateNotes } from '../shared/notes';
import { fixtureExam, fixtureNotes } from './fixtures';

describe('validateNotes', () => {
  it('accepts sound notes', () => {
    expect(validateNotes(fixtureExam(), fixtureNotes())).toEqual([]);
  });

  it('names the mondai and question at fault', () => {
    const notes = fixtureNotes();
    notes[0].questions.pop();
    notes[0].questions[0].choices.pop();
    notes[0].vocab[0].q = [99];
    notes[1].passageVi = 'one\ntwo';
    notes.push({ ...notes[1], mondaiId: 'ghost' });
    expect(validateNotes(fixtureExam(), notes)).toEqual([
      'mv: question v2 has no note',
      'mv: v1: 3 choice notes, expected 4',
      'mv: vocab[0] 腕: q refers to a question outside this mondai',
      'mr: passageVi has 2 lines, the passage has 1',
      'ghost: no such mondai in the exam',
    ]);
  });
});
