import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import type { PublicExam, StudyNotes } from '../../shared/types';
import { api } from '../api';
import { Layout } from '../components/Layout';
import { StudyList } from '../components/StudyList';
import { ErrorBox } from '../components/ui';

/** The exam's word notebook, open before sitting it. */
export function StudyPage() {
  const { examId = '' } = useParams();
  const [data, setData] = useState<{ exam: PublicExam; notes: StudyNotes[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([api.exam(examId), api.study(examId)]).then(
      ([exam, notes]) => setData({ exam, notes }),
      (e: Error) => setError(e.message),
    );
  }, [examId]);
  useEffect(load, [load]);

  return (
    <Layout back={`/exam/${examId}`}>
      {error && <ErrorBox message={error} onRetry={load} />}
      {!data && !error && <div className="h-96 animate-pulse rounded-md bg-line" role="status" aria-label="Đang tải danh sách" />}
      {data && (
        <>
          <p className="text-sm text-muted">{data.exam.title}</p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight">Từ vựng và ngữ pháp của đề</h1>
          <p className="mt-2 mb-5 max-w-[60ch] text-[15px] text-pretty text-muted">
            Mọi từ và mẫu ngữ pháp xuất hiện trong đề, từ N5 đến N1, xếp theo từng bài. Che nghĩa hoặc cách đọc để tự kiểm tra.
          </p>
          <StudyList exam={data.exam} notes={data.notes} />
        </>
      )}
    </Layout>
  );
}
