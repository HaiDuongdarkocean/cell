# Cheatsheet — Phím tắt Devin Terminal Workflow

> Tổng hợp phím tắt cho workflow: mở devin CLI + quản lý nhiều terminal trong 1 cửa sổ Windows Terminal.
> Setup: `C:\Users\The0cean\devin-quick\` (listener Python + VBS + Startup shortcut).

## 1. Launcher (toàn cục)

| Phím | Hành động |
|---|---|
| `Win + Shift + Q` | Mở terminal devin mới — split pane vào Windows Terminal đang chạy (lần đầu tạo window mới) |

**Auto-start**: mở máy → listener tự chạy (qua Startup shortcut → VBS → `pythonw.exe`).
**Auth**: tự nhận native credentials, không phải login lại.

## 2. Windows Terminal — Pane navigation

| Phím | Hành động |
|---|---|
| `Alt + ↑` | Focus pane trên |
| `Alt + ↓` | Focus pane dưới |
| `Alt + ←` | Focus pane trái |
| `Alt + →` | Focus pane phải |
| `Alt + Shift + +` | Split pane dọc (side-by-side) |
| `Alt + Shift + -` | Split pane ngang (stacked) |
| `Alt + Shift + D` | Duplicate pane hiện tại |

## 3. Windows Terminal — Swap pane (đổi chỗ)

> Đã thêm vào `settings.json` — dùng để di chuyển pane lên cao/xuống thấp/qua trái/phải.

| Phím | Hành động |
|---|---|
| `Ctrl + Shift + Alt + ↑` | Swap pane hiện tại với pane kề **trên** |
| `Ctrl + Shift + Alt + ↓` | Swap pane hiện tại với pane kề **dưới** |
| `Ctrl + Shift + Alt + ←` | Swap pane hiện tại với pane kề **trái** |
| `Ctrl + Shift + Alt + →` | Swap pane hiện tại với pane kề **phải** |

**Cách dùng**: Focus vào pane muốn move (`Alt + ↑↓←→`) → nhấn swap theo hướng muốn đẩy.

## 4. Windows Terminal — Resize pane

| Phím | Hành động |
|---|---|
| `Alt + Shift + ↑` | Kéo biên trên lên (pane cao hơn) |
| `Alt + Shift + ↓` | Kéo biên trên xuống (pane thấp hơn) |
| `Alt + Shift + ←` | Kéo biên trái qua trái (pane rộng hơn) |
| `Alt + Shift + →` | Kéo biên trái qua phải (pane hẹp hơn) |

Hoặc **drag chuột** trực tiếp đường biên giữa 2 pane.

## 5. Windows Terminal — Tab & đóng

| Phím | Hành động |
|---|---|
| `Ctrl + Shift + T` | Tab mới |
| `Ctrl + Shift + W` | Đóng pane hiện tại (đóng tab nếu là pane cuối) |
| `Ctrl + Tab` | Chuyển tab kế |
| `Ctrl + Shift + Tab` | Chuyển tab trước |
| `Ctrl + Shift + F` | Tìm text |

## 6. Workflow "giao việc" cho devin agent

```
1. Win+Shift+Q          → mở terminal devin #1, giao task A
2. Win+Shift+Q          → split pane #2, giao task B
3. Win+Shift+Q          → split pane #3, giao task C
4. Alt+↑↓←→             → chuyển focus theo dõi từng task
5. Alt+Shift+↑↓←→       → resize pane task đang chạy cho dễ xem
6. Ctrl+Shift+Alt+↑↓←→  → swap pane cho layout hợp lý
7. Ctrl+Shift+W         → đóng pane task đã xong
```

## 7. Lưu ý quan trọng

- **WT không hỗ trợ drag pane tự do** đến vị trí bất kỳ — chỉ swap với neighbor. Muốn pane ở góc xa → swap nhiều lần.
- **Đóng window = mất hết session** (WT không persist). Nếu cần session sống sau khi đóng → dùng tmux.
- **Layout quá rối**: đóng bớt pane (`Ctrl+Shift+W`) rồi `Win+Shift+Q` split lại theo thứ tự mong muốn.

## 8. Khởi động lại listener

> An toàn: chỉ kill `pythonw.exe` chạy `devin-quick.py`, không đụng pythonw khác.

```powershell
# Cách 1 — script helper (khuyến nghị)
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\The0cean\devin-quick\restart-listener.ps1"

# Cách 2 — thủ công
Get-CimInstance Win32_Process -Filter "Name='pythonw.exe'" |
  Where-Object { $_.CommandLine -like '*devin-quick.py*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
wscript "C:\Users\The0cean\devin-quick\devin-quiet.vbs"
```

**Kiểm tra listener đang chạy:**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\The0cean\devin-quick\check-listener.ps1"
```

> KHÔNG dùng `Get-Process pythonw | Stop-Process -Force` — sẽ kill mọi pythonw (có thể đang chạy script khác).

## 9. So sánh WT vs tmux (tham khảo)

| Tiêu chí | WT (hiện tại) | tmux |
|---|---|---|
| Pane layout | Tree, chỉ swap neighbor | Free-form, layout preset |
| Session persist | Không | Có (detach/attach) |
| Scriptable | Hạn chế | Rất mạnh |
| Mouse | Mặc định | Cần `set -g mouse on` |
| Học | Phẳng | Dốc (prefix `Ctrl+b`) |

**Khi nào cần tmux**: giao việc cho agent chạy nền, đóng cửa sổ vẫn sống, SSH remote.
