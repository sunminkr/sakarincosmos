# Pickup email setup

픽업 신청은 브라우저에서 `/api/reservations`로 전달되고, `server.py`가 지정된 주소로 이메일을 발송합니다. SMTP 비밀번호는 HTML이나 JavaScript에 넣지 않습니다.

PowerShell에서 아래 환경변수를 설정한 후 서버를 실행합니다.

```powershell
$env:RESERVATION_EMAIL="pickup@your-domain.com"
$env:SMTP_HOST="smtp.your-provider.com"
$env:SMTP_PORT="587"
$env:SMTP_USER="mailer@your-domain.com"
$env:SMTP_PASSWORD="your-app-password"
$env:SMTP_FROM="mailer@your-domain.com"
python server.py
```

브라우저에서 `http://localhost:8000/`을 엽니다. `RESERVATION_EMAIL`이 실제 신청 내용을 받을 지정 주소입니다.

신청 완료 시 담당자에게 접수 메일이 전송됩니다. 신청자에게 확인 메일이 자동 발송되지는 않습니다. 담당자는 상품과 픽업 가능 여부를 확인한 뒤 접수 메일에 답장하여 상품·수량·픽업 공연을 안내합니다. 접수 메일의 `Reply-To`가 신청자의 이메일로 설정되어 있습니다. 사이트에서는 이 확인 메일을 받은 시점에 예약이 확정된다고 안내합니다. 공연 당일에는 신청자 성함과 휴대폰 번호 뒤 4자리로 예약을 확인하고, 현장 결제 후 상품을 전달합니다.

Gmail 등 2단계 인증을 사용하는 서비스는 일반 로그인 비밀번호 대신 앱 비밀번호를 사용해야 합니다. 운영 배포 환경에서도 같은 이름의 환경변수를 비밀 설정으로 등록해야 합니다.
