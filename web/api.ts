import type { AttemptDetail, AttemptListItem, AttemptResult, Answers, ExamSummary, Part, PublicExam } from '../shared/types';

export interface User {
  id: number;
  username: string;
  role: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Fired when any request comes back 401, so the app can show the login screen. */
export const UNAUTHORIZED_EVENT = 'n2:unauthorized';

async function request<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(path, {
      credentials: 'same-origin',
      ...rest,
      ...(json !== undefined
        ? { method: rest.method ?? 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(json) }
        : {}),
    });
  } catch {
    throw new ApiError(0, 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !path.endsWith('/login')) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    throw new ApiError(res.status, (body as { error?: string }).error ?? `Lỗi ${res.status}`);
  }
  return body as T;
}

export const api = {
  me: () => request<{ user: User }>('/api/auth/me'),
  login: (username: string, password: string) => request<{ user: User }>('/api/auth/login', { json: { username, password } }),
  logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
  exams: () => request<ExamSummary[]>('/api/exams'),
  exam: (id: string) => request<PublicExam>(`/api/exams/${encodeURIComponent(id)}`),
  submit: (body: { examId: string; parts: Part[]; answers: Answers; startedAt: number }) =>
    request<{ id: number; result: AttemptResult }>('/api/attempts', { json: body }),
  attempts: (examId?: string) =>
    request<AttemptListItem[]>(`/api/attempts${examId ? `?examId=${encodeURIComponent(examId)}` : ''}`),
  attempt: (id: number | string) => request<AttemptDetail>(`/api/attempts/${id}`),
  audioUrl: (key: string) => `/api/audio/${key.split('/').map(encodeURIComponent).join('/')}`,
};
