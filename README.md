# Mầm Xanh

Dashboard quản lý học sinh của Khoa Tin học và Ngoại ngữ, Phân hiệu 1 Trường Thiếu sinh quân miền Trung. Next.js 16, React 19, Ant Design và Recharts.

## Dữ liệu và đăng nhập

**Toàn bộ dữ liệu nghiệp vụ và tài khoản nằm trên Supabase.** Supabase Auth xác thực mật khẩu, Supabase Postgres lưu hồ sơ và đánh giá. Không dùng SQLite hay localStorage để lưu dữ liệu đang hoạt động. Trình duyệt chỉ giữ cookie phiên HttpOnly và trạng thái giao diện.

Các bảng `school_profiles`, `school_classes`, `school_students`, `school_pending_students`, `school_assessments`, `school_talents`, `school_lessons`, `school_settings`, `school_meta`, `school_talent_tags`, `school_student_tags` đều bật RLS. Dữ liệu chỉ đọc được bởi tài khoản được cấp quyền. Ghi dữ liệu qua RPC có kiểm tra vai trò, giao dịch nguyên tử và số phiên bản để tránh ghi đè khi hai giáo viên cùng sửa. API kiểm tra quyền thêm một lần trước khi gọi RPC.

- Admin: quản lý lớp, học sinh, hai môn, cấu hình và sao lưu; CRUD tài khoản và phân quyền, gồm tạo thêm admin; không tự khóa/hạ quyền chính mình.
- Phó khoa: quản lý học sinh, lớp, giảng dạy và đánh giá cả Tin học lẫn Tiếng Anh.
- Giáo viên: xem hồ sơ, đánh giá môn được phân công, ghi tiết dạy của môn mình; gắn thẻ dùng chung cho học sinh, tạo/sửa thẻ và đánh giá năng khiếu của mình.

Đăng nhập dùng tên tài khoản. Địa chỉ nội bộ trong Supabase Auth có dạng `username@mamxanh.school`; không sử dụng để gửi thư. Vai trò và môn được giao lấy từ `school_profiles`, không lấy từ dữ liệu do trình duyệt tự gửi.

## Giao diện đã tinh gọn

1. **Tổng quan:** số học sinh, tiết/bài, tiến độ đánh giá và năng khiếu; biểu đồ Recharts và bảng dân tộc mở rộng khi cần.
2. **Lớp & học sinh:** cùng một màn hình với hai tab. Bảng lớp phẳng; CRUD lớp/học sinh, import DOCX/XLSX/CSV có xem trước, tìm kiếm, lọc dân tộc và giới tính; thống kê Nam/Nữ/Chưa cập nhật.
3. **Quản lý học lực:** bảng đánh giá đầu vào, hiện tại, tương tác và nhận xét theo môn. Đầu vào lấy từ KQGD nguồn, giữ mã gốc.
4. **Quản lý năng khiếu:** tạo/sửa/xóa thẻ màu theo lĩnh vực, gắn nhiều thẻ cho học sinh ngay trong bảng, lọc theo thẻ; ghi mức độ, nhận xét và hướng bồi dưỡng riêng. Xóa thẻ chỉ gỡ nhãn, giữ các nhận xét.
5. **Giảng dạy:** CRUD lượt dạy, cộng số tiết và tính bài theo lớp/môn/tên bài.
6. **Báo cáo:** lọc lớp, dân tộc, học sinh và kỳ giảng dạy; xem trước, xuất Word hoặc Excel kèm biểu đồ. Khoảng ngày chỉ giới hạn tiết/bài, các đánh giá là hiện trạng lúc xuất.

Khu vực **Hệ thống** chỉ dành cho admin: tài khoản/phân quyền, năm học, sao lưu JSON và các hồ sơ cũ chờ đối chiếu. Đã bỏ menu học sinh trùng với lớp, thẻ trang trí, cấu hình tên giáo viên dùng chung, danh mục môn không cần thiết và nút CSV lặp trên báo cáo. CSV vẫn được hỗ trợ khi import.

Báo cáo xem trước, Word và Excel dùng Times New Roman, cỡ nhỏ nhất 14, kể cả chữ trong bảng, nhãn biểu đồ và chân trang.

