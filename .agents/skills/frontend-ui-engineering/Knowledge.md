# Responsive Design

## Ideal Screen Size

Design Mobile-First

- Good: Bắt đầu từ màn hình nhỏ (320px → 480px → 768px → 1024px → 1280px), đảm bảo tính tối ưu cho người dùng di động trước -> màn hình to.

- Bad: Thiết kế cho màn hình lớn trước rồi thu nhỏ xuống mobile (1280px → 1024px → 768px → 480px → 320px), dễ gây lỗi hiển thị.

Responsive in Web Design Know Your Breakpoints

- Good: 320px, 480px, 768px, 1024px, 1280px.

- Bad: Không đặt breakpoint hợp lý khiến layout bị méo mó khi hiển thị trên các thiết bị khác nhau.

Create Fluid Designs

- Good: Sử dụng đơn vị % và max-width để layout co giãn linh hoạt theo viewport.

- Bad: Dùng fixed layout (px cố định) khiến nội dung bị bó cứng, dễ vỡ khi chuyển sang màn hình khác.

Decrease Friction

- Good: Thiết kế đơn giản, dễ thao tác trên màn hình nhỏ; các thành phần UI được sắp xếp gọn gàng để tránh chồng chéo.

câu hỏi: tiêu chuẩn nào là sắp xếp gọn gàng khi thiết kế giao diện hệ thống từ mobile -> desktop?

- Bad: Nhồi nhét quá nhiều yếu tố trên màn hình nhỏ, gây khó khăn cho người dùng khi thao tác.

More Functionality, Less Typing

- Good: Tận dụng tính năng thiết bị như GPS, QR code, biometrics; thêm nút gọi, email, chia sẻ để giảm thao tác nhập liệu.

- Bad: Bắt buộc người dùng nhập nhiều thông tin trên mobile, gây bất tiện và dễ bỏ cuộc.

Use Meta Viewport Tag

- Good: Thêm <meta name="viewport" content="width=device-width, initial-scale=1.0"> để trang web tự động điều chỉnh theo kích thước màn hình thiết bị.

- Bad: Bỏ qua thẻ viewport khiến trang hiển thị sai tỷ lệ trên mobile, phải zoom thủ công.

Apply Flexible Grid Layouts

- Good: Dùng CSS Grid hoặc Flexbox với đơn vị phần trăm (%) để layout co giãn linh hoạt.

- Bad: Dùng fixed width (px) cho toàn bộ layout, gây vỡ giao diện trên màn hình nhỏ.

Use Relative Units for Text and Elements

- Good: Áp dụng em, rem, % thay vì px để font chữ và thành phần UI tự động điều chỉnh.

- Bad: Cố định font-size bằng px khiến chữ quá to hoặc quá nhỏ trên các thiết bị khác nhau.

Optimize Images for Responsiveness

- Good: Dùng max-width: 100% và height: auto để hình ảnh co giãn theo container.

- Bad: Đặt kích thước ảnh cố định, khiến ảnh tràn ra ngoài màn hình nhỏ.

Test Across Devices and Browsers

- Good: Kiểm tra trên nhiều thiết bị (mobile, tablet, desktop) và trình duyệt để đảm bảo tính nhất quán.

- Bad: Chỉ test trên một màn hình lớn, bỏ qua trải nghiệm thực tế của người dùng di động.