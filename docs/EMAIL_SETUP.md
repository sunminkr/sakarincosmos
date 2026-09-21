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

Gmail 등 2단계 인증을 사용하는 서비스는 일반 로그인 비밀번호 대신 앱 비밀번호를 사용해야 합니다. 운영 배포 환경에서도 같은 이름의 환경변수를 비밀 설정으로 등록해야 합니다.