Excel có 5 sheet: Tổng quan, Học sinh, Năng khiếu, Giảng dạy, Trích ngang; có bộ lọc, hàng tiêu đề cố định và màu phân biệt dòng. Báo cáo Word có tiêu đề, bảng thống kê, biểu đồ học lực, năng khiếu, nhật ký giảng dạy và số trang; có tùy chọn kèm hồ sơ chi tiết.

## Chạy local

```bash
npm install
npm run dev
```

Tạo `.env.local` theo `.env.example`. Secret key cần cho CRUD tài khoản; nếu chỉ có hai public biến thì đăng nhập và dữ liệu nghiệp vụ vẫn chạy, nhưng thao tác quản lý tài khoản báo thiếu cấu hình. Các biến cấu hình cho ứng dụng:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
SUPABASE_SECRET_KEY=your_server_secret_key
```

Mật khẩu khởi tạo được giữ riêng trong `APP_USERS_JSON` của `.env.local` trên máy quản trị. File này và thư mục `data/` đều bị Git bỏ qua. Không đặt mật khẩu hay secret/service-role key trong biến `NEXT_PUBLIC_*`.

## Deploy Vercel

1. Import repository GitHub, chọn framework Next.js.
2. Thêm `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` và `SUPABASE_SECRET_KEY` vào Environment Variables cho Production và Preview cần sử dụng.
3. Giữ lệnh build `npm run build` và output mặc định của Next.js, rồi Deploy.

Dự án Supabase hiện tại đã được tạo bảng, cấp tài khoản và nhập dữ liệu. Vercel sử dụng trực tiếp kho dữ liệu đó; **không cần chạy lại seed hoặc đưa mật khẩu tài khoản lên GitHub**. Serverless không cần ổ đĩa ghi dữ liệu. `SUPABASE_SECRET_KEY` chỉ dùng phía server cho chức năng admin tạo/sửa/ngừng sử dụng tài khoản; không dùng biến NEXT_PUBLIC cho khóa này.

## Khởi tạo một dự án Supabase mới

1. Chạy lần lượt các migration trong `supabase/migrations/` theo tên tăng dần trong SQL Editor bằng tài khoản quản trị dự án.
2. Cấu hình riêng `SUPABASE_SECRET_KEY` hoặc `SUPABASE_SERVICE_ROLE_KEY` và `APP_USERS_JSON` trong `.env.local`. Mỗi tài khoản gồm username, password tối thiểu 12 ký tự, name, role và subjects.
3. Đặt bản sao lưu JSON hợp lệ tại đường dẫn riêng tư trong `APP_SEED_PATH` (mặc định `data/initial-workspace.json`). Không commit dữ liệu học sinh.
4. Chạy `npx tsx scripts/provision-supabase.ts`. Script tạo Auth users và profile; chỉ seed nếu kho còn trống. Chạy lại không đổi mật khẩu hay ghi đè dữ liệu hiện có.

Dữ liệu thực, mật khẩu và bản sao lưu **không có trong repository**. Bộ kiểm thử đơn vị sử dụng dữ liệu giả lập. Các hồ sơ được đánh dấu trong tài liệu nguồn vẫn giữ ghi chú để giáo viên đối chiếu. Nguồn đầu vào không tự biến thành đánh giá hiện tại hay đánh giá năng khiếu.

## Kiểm tra

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

E2E kết nối dự án Supabase đã cấu hình, cần `APP_USERS_JSON` riêng tư của máy kiểm thử:

```bash
npx playwright install chromium
npm run test:e2e
```

E2E kiểm tra đăng nhập/đăng xuất, cookie HttpOnly, chặn người chưa đăng nhập, quyền API và RPC, chống ghi đè đồng thời, đánh giá học lực/năng khiếu, CRUD thẻ và gắn thẻ, trao đổi dữ liệu giữa tài khoản, xuất Word/Excel có biểu đồ và giao diện mobile. Các thay đổi thử nghiệm chỉ áp dụng lớp/học sinh tạm với ID `E2E-SCRATCH-*`, được dọn sau kiểm tra.

Tài liệu kỹ thuật: [Supabase Auth](https://supabase.com/docs/guides/auth), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Recharts](https://recharts.github.io/en-US/guide/sizes/), [docx](https://docx.js.org/), [ExcelJS](https://github.com/exceljs/exceljs).
