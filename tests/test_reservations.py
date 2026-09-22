"""Validate pickup deadlines and item options without sending real mail."""
import json
import os
from pathlib import Path
import sys
import threading
import unittest
from datetime import datetime
from unittest.mock import patch
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from http.server import ThreadingHTTPServer

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from reservation_service import ReservationError, validate_reservation, reservation_body, CATALOG_PATH
from server import Handler

NOW = datetime.fromisoformat('2026-09-21T12:00:00+09:00')


def request_data(**changes):
    return {'name': '테스트', 'phone': '010-0000-0000', 'email': 'test@example.com',
            'privacy': 'on', 'showId': 'bbang-oct23', 'note': '',
            'items': [{'productId': 'logo-t-shirt', 'size': 'M', 'quantity': 2},
                      {'productId': 'logo-t-shirt', 'size': 'L', 'quantity': 1}], **changes}


class ReservationChecks(unittest.TestCase):
    def setUp(self):
        self.published_catalog = CATALOG_PATH.read_text(encoding='utf-8')
        catalog_patch = patch('reservation_service.CATALOG_PATH')
        mocked_path = catalog_patch.start()
        self.addCleanup(catalog_patch.stop)
        mocked_path.read_text.return_value = self.published_catalog
        self.mocked_path = mocked_path

    def test_three_day_deadline_at_seoul_midnight(self):
        # Include month, year and leap-year boundaries; D-3 is inclusive.
        for show_day, last_day in [('2026-09-19', '2026-09-16'), ('2027-01-02', '2026-12-30'),
                                   ('2027-03-01', '2027-02-26'), ('2028-03-01', '2028-02-27')]:
            with self.subTest(show=show_day):
                catalog = json.loads(self.published_catalog)
                catalog['shows'][0]['date'] = show_day
                self.mocked_path.read_text.return_value = json.dumps(catalog)
                data = request_data(showId='bbang')
                validate_reservation(data, datetime.fromisoformat(f'{last_day}T14:59:59+00:00'))
                for closed in [f'{last_day}T15:00:00+00:00', f'{show_day}T00:00:00+09:00']:
                    with self.assertRaises(ReservationError) as error:
                        validate_reservation(data, datetime.fromisoformat(closed))
                    self.assertEqual(error.exception.status, 409)
                    self.assertEqual(error.exception.code, 'validation.show')

    def test_published_pickup_availability(self):
        self.mocked_path.read_text.return_value = self.published_catalog
        items = [{'productId': 'logo-t-shirt', 'size': 'M', 'quantity': 1}]
        for show_id in ['bbang-oct23', 'sound-crue']:
            for size in ['XS', 'S', 'M', 'L', 'XL']:
                with self.subTest(show=show_id, size=size):
                    sized_items = [{'productId': 'logo-t-shirt', 'size': size, 'quantity': 1}]
                    clean = validate_reservation(request_data(showId=show_id, items=sized_items), NOW)
                    self.assertEqual(clean['show']['id'], show_id)
                    self.assertEqual(clean['total'], 25000)
                    self.assertIn(f'사이즈 {size} × 1', reservation_body(clean))
        for show_id in ['bbang', 'missing-show', 'channel1969', 'ovantgarde']:
            with self.subTest(show=show_id), self.assertRaises(ReservationError) as error:
                validate_reservation(request_data(showId=show_id, items=items), NOW)
            self.assertEqual(error.exception.code, 'validation.show')
        unavailable = json.loads(self.published_catalog)
        unavailable['shows'][1]['pickup'] = False
        self.mocked_path.read_text.return_value = json.dumps(unavailable)
        with self.assertRaises(ReservationError) as error:
            validate_reservation(request_data(items=items), NOW)
        self.assertEqual(error.exception.code, 'validation.show')

    def test_canonical_prices_and_size_lines(self):
        clean = validate_reservation(request_data(price='1', total=1), NOW)
        self.assertEqual(clean['total'], 75000)
        self.assertEqual(clean['quantity'], 3)
        body = reservation_body(clean)
        self.assertIn('sakarin cosmos logo t-shirt / 사이즈 M × 2 · ₩50,000', body)
        self.assertIn('sakarin cosmos logo t-shirt / 사이즈 L × 1 · ₩25,000', body)
        self.assertIn('2026-10-23 클럽 빵', body)

    def test_invalid_sizes_and_quantities(self):
        for item in [
            {'productId': 'logo-t-shirt', 'size': '', 'quantity': 1},
            {'productId': 'logo-t-shirt', 'size': 'XXL', 'quantity': 1},
            {'productId': 'flower-keyring', 'size': 'M', 'quantity': 1},
            {'productId': 'slogan-towel', 'size': 'M', 'quantity': 1},
            {'productId': 'sticker-sheet', 'size': 'M', 'quantity': 1},
            {'productId': 'missing-product', 'size': '', 'quantity': 1},
            {'productId': 'orbit-tee', 'size': 'M', 'quantity': 1},
            {'productId': 'signal-keyring', 'size': '', 'quantity': 1},
            *[{'productId': 'logo-t-shirt', 'size': 'M', 'quantity': quantity}
              for quantity in [0, -1, 10, 1.5, True, '1']],
        ]:
            with self.subTest(item=item), self.assertRaises(ReservationError):
                validate_reservation(request_data(items=[item]), NOW)

    def test_duplicate_variants_enforce_limit(self):
        item = {'productId': 'logo-t-shirt', 'size': 'M', 'quantity': 5}
        with self.assertRaises(ReservationError):
            validate_reservation(request_data(items=[item, item]), NOW)
        item['quantity'] = 2
        clean = validate_reservation(request_data(items=[item, item]), NOW)
        self.assertEqual(clean['items'][0]['quantity'], 4)
        self.assertEqual(len(clean['items']), 1)

    def test_non_apparel_and_contact_validation(self):
        for product_id, name, price in [
            ('flower-keyring', 'sakarin cosmos flower keyring', 8000),
            ('slogan-towel', 'sakarin cosmos slogan towel', 15000),
            ('sticker-sheet', 'sakarin cosmos sticker sheet', 3500),
        ]:
            with self.subTest(product=product_id):
                clean = validate_reservation(request_data(items=[{'productId': product_id, 'size': '', 'quantity': 1, 'price': 1}]), NOW)
                self.assertEqual(clean['total'], price)
                self.assertIn(f'{name} × 1 · ₩{price:,}', reservation_body(clean))
        mixed = validate_reservation(request_data(items=[
            {'productId': 'logo-t-shirt', 'size': 'XS', 'quantity': 1},
            {'productId': 'flower-keyring', 'size': '', 'quantity': 2, 'price': 1},
            {'productId': 'slogan-towel', 'size': '', 'quantity': 1, 'price': 1},
            {'productId': 'sticker-sheet', 'size': '', 'quantity': 2, 'price': 1},
        ]), NOW)
        self.assertEqual(mixed['total'], 63000)
        self.assertEqual(mixed['quantity'], 6)
        self.assertIn('sakarin cosmos flower keyring × 2 · ₩16,000', reservation_body(mixed))
        self.assertIn('sakarin cosmos slogan towel × 1 · ₩15,000', reservation_body(mixed))
        self.assertIn('sakarin cosmos sticker sheet × 2 · ₩7,000', reservation_body(mixed))
        for changes in [{'privacy': ''}, {'email': 'invalid'}, {'items': []}, {'name': 'hello\nInjected'}, {'items': [{}]}]:
            with self.subTest(changes=changes), self.assertRaises(ReservationError):
                validate_reservation(request_data(**changes), NOW)

    def test_http_rejects_closed_pickup_and_sends_canonical_batch(self):
        class QuietHandler(Handler):
            def log_message(self, *_):
                pass
        server = ThreadingHTTPServer(('127.0.0.1', 0), QuietHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        url = f'http://127.0.0.1:{server.server_port}/api/reservations'
        def post(data):
            return urlopen(Request(url, data=json.dumps(data).encode(), headers={'Content-Type': 'application/json'}))
        try:
            with patch('server.validate_reservation', side_effect=lambda data: validate_reservation(data, NOW)), \
                 patch('server.smtplib.SMTP') as smtp, \
                 patch.dict(os.environ, {'RESERVATION_EMAIL': 'test@example.com', 'SMTP_HOST': 'test', 'SMTP_USER': 'test@example.com', 'SMTP_PASSWORD': 'test'}):
                with self.assertRaises(HTTPError) as error:
                    post(request_data(showId='bbang'))
                self.assertEqual(error.exception.code, 409)
                smtp.assert_not_called()
                with self.assertRaises(HTTPError) as error:
                    post(request_data(items=[{'productId': 'logo-t-shirt', 'size': '', 'quantity': 1}]))
                self.assertEqual(error.exception.code, 400)
                smtp.assert_not_called()
                with post(request_data()) as response:
                    self.assertEqual(response.status, 200)
                message = smtp.return_value.__enter__.return_value.send_message.call_args.args[0]
                self.assertIn('사이즈 M × 2', message.get_content())
                self.assertIn('사이즈 L × 1', message.get_content())
                self.assertEqual(message['Reply-To'], 'test@example.com')
                self.assertIn('신청자에게 확인 메일을 보내 주세요.', message.get_content())
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == '__main__':
    unittest.main(verbosity=2)
