# N2 Luyện đề

Web luyện đề JLPT N2 (thay study4): đăng nhập, chọn đề, luyện theo phần (Từ vựng / Ngữ pháp / Đọc hiểu / Nghe hiểu) hoặc làm full đề, xem kết quả quy đổi điểm. Mobile-first, chỉ dark mode.

Stack: React + Vite · Hono trên Cloudflare Workers · D1 (SQLite) · R2 (audio). Khi chạy local, `@cloudflare/vite-plugin` giả lập Workers/D1/R2 ngay trên máy (dữ liệu nằm trong `.wrangler/state`) — không cần tài khoản Cloudflare.

## Chạy lần đầu

```bash
npm install
npm run db:migrate                     # tạo bảng trong D1 local
npm run db:seed                        # nạp đề từ content/exams/*/exam.json
npm run user:create -- <tên> <mật-khẩu> --admin
npm run audio:upload -- "Exam/Nghe N2 T12-2023 Bản chuẩn YuukiBui.mp3" 2023-12/listening.mp3
npm run dev                            # http://localhost:5173
```

Mở từ điện thoại/iPad cùng mạng Wi-Fi: `npm run dev -- --host`, rồi vào `http://<IP-máy-tính>:5173`.

## Lệnh thường dùng

| Lệnh | Việc |
|---|---|
| `npm run dev` | chạy web + API (hot reload) |
| `npm test` | chạy test (Vitest) |
| `npm run typecheck` | kiểm tra TypeScript |
| `npm run db:seed` | nạp lại đề sau khi sửa `exam.json` (ghi đè đề cùng id) |
| `npm run user:create -- <tên> <mk>` | tạo user / đổi mật khẩu (thêm `--admin` cho admin) |

## Production (Cloudflare)

Đang chạy tại **https://n2.worktree.dpdns.org** (Worker `n2-practice`, D1 `n2db`, R2 `n2-audio`). Cần `npx wrangler login` một lần.

```bash
npm run deploy                                          # build + deploy code
npx wrangler d1 migrations apply n2db --remote          # khi có migration mới
npm run db:seed -- --remote                             # khi sửa/thêm đề
npm run user:create -- <tên> <mk> --remote              # tạo user / đổi mật khẩu
npm run audio:upload -- <file.mp3> <id>/listening.mp3 --remote
```

Đăng nhập sai 10 lần trong 15 phút (theo username hoặc IP) bị khóa 15 phút. Mở khóa ngay:
`npx wrangler d1 execute n2db --remote --command "DELETE FROM login_failures"`.

## Thêm đề mới

1. Tạo `content/exams/<id>/exam.json` (xem định dạng trong `docs/superpowers/specs/2026-10-04-n2-practice-web-design.md`, hoặc copy `2023-12`).
   - Furigana: `{漢字|かんじ}` · gạch chân: `<u>…</u>` · đậm: `**…**` · xuống dòng: `\n`.
   - Mỗi câu có `id` duy nhất trong đề, `answer` là số 1–4 (hoặc `null` nếu chưa có).
   - Ảnh của đề đặt trong `web/public/exam-assets/<id>/`.
2. `npm run db:seed`
3. Nếu có file nghe: `npm run audio:upload -- <file.mp3> <id>/listening.mp3` và khai báo `"audio": { "key": "<id>/listening.mp3", "durationSec": … }`.

Đáp án đề 2023-12 do Claude tự giải (`answerVerified: false`) — nếu thấy sai, sửa `answer` trong `exam.json` rồi `npm run db:seed`.

## Cấu trúc

```
shared/    type + logic thuần dùng chung (markup furigana, chấm điểm)
worker/    API Hono (auth, đề, nộp bài, stream audio)
web/       giao diện React
db/        migration SQL cho D1
content/   nội dung đề (nguồn gốc, versioned)
scripts/   seed, tạo user, upload audio
```

## Bản quyền

Nội dung đề thuộc Japan Foundation / JEES. Giữ repo **private**; web luôn yêu cầu đăng nhập. File PDF/mp3 trong `Exam/` không được commit.
