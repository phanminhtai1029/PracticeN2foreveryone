# N2 Practice Web — Design

Ngày: 2026-10-04 · Trạng thái: approved

## Mục tiêu

Thay thế study4 để luyện đề JLPT N2 cá nhân. v1 chạy local; kiến trúc sẵn sàng deploy Cloudflare (Workers + D1 + R2) ở giai đoạn sau (không nằm trong phạm vi v1).

Tiêu chí thành công v1:
- Đăng nhập bằng tài khoản admin tạo sẵn, đăng xuất.
- Chọn đề → chọn phần (Từ vựng / Ngữ pháp / Đọc hiểu / Nghe hiểu, tuỳ ý kết hợp) hoặc làm full đề.
- Làm bài thoải mái trên điện thoại và iPad (mobile-first, chỉ dark mode).
- Phần nghe: audio phát một lần, không tua/pause, vừa nghe vừa chọn.
- Màn hình kết quả: số câu đúng từng phần, điểm quy đổi ước lượng, tổng /180, xem lại từng câu.
- Đề 2023-12 (mã 2023-2) được nhập đầy đủ câu 1–71; phần nghe có phiếu trả lời, đáp án nghe để trống.

Ngoài phạm vi v1: deploy, giải thích đáp án, lời thoại phần nghe, đáp án phần nghe, trang quản trị, đăng ký tài khoản.

## Kiến trúc

- `web/`: React + Vite + TypeScript + Tailwind CSS. SPA, react-router.
- `worker/`: Hono API chạy trên Cloudflare Workers (`wrangler dev` khi local). Worker phục vụ luôn static assets của `web/dist` (SPA fallback).
- D1 (SQLite) cho dữ liệu; R2 cho file audio (mp3 47MB vượt giới hạn 25MB/file của static assets). Ảnh nhỏ của đề nằm trong static assets.
- `content/exams/<examId>/exam.json`: nguồn gốc nội dung đề, versioned trong git. `scripts/seed` sinh SQL và nạp vào D1.
- `db/migrations/`: schema SQL (wrangler d1 migrations).
- `scripts/`: `seed` (JSON → D1), `create-user`, `upload-audio` (mp3 → R2 local).

Local: `wrangler dev` giả lập D1/R2 trên máy (`.wrangler/state`), không cần tài khoản Cloudflare. Vite dev server proxy `/api` sang worker.

## Dữ liệu

```sql
users(id, username UNIQUE, password_hash, role 'admin'|'user', created_at)
sessions(token PK, user_id, expires_at)
exams(id PK  -- '2023-12', title, level, sort_order, meta_json)
exam_mondai(exam_id, ord, data_json)   -- mỗi 問題 một dòng (D1 giới hạn 100KB/statement)
attempts(id, user_id, exam_id, parts_json, answers_json, result_json, started_at, submitted_at)
```

Nội dung đề lưu dạng JSON: metadata trong `exams.meta_json`, mỗi 問題 một dòng `exam_mondai.data_json` (đề đọc một lần, không truy vấn theo câu); khi phục vụ client, server loại bỏ trường `answer`. Cách này đơn giản hơn chia bảng mondai/questions và vẫn giữ đề trong database.

### Định dạng exam.json

```jsonc
{
  "id": "2023-12", "title": "JLPT N2 — Tháng 12/2023", "level": "N2",
  "audio": { "key": "2023-12/listening.mp3", "durationSec": 2936 },
  "timeLimits": { "languageReading": 6300 },     // giây (105 phút)
  "mondai": [
    {
      "id": "m1", "part": "vocab" | "grammar" | "reading" | "listening",
      "number": 1, "instruction": "＿＿の言葉の読み方として…",
      "weight": 1,                     // điểm mỗi câu
      "passage": "…",                  // tuỳ chọn (đọc hiểu, 問題9)
      "image": "/exam-assets/2023-12/q14.png", // tuỳ chọn
      "questions": [
        { "no": 1, "stem": "昨日から<u>{腕|うで}</u>が痛くて困っている。",
          "choices": ["こし","うで","かた","ひざ"], "answer": 2, "answerVerified": false }
      ]
    }
  ]
}
```
- Câu nghe không có nội dung in: `stem` rỗng, `choices` chỉ là số lượng (`"choiceCount": 3|4`), `answer: null`.
- Đoạn đọc dùng chung cho nhiều mondai con (vd 問題11 có nhiều bài): mỗi bài là một mondai riêng có cùng `number`.

### Markup văn bản
- `{漢字|かんじ}` → `<ruby>漢字<rt>かんじ</rt></ruby>`
- `<u>…</u>` → gạch chân; `\n` → xuống dòng; `**…**` → đậm.
- Parser riêng tạo React nodes, không dùng `dangerouslySetInnerHTML`.

## Phân phần

