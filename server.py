"""Static server and pickup reservation email endpoint.

Required environment variables:
  RESERVATION_EMAIL, SMTP_HOST, SMTP_USER, SMTP_PASSWORD
Optional: SMTP_PORT=587, SMTP_FROM=SMTP_USER, SITE_PORT=8000
"""
import json
import os
import re
import smtplib
from email.message import EmailMessage
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
REQUIRED = ("name", "phone", "email", "item", "venue", "quantity")


class Handler(SimpleHTTPRequestHandler):
    def send_json(self, status, payload):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        if self.path != "/api/reservations":
            return self.send_json(404, {"message": "Endpoint not found."})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 20_000:
                return self.send_json(413, {"message": "잘못된 요청 크기입니다."})
            data = json.loads(self.rfile.read(length))
            if data.get("website"):
                return self.send_json(200, {"ok": True})
            clean = {key: str(data.get(key, "")).strip()[:500] for key in (*REQUIRED, "price", "option", "note")}
            if any(not clean[key] for key in REQUIRED) or not EMAIL_RE.match(clean["email"]):
                return self.send_json(400, {"message": "필수 신청 정보를 확인해 주세요."})
            recipient = os.environ.get("RESERVATION_EMAIL")
            host, user, password = (os.environ.get(k) for k in ("SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"))
            if not all((recipient, host, user, password)):
                return self.send_json(503, {"message": "메일 서버가 아직 설정되지 않았습니다."})

            msg = EmailMessage()
            msg["Subject"] = f"[Sakarin Cosmos Pickup] {clean['item']} / {clean['name']}"
            msg["From"] = os.environ.get("SMTP_FROM", user)
            msg["To"] = recipient
            msg["Reply-To"] = clean["email"]
            msg.set_content("\n".join([
                "새 현장 픽업 신청이 접수되었습니다.", "",
                f"상품: {clean['item']}", f"가격: {clean['price']}", f"수량: {clean['quantity']}",
                f"옵션: {clean['option'] or '해당 없음'}", f"픽업 공연: {clean['venue']}", "",
                f"신청자: {clean['name']}", f"연락처: {clean['phone']}", f"이메일: {clean['email']}",
                f"요청 사항: {clean['note'] or '없음'}"
            ]))
            with smtplib.SMTP(host, int(os.environ.get("SMTP_PORT", "587")), timeout=15) as smtp:
                smtp.starttls(); smtp.login(user, password); smtp.send_message(msg)
            self.send_json(200, {"ok": True})
        except (json.JSONDecodeError, ValueError):
            self.send_json(400, {"message": "요청 형식이 올바르지 않습니다."})
        except Exception as exc:
            print(f"Email dispatch failed: {exc}")
            self.send_json(502, {"message": "메일 발송 중 오류가 발생했습니다."})


if __name__ == "__main__":
    port = int(os.environ.get("SITE_PORT", "8000"))
    print(f"Sakarin Cosmos server: http://localhost:{port}")
    ThreadingHTTPServer(("", port), Handler).serve_forever()
