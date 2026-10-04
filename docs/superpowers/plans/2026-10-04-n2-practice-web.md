# N2 Practice Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Web luyện đề JLPT N2 chạy local (Cloudflare Workers + D1 + R2 giả lập), có đăng nhập, chọn đề/phần, làm bài (kể cả nghe 1 lần), kết quả quy đổi điểm.

**Architecture:** Một package. `shared/` chứa type + logic thuần (markup, chấm điểm) dùng chung cho worker và web. `worker/` là Hono API, chạy trong workerd qua `@cloudflare/vite-plugin` (một lệnh `vite dev` chạy cả SPA lẫn API). `web/` là React SPA. Đề nằm ở `content/exams/<id>/exam.json`, seed vào D1 (bảng `exams` + `exam_mondai`, mỗi mondai một dòng để tránh giới hạn 100KB/statement của D1).

**Tech Stack:** TypeScript, React 19, react-router, Vite + @cloudflare/vite-plugin, Tailwind CSS v4, Hono, D1, R2, Vitest (node, D1 shim bằng `node:sqlite`), tsx cho scripts.

**Spec:** `docs/superpowers/specs/2026-10-04-n2-practice-web-design.md`

## Global Constraints

- Dark mode duy nhất; mobile-first; vùng chạm ≥ 44px; cỡ chữ đề ≥ 17px.
- UI tiếng Việt; nội dung đề tiếng Nhật có furigana qua markup `{漢字|かんじ}`.
- Đáp án không bao giờ nằm trong response `GET /api/exams/:id`.
- Mọi route `/api/*` trừ `POST /api/auth/login` yêu cầu session.
- Cookie `sid` HttpOnly, SameSite=Lax, `Secure` chỉ khi request là https (để dùng được qua LAN http từ điện thoại).
- Audio nghe: phát một lần, không có điều khiển tua/pause.
- Không commit `Exam/` (PDF, mp3) vào git.
- Mật khẩu: PBKDF2-SHA256, 100000 vòng (trần của Workers), salt 16 byte.

## Review Focus

1. Reload giữa bài (kể cả giữa phần nghe) → câu trả lời và vị trí audio phải còn nguyên. Test: `attemptStore` round-trip (Task 6).
2. Làm lẻ một phần (vd chỉ Từ vựng) → không được báo Đỗ/Trượt, nhóm 言語知識 hiện "—" có lý do. Test trong `scoring.test.ts` (Task 2).
3. Câu nghe chưa có đáp án (`answer: null`) → không tính vào tổng, kết quả "Tạm tính". Test trong `scoring.test.ts` (Task 2).
4. Client gửi id câu không tồn tại / phần không chọn / giá trị lựa chọn ngoài 1–4 → server bỏ qua, không crash, không cộng điểm. Test trong `scoring.test.ts` (Task 2) và `api.test.ts` (Task 4).
5. Hết giờ 105 phút ở full đề → tự chuyển sang nghe (hoặc nộp nếu không có nghe), không mất câu trả lời. Kiểm thủ công ở Task 8.

---

## File Structure

```
package.json, tsconfig.json, vite.config.ts, vitest.config.ts, wrangler.jsonc
db/migrations/0001_init.sql
shared/types.ts        Exam/Mondai/Question/Part/Result types
shared/markup.ts       parseMarkup(text) -> MarkupNode[]
shared/scoring.ts      gradeAttempt(exam, parts, answers) -> AttemptResult; partsSummary(exam)
worker/index.ts        Hono app, route mounting, export default
worker/db.ts           loadExam(db, id) (đầy đủ đáp án), listExams(db)
worker/auth.ts         hashPassword, verifyPassword, createSession, requireUser middleware
worker/routes/*.ts     auth, exams, attempts, audio
worker/env.ts          type Env { DB: D1Database; AUDIO: R2Bucket }
web/index.html, web/main.tsx, web/App.tsx, web/api.ts, web/styles.css
web/components/*       Markup, QuestionCard, QuestionNav, Timer, ListeningPlayer, ConfirmDialog, Layout
web/pages/*            LoginPage, ExamListPage, ExamSetupPage, TakeExamPage, ResultPage
web/state/attemptStore.ts   localStorage cho lượt làm đang dở
scripts/seed.ts, scripts/create-user.ts, scripts/prepare-audio.sh
content/exams/2023-12/exam.json, web/public/exam-assets/2023-12/*.png
test/markup.test.ts, test/scoring.test.ts, test/auth.test.ts, test/api.test.ts, test/attemptStore.test.ts, test/d1shim.ts
```

