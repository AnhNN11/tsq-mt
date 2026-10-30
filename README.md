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

Dự án Supabase hiện tại đã được tạo bảng, cấp tài khoản và nhập dữ liệu, gồm migration bảng điểm `202610300006` đến `202610300011`. Vercel sử dụng trực tiếp kho dữ liệu đó; **không cần chạy lại seed hoặc đưa mật khẩu tài khoản lên GitHub**. Serverless không cần ổ đĩa ghi dữ liệu. `SUPABASE_SECRET_KEY` chỉ dùng phía server; không dùng biến NEXT_PUBLIC cho khóa này.

## Chấm thi bằng điện thoại

Vào **Chấm thi → chọn lớp → chọn Tin học hoặc Tiếng Anh → chọn hoặc tạo bài thi**. Tên bài thi do giáo viên tự đặt, có thêm, xem, sửa, xóa và lưu trữ; không có danh sách loại kiểm tra cố định hay bước chọn học kỳ một/hai. Năm học dùng cấu hình hệ thống để phân tách dữ liệu. Bài thi đã có lịch sử điểm được bảo vệ khỏi xóa; dùng lưu trữ để giữ kết quả và đóng phiên điện thoại.

Mỗi bài thi chọn một **mẫu phiếu ô tô**, nhập số câu, mã đề, đáp án và thang điểm riêng. Danh mục **Mẫu phiếu ô tô** có CRUD, xem trước, tạo từ mẫu và căn chỉnh bố cục khác trên ảnh tham chiếu. Có mẫu ba phần được căn theo ảnh đã cung cấp và mẫu nội bộ 40 câu chọn đáp án. Mẫu dùng chung chỉ admin/phó khoa được sửa; giáo viên có thể tạo bản sao cho môn phụ trách. Bài thi giữ bản chụp cấu hình mẫu để các lần sửa/xóa danh mục không thay đổi kết quả đã có.

Mẫu ba phần có tối đa 40 câu chọn A–D, 8 câu đúng/sai (mỗi câu bốn ý) và 6 câu trả lời ngắn dạng số (bốn ô, tính cả dấu âm/dấu phẩy). Chỉ những câu được cấu hình trong bài thi mới được chấm. Có thể tính điểm đúng/sai theo từng ý hoặc theo số ý đúng, cấu hình sai số số học và tổng điểm tới 100. Mặc định bài Tiếng Anh dùng 40 câu chọn đáp án, các phần khác bằng 0; giáo viên tự điều chỉnh theo đề nội bộ thực tế.

**Kết nối điện thoại bằng QR** tạo phiên 30 phút, tối đa 100 bài lưu thành công. Điện thoại quét một lần, nhận danh sách học sinh và mã đề của đúng bài thi, chọn học sinh/mã đề rồi chụp hoặc chọn ảnh. Sau khi nhận ảnh từ camera, phần mềm tự nhận dạng, chấm, **lưu điểm ngay** và chuyển sang em tiếp theo chưa có điểm; máy tính cập nhật mỗi 4 giây. Không cần tài khoản trên điện thoại vì mã QR là quyền chấm có giới hạn của tài khoản giáo viên mở phiên; giữ liên kết trong nhóm giáo viên được phép chấm. Đóng bài thi trên máy tính sẽ đóng kết nối do cửa sổ đó mở.

**Ảnh bài thi chỉ nằm trong bộ nhớ lúc xử lý request; không ghi lên Storage, ổ đĩa hay bảng dữ liệu.** Điện thoại giữ ảnh xem trước trong bộ nhớ để thử lại nếu mạng lỗi, bỏ khi chấm xong/đổi ảnh/đóng trang. Hệ thống chỉ giữ điểm, lịch sử người cập nhật và dấu kiểm tra gửi trùng không thể khôi phục ảnh. Mạng lỗi gửi lại cùng lượt không tạo điểm hoặc lịch sử trùng; ảnh trùng không được gắn sang học sinh khác. Điểm đã có không tự bị ghi đè; giáo viên sửa/xóa điểm từ bảng trên máy tính nếu cần chấm lại.

Ảnh không khớp mẫu, ô tô mờ/nhiều đáp án, trả lời ngắn không đọc thành số hoặc phiếu trống hoàn toàn sẽ yêu cầu chụp/kiểm tra lại trước khi lưu. Câu bỏ trống riêng lẻ được tính 0; bài tô rõ nhưng sai hết vẫn có thể được 0 điểm. Nếu đọc được số báo danh hoặc mã đề trên phiếu khác lựa chọn trên điện thoại, hệ thống dừng để kiểm tra. Với mẫu nội bộ không in các ô mã này, dùng học sinh/mã đề đang chọn trên điện thoại. Mỗi ảnh được gắn với lựa chọn tại lúc bắt đầu chụp, giúp đổi danh sách trong khi gửi không làm gán nhầm em.

