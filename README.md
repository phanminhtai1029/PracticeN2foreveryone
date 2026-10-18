# 練習帳 · Luyện tập tiếng Nhật

Web luyện đề JLPT N2 và N4 (thay study4): đăng nhập, chọn đề, luyện theo phần (Từ vựng / Ngữ pháp / Đọc hiểu / Nghe hiểu) hoặc làm full đề, xem kết quả quy đổi điểm. Mobile-first, giao diện sáng kiểu giấy (chưa có dark mode).

Stack: React + Vite · Hono trên Cloudflare Workers · D1 (SQLite) · R2 (audio). Khi chạy local, `@cloudflare/vite-plugin` giả lập Workers/D1/R2 ngay trên máy (dữ liệu nằm trong `.wrangler/state`) — không cần tài khoản Cloudflare.

## Chạy lần đầu

```bash
npm install
npm run db:migrate                     # tạo bảng trong D1 local
npm run db:seed                        # nạp đề từ content/exams/*/exam.json
npm run user:create -- <tên> <mật-khẩu> --admin
npm run audio:upload -- "Exam/Nghe N2 T12-2023 Bản chuẩn YuukiBui.mp3" 2023-12/listening.mp3
npm run assets:upload -- 2023-12       # ảnh của đề → R2
npm run dev                            # http://localhost:5173
```

Mở từ điện thoại/iPad cùng mạng Wi-Fi: `npm run dev -- --host`, rồi vào `http://<IP-máy-tính>:5173`.

## Lệnh thường dùng

| Lệnh | Việc |
|---|---|
| `npm run dev` | chạy web + API (hot reload) |
| `npm test` | chạy test (Vitest) |
| `npm run typecheck` | kiểm tra TypeScript |
| `npm run db:seed` | nạp lại đề và ghi chú sau khi sửa `exam.json` hoặc `notes/*.json` (ghi đè đề cùng id) |
| `npm run user:create -- <tên> <mk>` | tạo user / đổi mật khẩu (thêm `--admin` cho admin) |

## Production (Cloudflare)

Đang chạy tại **https://n2.worktree.dpdns.org** (Worker `n2-practice`, D1 `n2db`, R2 `n2-audio`).

**CI/CD:** push lên `main` → GitHub Actions (`.github/workflows/deploy.yml`) chạy typecheck + test, áp migration D1 remote, rồi deploy. Cần 2 secret của repo: `CLOUDFLARE_API_TOKEN` và `CLOUDFLARE_ACCOUNT_ID`. Nội dung đề **không** nằm trong repo nên CI chỉ deploy code — đề, ảnh, audio vẫn nạp từ máy (cần `npx wrangler login` một lần):

```bash
npm run deploy                                          # deploy tay (khi không qua CI)
npm run db:seed -- --remote                             # khi sửa/thêm đề
npm run user:create -- <tên> <mk> --remote              # tạo user / đổi mật khẩu
npm run audio:upload -- <file.mp3> <id>/listening.mp3 --remote
npm run assets:upload -- <id> --remote                  # ảnh của đề
```

Đăng nhập sai 10 lần trong 15 phút (theo username hoặc IP) bị khóa 15 phút. Mở khóa ngay:
`npx wrangler d1 execute n2db --remote --command "DELETE FROM login_failures"`.

## Thêm đề mới

1. Tạo `content/exams/<id>/exam.json` (xem định dạng trong `docs/superpowers/specs/2026-10-04-n2-practice-web-design.md`, hoặc copy `2023-12`).
   - Furigana: `{漢字|かんじ}` · gạch chân: `<u>…</u>` · đậm: `**…**` · xuống dòng: `\n`.
   - Mỗi câu có `id` duy nhất trong đề, `answer` là số 1–4 (hoặc `null` nếu chưa có).
   - Ảnh của đề đặt trong `content/exams/<id>/assets/`, tham chiếu bằng `"image": "/exam-assets/<id>/<file>"`, rồi `npm run assets:upload -- <id>` (Worker phục vụ ảnh từ R2, cần đăng nhập).