---

### Task 1: Scaffold + shared types + markup parser

**Files:** Create `package.json`, `tsconfig.json`, `vitest.config.ts`, `shared/types.ts`, `shared/markup.ts`, `test/markup.test.ts`

**Interfaces — Produces:**
```ts
// shared/types.ts
export type Part = 'vocab' | 'grammar' | 'reading' | 'listening';
export type Group = 'language' | 'reading' | 'listening';
export const PARTS: Part[] = ['vocab', 'grammar', 'reading', 'listening'];
export const PART_GROUP: Record<Part, Group> = { vocab: 'language', grammar: 'language', reading: 'reading', listening: 'listening' };
export interface Question { id: string; no: number; stem: string; choices: string[]; choiceCount: number; answer: number | null; answerVerified?: boolean }
export interface Mondai { id: string; part: Part; number: number; title?: string; instruction: string; weight: number; passage?: string; image?: string; questions: Question[] }
export interface Exam { id: string; title: string; level: string; audio?: { key: string; durationSec: number }; timeLimits: { languageReading: number }; mondai: Mondai[] }
export type PublicQuestion = Omit<Question, 'answer' | 'answerVerified'>;
export type PublicMondai = Omit<Mondai, 'questions'> & { questions: PublicQuestion[] };
export type PublicExam = Omit<Exam, 'mondai'> & { mondai: PublicMondai[] };
export type Answers = Record<string, number>; // questionId -> 1-based choice
export interface PartResult { part: Part; correct: number; total: number; answered: number; ungraded: number; weighted: number; maxWeighted: number }
export interface GroupResult { group: Group; scaled: number | null; reason?: string }
export interface QuestionReview { id: string; part: Part; chosen: number | null; answer: number | null; correct: boolean | null }
export interface AttemptResult { parts: PartResult[]; groups: GroupResult[]; total: number | null; status: 'pass' | 'fail' | 'provisional'; review: QuestionReview[] }
export interface ExamSummary { id: string; title: string; level: string; hasAudio: boolean; parts: Record<Part, { questions: number }> }
```
```ts
// shared/markup.ts
export type MarkupNode =
  | { t: 'text'; v: string }
  | { t: 'ruby'; base: string; rt: string }
  | { t: 'u'; children: MarkupNode[] }
  | { t: 'b'; children: MarkupNode[] }
  | { t: 'br' };
export function parseMarkup(src: string): MarkupNode[];
```

