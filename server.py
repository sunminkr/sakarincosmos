"""Static server and pickup reservation email endpoint.

Required environment variables:
  RESERVATION_EMAIL, SMTP_HOST, SMTP_USER, SMTP_PASSWORD
Optional: SMTP_PORT=587, SMTP_FROM=SMTP_USER, SITE_PORT=8000
"""
import json
import os
import smtplib
from email.message import EmailMessage
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from reservation_service import ReservationError, validate_reservation, reservation_body


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
            if not isinstance(data, dict):
                raise ReservationError("요청 형식이 올바르지 않습니다.")
            if data.get("website"):
                return self.send_json(200, {"ok": True})
            clean = validate_reservation(data)
            recipient = os.environ.get("RESERVATION_EMAIL")
            host, user, password = (os.environ.get(k) for k in ("SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"))
            if not all((recipient, host, user, password)):
                return self.send_json(503, {"message": "메일 서버가 아직 설정되지 않았습니다."})

            msg = EmailMessage()
            msg["Subject"] = f"[Sakarin Cosmos Pickup] {len(clean['items'])} items / {clean['name']}"
            msg["From"] = os.environ.get("SMTP_FROM", user)
            msg["To"] = recipient
            msg["Reply-To"] = clean["email"]
            msg.set_content(reservation_body(clean))
            with smtplib.SMTP(host, int(os.environ.get("SMTP_PORT", "587")), timeout=15) as smtp:
                smtp.starttls(); smtp.login(user, password); smtp.send_message(msg)
            self.send_json(200, {"ok": True})
        except ReservationError as exc:
            self.send_json(exc.status, {"message": str(exc)})
        except (json.JSONDecodeError, ValueError):
            self.send_json(400, {"message": "요청 형식이 올바르지 않습니다."})
        except Exception as exc:
            print(f"Email dispatch failed: {exc}")
            self.send_json(502, {"message": "메일 발송 중 오류가 발생했습니다."})


if __name__ == "__main__":
    port = int(os.environ.get("SITE_PORT", "8000"))
    print(f"Sakarin Cosmos server: http://localhost:{port}")
    ThreadingHTTPServer(("", port), Handler).serve_forever()