2. `npm run db:seed`
3. Nếu có file nghe: `npm run audio:upload -- <file.mp3> <id>/listening.mp3` và khai báo `"audio": { "key": "<id>/listening.mp3", "durationSec": … }`.

**Chấm điểm theo cấp độ** (`sectionsOf` trong `shared/scoring.ts`): N1–N3 có ba phần 60 điểm (言語知識, 読解, 聴解; sàn 19 mỗi phần). N4–N5 có hai phần: 言語知識・読解 120 điểm (sàn 38) và 聴解 60 điểm (sàn 19). Mốc đỗ tổng: N1 100, N2 90, N3 95, N4 90, N5 80.

## Lời giải và sổ từ của đề

Sau khi nộp bài, trang kết quả có thêm tab **解説 Giải thích** (bản dịch, lý do từng đáp án đúng/sai) và **語彙・文法 Từ và ngữ pháp**. Sổ từ cũng mở được trước khi làm, từ trang chọn phần thi.

Nội dung nằm trong `content/exams/<id>/notes/*.json` (mỗi file là một mảng ghi chú theo 問題, chia file tuỳ ý), kiểu `MondaiNotes` trong `shared/types.ts`. Quy tắc soạn: `content/exams/2023-12/notes/NOTES.md`.

```bash
npm run db:seed -- --check     # chỉ kiểm tra đề và ghi chú, không ghi vào D1
npm run db:seed                # nạp đề kèm ghi chú (thêm --remote cho production)
```

**Xuất sang Anki:** trong sổ từ có nút "Xuất sang Anki", chọn cả đề hoặc một phần, loại thẻ (từ vựng, ngữ pháp) và cấp độ rồi tải file `.apkg`. File được tạo ngay trong trình duyệt (`shared/anki.ts` gom thẻ, `shared/apkg.ts` ghi file bằng sql.js). Thẻ vào bộ `練習帳::<tên đề>::語彙` và `::文法`; mỗi từ chỉ có một thẻ dù xuất hiện ở nhiều bài hay nhiều đề, nên nhập lại không sinh thẻ trùng.

Câu nghe có thêm lời thoại (`script`, `scriptVi` trong ghi chú) hiện kèm bản dịch từng dòng; script ghi furigana bằng markup `{漢字|かな}` như đề, người xem bật/tắt được. Mỗi câu nghe có nút nghe lại đúng đoạn audio của câu đó (từ `startSec` của câu tới mốc kế tiếp), kèm thanh điều khiển bám cuối cột để vừa nghe vừa dò script: lùi/tới 5 giây, tua, nghe chậm 0.85× và 0.7×. 問題 nào chưa có ghi chú thì hai tab báo "chưa có lời giải". Cấp độ N5–N1 của từng từ là ước lượng.

Đáp án đề 2023-12 do Claude tự giải (`answerVerified: false`; phần nghe giải từ script của giáo viên, lưu ở `content/exams/2023-12/listening/script.json`) — nếu thấy sai, sửa `answer` trong `exam.json` rồi `npm run db:seed`.

## Cấu trúc

```
shared/    type + logic thuần dùng chung (markup furigana, chấm điểm)
worker/    API Hono (auth, đề, nộp bài, stream audio)
web/       giao diện React
db/        migration SQL cho D1
content/   nội dung đề — chỉ có trên máy, không commit (xem Bản quyền)
scripts/   seed, tạo user, upload audio/ảnh
```

## Bản quyền

Nội dung đề thuộc Japan Foundation / JEES nên **không** có trong repo public này: `content/` (đề, đáp án, transcript, ảnh) và `Exam/` (PDF/mp3) bị gitignore, chỉ nằm trên máy và trong D1/R2. Web luôn yêu cầu đăng nhập, kể cả với ảnh và audio.