- [ ] **Step 1:** `npm init`, cài deps: `hono`, `react`, `react-dom`, `react-router`; dev: `typescript`, `vite`, `@vitejs/plugin-react`, `@cloudflare/vite-plugin`, `wrangler`, `@cloudflare/workers-types`, `tailwindcss`, `@tailwindcss/vite`, `vitest`, `tsx`, `@types/react`, `@types/react-dom`, `@types/node`. Scripts: `dev`, `build`, `preview`, `test`, `db:migrate`, `db:seed`, `user:create`.
- [ ] **Step 2: Write failing test** `test/markup.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseMarkup } from '../shared/markup';
describe('parseMarkup', () => {
  it('plain text', () => expect(parseMarkup('昨日')).toEqual([{ t: 'text', v: '昨日' }]));
  it('ruby', () => expect(parseMarkup('{腕|うで}が')).toEqual([{ t: 'ruby', base: '腕', rt: 'うで' }, { t: 'text', v: 'が' }]));
  it('underline containing ruby', () => expect(parseMarkup('<u>{腕|うで}</u>')).toEqual([{ t: 'u', children: [{ t: 'ruby', base: '腕', rt: 'うで' }] }]));
  it('bold and newline', () => expect(parseMarkup('**A**\nB')).toEqual([{ t: 'b', children: [{ t: 'text', v: 'A' }] }, { t: 'br' }, { t: 'text', v: 'B' }]));
  it('unclosed tokens stay literal', () => expect(parseMarkup('{abc <u>x')).toEqual([{ t: 'text', v: '{abc <u>x' }]));
});
```
- [ ] **Step 3:** Run `npx vitest run test/markup.test.ts` → FAIL (module missing).
- [ ] **Step 4:** Implement `shared/markup.ts` as recursive scanner: at each index check `\n` → br; `{` with matching `|` and `}` before next `{`/newline → ruby; `<u>` with matching `</u>` → recurse on inner; `**` with closing `**` → recurse; else accumulate text (merge adjacent text nodes).
- [ ] **Step 5:** Run tests → PASS. Commit `feat: scaffold, shared types, markup parser`.

### Task 2: Scoring

**Files:** Create `shared/scoring.ts`, `test/scoring.test.ts`

**Interfaces — Produces:**
```ts
export function gradeAttempt(exam: Exam, parts: Part[], answers: Answers): AttemptResult;
export function toPublicExam(exam: Exam): PublicExam;
export function summarizeExam(exam: Exam): ExamSummary;
export const PASS_TOTAL = 90, PASS_GROUP_MIN = 19;
```
Rules (from spec): only questions in selected parts count; `answer === null` → `ungraded`, excluded from total/weighted; chosen value must be integer 1..choiceCount else treated as unanswered; group scaled = `round(weighted/maxWeighted*60)` only if every part of the group is selected and group has no ungraded question; `language` needs vocab+grammar; total only when all 3 groups scaled; status pass iff total ≥ 90 and every group ≥ 19, fail otherwise, provisional when total null.

- [ ] **Step 1: Write failing tests** using a tiny fixture exam (2 vocab q weight 1, 1 grammar q weight 2, 1 reading q weight 3, 2 listening q with answer null):
```ts
it('scores selected parts only', ...)            // parts ['vocab'] → only vocab PartResult, language scaled null with reason 'Cần làm cả Từ vựng và Ngữ pháp', status provisional
it('full correct paper parts + ungraded listening → provisional', ...) // language 60, reading 60, listening null reason 'Chưa có đáp án', total null
it('pass/fail thresholds', ...)                  // exam where listening has answers: all correct → 180 pass; group 18 → fail
it('ignores unknown ids and out-of-range choices', ...) // answers {'zzz':1,'v1':9} → v1 unanswered, no crash
it('toPublicExam strips answers', ...)           // JSON.stringify(pub) does not contain '"answer"'
```
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS. **Step 5:** Commit `feat: attempt scoring`.

### Task 3: DB schema, D1 test shim, auth helpers

**Files:** Create `db/migrations/0001_init.sql`, `test/d1shim.ts`, `worker/env.ts`, `worker/auth.ts`, `test/auth.test.ts`

```sql
CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', created_at INTEGER NOT NULL);
CREATE TABLE sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
CREATE TABLE exams (id TEXT PRIMARY KEY, title TEXT NOT NULL, level TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, meta_json TEXT NOT NULL);
CREATE TABLE exam_mondai (exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE, ord INTEGER NOT NULL, data_json TEXT NOT NULL, PRIMARY KEY (exam_id, ord));
CREATE TABLE attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), exam_id TEXT NOT NULL, parts_json TEXT NOT NULL, answers_json TEXT NOT NULL, result_json TEXT NOT NULL, started_at INTEGER NOT NULL, submitted_at INTEGER NOT NULL);
CREATE INDEX attempts_user_exam ON attempts(user_id, exam_id, submitted_at DESC);
```
`meta_json` = Exam without `mondai`.

