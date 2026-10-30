# Mầm Xanh

Dashboard quản lý học sinh của Khoa Tin học và Ngoại ngữ, Phân hiệu 1 Trường Thiếu sinh quân miền Trung. Next.js 16, React 19, Ant Design và Recharts.

## Dữ liệu và đăng nhập

**Toàn bộ dữ liệu nghiệp vụ và tài khoản nằm trên Supabase.** Supabase Auth xác thực mật khẩu, Supabase Postgres lưu hồ sơ và đánh giá. Không dùng SQLite hay localStorage để lưu dữ liệu đang hoạt động. Trình duyệt chỉ giữ cookie phiên HttpOnly và trạng thái giao diện.

Các bảng `school_accounts`, `school_classes`, `school_students`, `school_pending_students`, `school_assessments`, `school_talents`, `school_lessons`, `school_settings`, `school_meta`, `school_talent_tags`, `school_student_tags`, `school_academic_tags` đều bật RLS. Dữ liệu chỉ đọc được bởi tài khoản được cấp quyền. Ghi dữ liệu qua RPC có kiểm tra vai trò, giao dịch nguyên tử và số phiên bản để tránh ghi đè khi hai giáo viên cùng sửa. API kiểm tra quyền thêm một lần trước khi gọi RPC.

- Admin: quản lý lớp, học sinh, hai môn, cấu hình và sao lưu; CRUD tài khoản và phân quyền, gồm tạo thêm admin; không tự khóa/hạ quyền chính mình.
- Phó khoa: quản lý học sinh, lớp, giảng dạy và đánh giá cả Tin học lẫn Tiếng Anh.
- Giáo viên: xem hồ sơ, đánh giá môn được phân công, ghi tiết dạy của môn mình; gắn thẻ dùng chung cho học sinh, tạo/sửa thẻ và đánh giá năng khiếu của mình.

Đăng nhập bằng email trường có dạng `ten@ph1.tsqmt.edu.vn`. Danh sách tài khoản, vai trò, môn phụ trách và trạng thái hoạt động được quản lý trực tiếp trong bảng `school_accounts` trên Supabase. Email được tạo từ tên tài khoản; mật khẩu được Supabase Auth lưu dưới dạng bảo mật. Không dùng JSON hoặc biến môi trường để làm kho tài khoản.

## Giao diện đã tinh gọn

1. **Tổng quan quản lý:** số học sinh, tiết/bài, tiến độ đánh giá và năng khiếu; biểu đồ Recharts, bảng dân tộc mở rộng và cảnh báo hồ sơ còn thiếu/chưa xác minh để đối chiếu.
2. **Quản lý lớp và học sinh:** cùng một màn hình với hai tab. Bảng lớp phẳng; CRUD lớp/học sinh, import DOCX/XLSX/CSV có xem trước, tìm kiếm, lọc dân tộc và giới tính; thống kê Nam/Nữ/Chưa cập nhật.
3. **Quản lý học lực:** bảng đánh giá đầu vào, hiện tại, tương tác và nhận xét theo môn. Đầu vào lấy từ kết quả giáo dục nguồn, giữ mã gốc và hiển thị tên đầy đủ. Danh mục thẻ học lực cho tạo/sửa tên, màu và phạm vi đầu vào/hiện tại; có bộ lọc theo thẻ. Sửa tên giữ nguyên đánh giá; thẻ đang sử dụng được bảo vệ khỏi xóa. Các mã đồng nghĩa được gộp khi hiển thị, mã chưa xác minh không tự quy đổi.
4. **Quản lý năng khiếu:** tạo/sửa/xóa thẻ màu theo lĩnh vực, gắn nhiều thẻ cho học sinh ngay trong bảng, lọc theo thẻ; ghi mức độ, nhận xét và hướng bồi dưỡng riêng. Xóa thẻ chỉ gỡ nhãn, giữ các nhận xét.
5. **Quản lý giảng dạy:** CRUD lượt dạy, cộng số tiết và tính bài theo lớp/môn/tên bài.
6. **Báo cáo và thống kê:** lọc lớp, dân tộc, học sinh và kỳ giảng dạy; xem trước, xuất Word hoặc Excel kèm biểu đồ. Khoảng ngày chỉ giới hạn tiết/bài, các đánh giá là hiện trạng lúc xuất.

Khu vực **Quản trị hệ thống** chỉ dành cho admin: tài khoản/phân quyền, năm học, sao lưu JSON và các hồ sơ cũ chờ đối chiếu. Đã bỏ menu học sinh trùng với lớp, thẻ trang trí, cấu hình tên giáo viên dùng chung, danh mục môn không cần thiết và nút CSV lặp trên báo cáo. CSV vẫn được hỗ trợ khi import.

