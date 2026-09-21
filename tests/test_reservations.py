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
        catalog = json.loads(self.published_catalog)
        # Availability and options are simulated without publishing unconfirmed details.
        for show in catalog['shows']:
            show['pickup'] = True
        catalog['products'][0]['sizes'] = ['S', 'M', 'L', 'XL']
        catalog['products'].append({'id': 'test-no-options', 'name': 'Test item', 'price': 14000, 'sizes': []})
        catalog_patch = patch('reservation_service.CATALOG_PATH')
        mocked_path = catalog_patch.start()
        self.addCleanup(catalog_patch.stop)
        mocked_path.read_text.return_value = json.dumps(catalog)
        self.mocked_path = mocked_path

    def test_seoul_midnight_deadline(self):
        data = request_data(showId='bbang')
        validate_reservation(data, datetime.fromisoformat('2026-09-19T14:59:59+00:00'))
        with self.assertRaises(ReservationError) as error:
            validate_reservation(data, datetime.fromisoformat('2026-09-19T15:00:00+00:00'))
        self.assertEqual(error.exception.status, 409)

    def test_expired_unknown_and_unavailable_shows(self):
        self.mocked_path.read_text.return_value = self.published_catalog
        for show_id in ['bbang', 'missing-show', 'channel1969', 'ovantgarde', 'bbang-oct23', 'sound-crue']:
            with self.subTest(show=show_id), self.assertRaises(ReservationError):
                validate_reservation(request_data(showId=show_id), NOW)

    def test_canonical_prices_and_size_lines(self):
        clean = validate_reservation(request_data(price='1', total=1), NOW)
        self.assertEqual(clean['total'], 75000)
        self.assertEqual(clean['quantity'], 3)
        body = reservation_body(clean)
        self.assertIn('sakarin cosmos logo t-shirt / 사이즈 M × 2 · ₩50,000', body)
        self.assertIn('sakarin cosmos logo t-shirt / 사이즈 L × 1 · ₩25,000', body)
        self.assertIn('2026-10-23 빵', body)

    def test_invalid_sizes_and_quantities(self):
        for item in [
            {'productId': 'logo-t-shirt', 'size': '', 'quantity': 1},
            {'productId': 'logo-t-shirt', 'size': 'XXL', 'quantity': 1},
            {'productId': 'test-no-options', 'size': 'M', 'quantity': 1},
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
        clean = validate_reservation(request_data(items=[{'productId': 'test-no-options', 'size': '', 'quantity': 1}]), NOW)
        self.assertEqual(clean['total'], 14000)
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
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == '__main__':
    unittest.main(verbosity=2)