**Interfaces — Produces:**
```ts
export async function hashPassword(pw: string): Promise<string>; // 'pbkdf2$100000$<saltB64>$<hashB64>'
export async function verifyPassword(pw: string, stored: string): Promise<boolean>; // constant-time compare
export async function createSession(db: D1Database, userId: number): Promise<string>; // 30 days
export const requireUser: MiddlewareHandler<{ Bindings: Env; Variables: { user: { id: number; username: string; role: string } } }>;
// test/d1shim.ts
export function createTestD1(): D1Database; // node:sqlite in-memory, applies db/migrations/*.sql; supports prepare().bind().first/all/run and batch
```
- [ ] Steps: failing tests (`hash then verify true`, `wrong password false`, `two hashes of same pw differ`) → FAIL → implement → PASS → commit `feat: schema, auth helpers, d1 shim`.

### Task 4: API routes

**Files:** Create `worker/index.ts`, `worker/db.ts`, `worker/routes/{auth,exams,attempts,audio}.ts`, `test/api.test.ts`

Routes per spec. `worker/index.ts` exports `app` (for tests) and `default { fetch: app.fetch }`. Attempts POST body validated: `examId` string, `parts` ⊆ PARTS non-empty, `answers` object, `startedAt` number; 400 otherwise. Audio route streams R2 with Range → 206 + `content-range`.

- [ ] **Step 1: Failing tests** with `createTestD1()`, seed one user + fixture exam:
```ts
it('401 without session on /api/exams')
it('login wrong password → 401; right → 200 + set-cookie sid HttpOnly, no Secure on http')
it('GET /api/exams lists summary')
it('GET /api/exams/:id has no answer field')
it('POST /api/attempts grades & persists; GET /api/attempts/:id returns same result; other user gets 404')
it('POST /api/attempts with bad parts → 400')
it('logout invalidates session')
```
- [ ] Steps: run FAIL → implement → PASS → commit `feat: API routes`.

### Task 5: Scripts + wrangler/vite config + content seed pipeline

**Files:** Create `wrangler.jsonc`, `vite.config.ts`, `scripts/seed.ts`, `scripts/create-user.ts`, `scripts/prepare-audio.sh`

- `seed.ts`: đọc mọi `content/exams/*/exam.json`, kiểm tra id câu duy nhất & `answer` trong 1..choiceCount hoặc null, sinh `.wrangler/seed.sql` (`DELETE` + `INSERT` exams/exam_mondai), chạy `wrangler d1 execute n2db --local --file .wrangler/seed.sql` (`--remote` khi có cờ).
- `create-user.ts <username> <password> [--admin]`: hash bằng `worker/auth.ts`, chạy `wrangler d1 execute ... --command "INSERT OR REPLACE ..."`.
- `prepare-audio.sh <mp3> <key>`: `ffmpeg -map 0:a -c copy` (bỏ ảnh bìa lỗi) rồi `wrangler r2 object put n2-audio/<key> --file ... --local`.
- [ ] Verify: `npm run db:migrate && npm run db:seed && npm run user:create kource <pw> --admin`, `npm run dev`, `curl` login + `/api/exams` → JSON. Commit `chore: dev pipeline`.

### Task 6: Web shell, API client, login, exam list, setup, attempt store

**Files:** `web/index.html`, `web/main.tsx`, `web/App.tsx`, `web/api.ts`, `web/styles.css`, `web/components/{Layout,Markup}.tsx`, `web/pages/{LoginPage,ExamListPage,ExamSetupPage}.tsx`, `web/state/attemptStore.ts`, `test/attemptStore.test.ts`