| Phần | Mondai | Câu |
|---|---|---|
| vocab (文字・語彙) | 問題1–6 | 1–30 |
| grammar (文法) | 問題7–9 | 31–52 |
| reading (読解) | 問題10–14 | 53–71 |
| listening (聴解) | 問題1–5 | đánh số riêng, xác định từ audio |

## API

- `POST /api/auth/login {username,password}` → set cookie `sid` (HttpOnly, SameSite=Lax), 30 ngày.
- `POST /api/auth/logout`, `GET /api/auth/me`.
- `GET /api/exams` → danh sách đề + số câu theo phần.
- `GET /api/exams/:id` → đề không có đáp án.
- `GET /api/audio/:key` → stream từ R2, hỗ trợ Range header (cần đăng nhập).
- `POST /api/attempts {examId, parts, answers, startedAt}` → chấm, lưu, trả kết quả.
- `GET /api/attempts?examId=` → lịch sử; `GET /api/attempts/:id` → kết quả + đáp án để xem lại.

Mọi route trừ login yêu cầu session. Mật khẩu: PBKDF2-SHA256 qua WebCrypto, salt ngẫu nhiên.

## Chấm điểm

- Raw: số câu đúng / tổng mỗi phần (vocab, grammar, reading, listening).
- Điểm có trọng số: tổng `weight` các câu đúng.
- Quy đổi (ước lượng) theo nhóm JLPT: 言語知識 = vocab+grammar, 読解, 聴解. `scaled = round(weighted / maxWeighted × 60)`.
- Nhóm chỉ được quy đổi khi người dùng làm đủ các phần thuộc nhóm và mọi câu trong nhóm có đáp án; ngược lại hiển thị "—" kèm lý do.
- Đỗ/Trượt chỉ khi cả 3 nhóm có điểm: tổng ≥ 90 và mỗi nhóm ≥ 19. Nếu thiếu → "Tạm tính".
- Câu `answer: null` không tính vào raw lẫn weighted, ghi "chưa có đáp án".

Trọng số mặc định: vocab 問題1–5 = 1, 問題6 = 2; grammar 問題7 = 1, 問題8–9 = 2; reading 問題10 = 3, 問題11 = 3, 問題12 = 3, 問題13 = 3, 問題14 = 3; listening 問題1–2 = 2, 問題3–5 = 2 (chỉnh trong JSON).

## UI

Mobile-first, dark only. Font tiếng Nhật Noto Sans JP; UI tiếng Việt. Màu nền tối trung tính, một màu nhấn, cỡ chữ đề ≥ 17px, line-height thoáng cho furigana. Vùng chạm ≥ 44px.

Màn hình:
1. **Login**.
2. **Đề thi**: thẻ từng đề, lịch sử lượt làm (ngày, điểm).
3. **Chọn phần**: 4 ô chọn + nút "Làm full đề"; hiện số câu/thời gian.
4. **Làm bài**: header dính (tên phần, đồng hồ, nút bảng câu hỏi). Danh sách mondai cuộn dọc; mỗi câu là thẻ với 4 lựa chọn dạng nút lớn. Đọc hiểu: ≥ 900px chia hai cột (đoạn văn dính bên trái, câu hỏi bên phải). Bảng câu hỏi: lưới số, tô câu đã làm, chạm để nhảy tới. Nút "Nộp bài" có xác nhận (hiện số câu chưa làm).
   - Full đề: 言語知識・読解 đếm ngược 105 phút, hết giờ tự chuyển sang 聴解; sau đó nghe.
   - Làm lẻ: đồng hồ đếm xuôi.
   - Nghe: nút "Bắt đầu nghe" → audio phát một lần, không có điều khiển tua/pause, thanh tiến trình chỉ để xem. Phiếu trả lời theo mondai. Audio hết → nhắc nộp bài.
5. **Kết quả**: điểm theo nhóm (vòng tiến trình), tổng /180, Đỗ/Trượt/Tạm tính, bảng từng phần, lưới xem lại câu (đúng/sai/chưa làm), chạm để xem câu + đáp án.

Trạng thái lượt làm (phần, câu trả lời, thời điểm bắt đầu, vị trí audio) lưu localStorage theo `examId`; reload thì khôi phục, audio phát tiếp từ vị trí đã lưu.

## Lỗi

- 401 → về trang login. Lỗi mạng khi nộp → giữ nguyên localStorage, cho thử lại.
- Audio lỗi tải → thông báo và nút thử lại (không tính là đã nghe).

## Kiểm thử

Vitest: parser markup, chấm điểm (kể cả câu thiếu đáp án, làm lẻ phần), hash mật khẩu, API qua Hono `app.request` với D1 giả lập (đăng nhập, không lộ đáp án, nộp bài). Kiểm tra thủ công trên trình duyệt ở viewport điện thoại và iPad.

## Bản quyền

Nội dung đề thuộc Japan Foundation/JEES. Repo nên để private; web luôn yêu cầu đăng nhập. File mp3 không commit vào git.