Để căn chỉnh mẫu khác: mở ảnh phiếu trống có bốn dấu vuông ngoài cùng, chọn tâm bốn dấu theo thứ tự trên trái → trên phải → dưới phải → dưới trái; chọn dạng câu hỏi và số câu cho từng khối, chọn bốn góc vùng ô rồi thêm vùng. Tạo một khối cho mỗi cột câu hỏi; phần đúng/sai có bốn dòng mỗi câu; phần trả lời ngắn tạo một vùng bốn cột chữ số cho mỗi câu. Kiểm tra vòng xanh khớp tâm/viền các ô trước khi lưu. Ảnh tham chiếu chỉ mở trong trình duyệt; chỉ tọa độ ô được lưu vào Supabase. Mẫu tự căn cần thử với bài tô thật và điều kiện chụp thực tế trước khi dùng đại trà. Các kiểm thử tự động dùng ảnh phiếu trống gốc và phiếu tô giả lập, có xoay/nghiêng; không khẳng định một tỷ lệ chính xác cho mọi ảnh thực tế.

Giáo viên chỉ chấm và sửa dữ liệu môn được phân công; admin/phó khoa quản lý hai môn. Server tính điểm theo đáp án được lưu, kiểm tra lại quyền tài khoản mở phiên và phiên bản bài thi ngay khi ghi kết quả. Khóa phiên bản và giao dịch nguyên tử chống hai điện thoại ghi đè cùng học sinh. Khi đã có lịch sử điểm, đáp án, mẫu và thang điểm được khóa; tạo bài thi mới để đổi cấu hình chấm.

Xuất Excel trong danh sách bài thi của lớp/môn gồm bảng điểm, chi tiết kết quả và cấu hình thang điểm; Times New Roman cỡ tối thiểu 14. Điểm tổng hợp nội bộ quy đổi thang 10 theo trọng số của những bài đã có điểm, để trống các bài chưa chấm. Lưu trữ bài thi giữ điểm trong bản xuất. Phần này không tự suy ra kết quả học lực pháp định.

`APP_PUBLIC_URL` không bắt buộc trên Vercel: QR dùng tên miền đang truy cập. Nếu đặt, dùng tên miền HTTPS thực tế. Khi thử tại máy, chạy `npm run dev -- --hostname 0.0.0.0`, đặt biến bằng IP LAN của máy và dùng điện thoại cùng Wi-Fi. **Không đưa IP LAN lên Vercel.** `CRON_SECRET` và cron dọn ảnh hiện chỉ phục vụ ảnh tạm của luồng cũ trước khi nâng cấp; luồng chấm trực tiếp mới không tạo ảnh lưu trữ.

Migration `202610300010` bổ sung `school_paper_templates` và `school_capture_receipts`, bật RLS, thêm cấu hình mẫu vào `school_exams` và RPC chấm trực tiếp chỉ server role được gọi. Migration `202610300011` giữ rõ bố cục mẫu cho bài thi đã tạo trước nâng cấp. Các bảng điểm/hồ sơ cũ được giữ nguyên. Backup JSON tại Quản trị hệ thống chỉ gồm hồ sơ, đánh giá, năng khiếu, giảng dạy và cấu hình; cần sao lưu riêng các bảng điểm, mẫu phiếu, phiên chấm và tài khoản bằng công cụ Supabase để khôi phục toàn hệ thống.

Về mẫu của Bộ: [hướng dẫn phiếu thi tốt nghiệp THPT 2025](https://xaydungchinhsach.chinhphu.vn/huong-dan-su-dung-phieu-tra-loi-trac-nghiem-thi-tot-nghiep-thpt-nam-2025-119250324144831872.htm) có mẫu chung ba phần; [cấu trúc môn từ năm 2025](https://baochinhphu.vn/bo-gddt-cong-bo-cau-truc-dinh-dang-de-thi-tot-nghiep-thpt-tu-nam-2025-102231229141552944.htm) nêu Ngoại ngữ chỉ dùng dạng chọn một đáp án. Mẫu chung và phần được chấm là hai cấu hình khác nhau. Phiếu do phần mềm tự in là phiếu nội bộ tương thích bộ nhận dạng đã kiểm thử, không tự nhận là phiếu in đạt quy cách cho kỳ thi quốc gia.

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

E2E kiểm tra đăng nhập/đăng xuất, cookie HttpOnly, chặn người chưa đăng nhập, quyền API và RPC, chống ghi đè đồng thời, đánh giá học lực/năng khiếu, CRUD thẻ học lực/năng khiếu và gắn thẻ, trao đổi dữ liệu giữa tài khoản, xuất Word/Excel có biểu đồ và giao diện mobile. Các thay đổi thử nghiệm chỉ áp dụng lớp/học sinh tạm với ID `E2E-SCRATCH-*`, `ACADEMIC-E2E-*` hoặc `DIRECT-E2E-*`, được dọn sau kiểm tra.

Tài liệu kỹ thuật: [Supabase Auth](https://supabase.com/docs/guides/auth), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Recharts](https://recharts.github.io/en-US/guide/sizes/), [docx](https://docx.js.org/), [ExcelJS](https://github.com/exceljs/exceljs).