**Interfaces — Produces:**
```ts
// web/state/attemptStore.ts
export interface ActiveAttempt { examId: string; parts: Part[]; mode: 'full' | 'custom'; answers: Answers; startedAt: number; stage: 'paper' | 'listening'; paperStartedAt: number; listeningStarted: boolean; audioPos: number }
export function loadAttempt(examId: string, storage?: Storage): ActiveAttempt | null;
export function saveAttempt(a: ActiveAttempt, storage?: Storage): void;
export function clearAttempt(examId: string, storage?: Storage): void;
export function newAttempt(examId: string, parts: Part[], mode: 'full' | 'custom', now: number): ActiveAttempt; // stage = paper unless parts == ['listening']
// web/api.ts
export const api: { me(); login(u,p); logout(); exams(): Promise<ExamSummary[]>; exam(id): Promise<PublicExam>; submit(body): Promise<{ id: number; result: AttemptResult }>; attempts(examId): Promise<AttemptListItem[]>; attempt(id): Promise<{ id; examId; parts; answers; result; startedAt; submittedAt }> }
```
- [ ] Failing test for attemptStore round-trip with an in-memory Storage and corrupted JSON → null. → implement → PASS.
- [ ] Pages: Login (form, lỗi), ExamList (thẻ đề + lịch sử gần nhất, nút tiếp tục nếu có lượt dở), ExamSetup (4 ô chọn phần với số câu, nút "Bắt đầu", nút "Làm full đề", cảnh báo nếu có lượt dở sẽ bị thay).
- [ ] Commit `feat: web shell, login, exam list, setup`.

### Task 7: Take-exam screen

**Files:** `web/pages/TakeExamPage.tsx`, `web/components/{QuestionCard,QuestionNav,Timer,ListeningPlayer,ConfirmDialog}.tsx`

- Paper stage: chips chọn phần; mondai render tuần tự; passage hai cột ≥ 900px (`lg:grid-cols-2`, passage sticky); QuestionCard nút lựa chọn lớn, chọn lại để đổi; QuestionNav dạng sheet đáy với lưới số.
- Timer: full → đếm ngược từ `paperStartedAt + timeLimits.languageReading`; hết giờ → chuyển listening (nếu có) hoặc tự nộp. Custom → đếm xuôi.
- ListeningPlayer: `<audio>` không controls; nút "Bắt đầu nghe"/"Tiếp tục nghe"; lưu `currentTime` mỗi 2s; thanh tiến trình chỉ xem; hết audio → dialog nộp bài.
- Nộp: ConfirmDialog hiện số câu chưa làm → `api.submit` → `clearAttempt` → điều hướng `/result/:id`. Lỗi mạng → giữ dữ liệu, báo lỗi.
- [ ] Kiểm thủ công trên viewport 390×844 và 1024×1366. Commit `feat: take exam screen`.

### Task 8: Result screen + history

**Files:** `web/pages/ResultPage.tsx`, update `ExamListPage.tsx`

- Tổng /180 lớn + nhãn Đỗ/Trượt/Tạm tính; 3 thẻ nhóm (vòng tiến trình, "—" + lý do); bảng phần (đúng/tổng); lưới review, chạm mở sheet hiển thị câu + lựa chọn (đã chọn/đáp án).
- [ ] Kiểm thủ công kịch bản Review Focus 1, 2, 3, 5. Commit `feat: result screen`.

### Task 9: Nhập đề 2023-12

**Files:** `content/exams/2023-12/exam.json`, `web/public/exam-assets/2023-12/*.png`

- Render PDF 200dpi; gõ lại 問題1–14 (câu 1–71) với furigana, gạch chân, đoạn văn; crop ảnh tờ thông tin 問題14. Tự giải đáp án, `answerVerified: false`.
- Listening: xác định số câu mỗi 問題 từ audio; `stem: ''`, `choices: []`, `choiceCount` 4 (問題4: 3), `answer: null`.
- [ ] `npm run db:seed` thành công; mở đề trên web, đối chiếu ngẫu nhiên với PDF. Commit `content: exam 2023-12`.

### Task 10: README + final verification

- README: cài đặt, chạy local, tạo user, thêm đề mới, mở từ điện thoại qua LAN (`npm run dev -- --host`).
- [ ] `npm test` xanh, `npm run build` thành công, chạy full flow trên trình duyệt. Commit.
