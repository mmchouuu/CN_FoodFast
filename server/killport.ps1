# === Script đã sửa (chạy Run as Administrator) ===
# Lưu ý: script sẽ dừng/disable services và kill processes. Backup DB nếu cần!

$svcNames = "PostgreSQL5433","PostgreSQL5434","PostgreSQL5435","PostgreSQL5436","postgresql-x64-17"

Write-Host "1) Hiển thị trạng thái services liên quan postgres (chỉ để bạn kiểm tra):" -ForegroundColor Cyan
Get-Service -Name $svcNames -ErrorAction SilentlyContinue | Format-Table -AutoSize

foreach ($s in $svcNames) {
    try {
        Write-Host ("-> Dừng service {0} (nếu đang chạy)..." -f $s) -ForegroundColor Yellow
        Stop-Service -Name $s -Force -ErrorAction SilentlyContinue
        Write-Host ("   Thiết lập StartupType = Disabled cho {0}" -f $s) -ForegroundColor Yellow
        Set-Service -Name $s -StartupType Disabled -ErrorAction SilentlyContinue
    } catch {
        # In lỗi tách biệt, tránh nội suy phức tạp
        Write-Host ("   [LỖI] Không thể xử lý service {0}:" -f $s) -NoNewline
        Write-Host (" {0}" -f $_.Exception.Message) -ForegroundColor Red
    }
}

Write-Host "`n2) Liệt kê tiến trình liên quan (postgres, wslrelay, com.docker.backend):" -ForegroundColor Cyan
Get-Process -Name postgres,wslrelay,com.docker.backend -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, Path | Format-Table -AutoSize

try {
    $procs = Get-Process -Name postgres -ErrorAction SilentlyContinue
    if ($procs) {
        $ids = $procs.Id -join ","
        Write-Host ("`n3) Kill tiến trình postgres: IDs = {0}" -f $ids) -ForegroundColor Yellow
        $procs | Stop-Process -Force -ErrorAction SilentlyContinue
        Write-Host "   Đã kill các tiến trình postgres." -ForegroundColor Green
    } else {
        Write-Host "   Không tìm thấy tiến trình 'postgres' đang chạy." -ForegroundColor Green
    }
} catch {
    Write-Host "   Lỗi khi cố kill postgres:" -NoNewline
    Write-Host (" {0}" -f $_.Exception.Message) -ForegroundColor Red
}

try {
    $w = Get-Process -Name wslrelay -ErrorAction SilentlyContinue
    if ($w) {
        Write-Host "`n4) Kill wslrelay (có thể ảnh hưởng WSL, sẽ chạy wsl --shutdown sau):" -ForegroundColor Yellow
        $w | Stop-Process -Force -ErrorAction SilentlyContinue
        Write-Host "   Đã kill wslrelay." -ForegroundColor Green
    } else {
        Write-Host "   Không tìm thấy wslrelay." -ForegroundColor Green
    }
} catch {
    Write-Host "   Lỗi khi cố kill wslrelay:" -NoNewline
    Write-Host (" {0}" -f $_.Exception.Message) -ForegroundColor Red
}

try {
    Write-Host "`n5) Thực hiện 'wsl --shutdown' để reset WSL (nếu có)." -ForegroundColor Cyan
    wsl --shutdown
    Write-Host "   wsl --shutdown đã chạy." -ForegroundColor Green
} catch {
    Write-Host "   Lưu ý: 'wsl' không khả dụng hoặc lỗi:" -NoNewline
    Write-Host (" {0}" -f $_.Exception.Message) -ForegroundColor Yellow
}

Start-Sleep -Seconds 2
Write-Host "`n6) Kiểm tra lại listener trên cổng 5433-5436:" -ForegroundColor Cyan
$ports = 5433,5434,5435,5436
$net = Get-NetTCPConnection -LocalPort $ports -ErrorAction SilentlyContinue
if (-not $net) {
    Write-Host "   OK — Không có process nào đang listen trên ports 5433-5436." -ForegroundColor Green
} else {
    Write-Host "   Vẫn có listener (nếu còn, kiểm tra PID/ProcessName):" -ForegroundColor Red
    $net | Format-Table LocalAddress,LocalPort,State,OwningProcess -AutoSize

    $remainingPids = $net | Select-Object -ExpandProperty OwningProcess -Unique
    Get-Process -Id $remainingPids -ErrorAction SilentlyContinue | Select-Object Id,ProcessName,Path | Format-Table -AutoSize
}

Write-Host "`n7) Nếu Docker Desktop đang chạy, hãy restart Docker Desktop để đảm bảo binding host ports." -ForegroundColor Cyan
Write-Host "   (Bạn có thể Quit Docker Desktop từ system tray rồi mở lại.)" -ForegroundColor Yellow

Write-Host "`nHoàn tất." -ForegroundColor Cyan