Báo cáo xem trước, Word và Excel dùng Times New Roman, cỡ nhỏ nhất 14, kể cả chữ trong bảng, nhãn biểu đồ và chân trang.

Excel có 5 sheet: Tổng quan, Học sinh, Năng khiếu, Giảng dạy, Trích ngang; có bộ lọc, hàng tiêu đề cố định và màu phân biệt dòng. Báo cáo Word có tiêu đề, bảng thống kê, biểu đồ học lực theo tên đầy đủ, năng khiếu, nhật ký giảng dạy và số trang; có tùy chọn kèm hồ sơ chi tiết.

## Chạy local

```bash
npm install
npm run dev
```

Tạo `.env.local` theo `.env.example`. Server secret key cần cho quản lý tài khoản và toàn bộ luồng bảng điểm, phiên chụp, xử lý ảnh. Các biến cấu hình cho ứng dụng:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
SUPABASE_SECRET_KEY=your_server_secret_key
```

Tài khoản được tạo và quản lý tại Quản trị hệ thống → Tài khoản và phân quyền. Mật khẩu ban đầu cần ít nhất 8 ký tự, có chữ và số. `.env.local` và thư mục `data/` bị Git bỏ qua; không đưa secret key hay mật khẩu lên GitHub.

## Deploy Vercel

1. Import repository GitHub, chọn framework Next.js.
2. Thêm `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` và `SUPABASE_SECRET_KEY` vào Environment Variables cho Production và Preview cần sử dụng.
3. Giữ lệnh build `npm run build` và output mặc định của Next.js, rồi Deploy.

Dự án Supabase hiện tại đã được tạo bảng, cấp tài khoản và nhập dữ liệu, gồm migration bảng điểm `202610300006` đến `202610300009`. Vercel sử dụng trực tiếp kho dữ liệu đó; **không cần chạy lại seed hoặc đưa mật khẩu tài khoản lên GitHub**. Serverless không cần ổ đĩa ghi dữ liệu. `SUPABASE_SECRET_KEY` chỉ dùng phía server; không dùng biến NEXT_PUBLIC cho khóa này.

## Bảng điểm và chấm phiếu từ điện thoại

Vào **Quản lý điểm**, chọn lớp, môn, năm học và học kỳ. Tạo bài kiểm tra, chọn loại điểm, trọng số, số câu và thang điểm; nhập đủ đáp án cho từng mã đề bốn chữ số. Có thể dán nhanh đáp án theo hướng dẫn trong hộp thoại. Mẫu hỗ trợ tối đa 40 câu chọn A–D, 8 câu đúng/sai (mỗi câu bốn ý) và 6 câu trả lời ngắn dạng số (mỗi đáp án bốn ô, tính cả dấu âm/dấu phẩy). Điểm đúng/sai có thể tính từng ý hoặc theo số ý đúng trong câu. Cho phép cấu hình sai số số học và tổng điểm tới 100.

Trong **Bài làm → Danh sách dự thi**, kiểm tra số báo danh tám chữ số, in phiếu cá nhân hoặc phiếu trống. Phiếu in từ phần mềm có vị trí ô tô và dấu căn chỉnh tương thích bộ nhận dạng; mẫu khác cần kiểm tra riêng. Mẫu được xây dựng theo ảnh phiếu đã cung cấp, không nhận dạng mọi loại phiếu tùy ý.

**Nhận bài bằng mã QR** tạo phiên 30 phút, tối đa 100 ảnh. Điện thoại quét mã, chụp/chọn ảnh, xem trước rồi gửi lên Supabase Storage riêng tư. Máy tính chọn **Xử lý ảnh chờ**, mở **Kiểm tra bài**, đối chiếu ảnh với học sinh, mã đề và các đáp án, tích xác nhận rồi **Duyệt và ghi điểm**. Chỉ thao tác duyệt mới ghi điểm; có cảnh báo khi thay thế điểm cũ. Ảnh mờ/tô nhiều ô không được tự đoán đáp án; giáo viên có thể căn chỉnh bốn góc, nhập lại đáp án từ ảnh hoặc chụp lại. Nhận dạng hiện đã kiểm thử bằng ảnh phiếu trống gốc và phiếu tô giả lập, xoay/nghiêng; cần thử thêm bài tô thật và điều kiện chụp thực tế trước khi dùng đại trà.

Giáo viên chỉ quản lý điểm môn được phân công; admin và phó khoa quản lý cả hai môn. API tính lại điểm theo đáp án trên server, chống ghi đè phiên bản cũ và lưu lịch sử thêm/sửa/xóa. Điểm nhập trực tiếp cũng được lưu lịch sử. Lưu trữ bài kiểm tra không làm mất điểm đã duyệt; khi đã có lịch sử điểm, đáp án và thang điểm được khóa để bảo toàn kết quả.

Điểm tổng hợp là trung bình có trọng số của những bài đã có điểm, quy đổi về thang 10; không coi ô trống là 0. Đây là tổng hợp nội bộ theo trọng số giáo viên cấu hình, không tự suy ra kết quả học lực pháp định. Xuất Excel theo bộ lọc học sinh đang chọn, gồm bảng điểm, chi tiết đã duyệt và cấu hình thang điểm; Times New Roman cỡ tối thiểu 14.

Ảnh được đánh dấu hết hạn sau 7 ngày; dọn ảnh giữ nguyên điểm, đáp án đã duyệt và lịch sử. Có nút dọn ảnh trong bảng điểm và tự dọn khi mở phiên mới. `vercel.json` đặt lịch dọn mỗi ngày lúc 03:00 giờ Việt Nam; thêm `CRON_SECRET` bằng chuỗi ngẫu nhiên riêng vào Vercel để bật xác thực cron. Mỗi lượt cron dọn tối đa 1.000 ảnh hết hạn. Không cần đưa `CRON_SECRET` vào biến công khai.

`APP_PUBLIC_URL` không bắt buộc trên Vercel: mặc định QR dùng tên miền đang truy cập. Nếu đặt, dùng tên miền HTTPS thực tế. Khi thử tại máy, chạy `npm run dev -- --hostname 0.0.0.0`, đặt biến này bằng địa chỉ IP LAN của máy và cho điện thoại cùng Wi-Fi. **Không đưa địa chỉ LAN của máy lên cấu hình Vercel.** Đường dẫn QR chỉ có quyền gửi ảnh trong thời gian phiên; không xem hồ sơ, đáp án hoặc điểm. Không chia sẻ mã ra ngoài nhóm chụp bài.

Các bảng `school_exams`, `school_exam_candidates`, `school_capture_sessions`, `school_paper_scans`, `school_grades`, `school_grade_history` đều bật RLS; mutation RPC chỉ server role được gọi sau kiểm tra người dùng. Liên kết học sinh/lớp dùng ID ổn định và bản chụp tên để không mất điểm khi cập nhật hồ sơ cũ. Bản sao lưu JSON tại Quản trị hệ thống hiện chỉ gồm dữ liệu hồ sơ/đánh giá cũ, **không gồm bảng điểm hoặc ảnh bài làm**; sao lưu các bảng mới và Storage bằng công cụ Supabase riêng khi cần khôi phục toàn hệ thống.

## Khởi tạo một dự án Supabase mới

1. Chạy các migration trong `supabase/migrations/` theo tên tăng dần bằng SQL Editor.
2. Tạo người dùng Auth đầu tiên trong Supabase Dashboard với email `admin@ph1.tsqmt.edu.vn` và mật khẩu riêng.
3. Thêm bản ghi `school_accounts` có `id` trùng UUID của Auth user, `username` là `admin`, `name` là tên quản trị, `role` là `admin`, `subjects` gồm Tin học và Tiếng Anh. Cột email được tự sinh.
4. Đăng nhập ứng dụng rồi tạo các tài khoản còn lại qua bảng Quản lý tài khoản; khôi phục dữ liệu học sinh từ bản sao lưu riêng tư nếu cần.

Dữ liệu học sinh và mật khẩu không có trong repository. Các kiểm thử đơn vị dùng dữ liệu giả lập. Mã username trong bảng là định danh ổn định để liên kết đánh giá; email trường là tên đăng nhập hiển thị.

## Kiểm tra

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

E2E đọc tài khoản thử nghiệm từ bảng `school_accounts`, dùng server key và `E2E_ACCOUNT_PASSWORD` trên máy kiểm thử. Biến này chỉ phục vụ kiểm thử, không cần trên Vercel:

```bash
npx playwright install chromium
npm run test:e2e
```

E2E kiểm tra đăng nhập/đăng xuất, cookie HttpOnly, chặn người chưa đăng nhập, quyền API và RPC, chống ghi đè đồng thời, đánh giá học lực/năng khiếu, CRUD thẻ học lực/năng khiếu và gắn thẻ, trao đổi dữ liệu giữa tài khoản, xuất Word/Excel có biểu đồ và giao diện mobile. Các thay đổi thử nghiệm chỉ áp dụng lớp/học sinh tạm với ID `E2E-SCRATCH-*`, `ACADEMIC-E2E-*` hoặc `GRADING-E2E-*`, được dọn sau kiểm tra.

Tài liệu kỹ thuật: [Supabase Auth](https://supabase.com/docs/guides/auth), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Recharts](https://recharts.github.io/en-US/guide/sizes/), [docx](https://docx.js.org/), [ExcelJS](https://github.com/exceljs/exceljs).
