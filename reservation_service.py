"""Canonical pickup validation shared by single and batch requests."""
import json
import re
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

CATALOG_PATH = Path(__file__).resolve().parent / 'data' / 'catalog.json'
SEOUL = ZoneInfo('Asia/Seoul')
EMAIL_RE = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')


class ReservationError(ValueError):
    def __init__(self, message, status=400, code='request.invalid'):
        super().__init__(message)
        self.status = status
        self.code = code


def validate_reservation(data, now=None):
    if not isinstance(data, dict):
        raise ReservationError('요청 형식이 올바르지 않습니다.', code='request.invalid')
    catalog = json.loads(CATALOG_PATH.read_text(encoding='utf-8'))
    current_day = (now or datetime.now(SEOUL)).astimezone(SEOUL).date()
    show = next((show for show in catalog['shows'] if show['id'] == data.get('showId')), None)
    if not show or not show['pickup'] or current_day > date.fromisoformat(show['date']) - timedelta(days=3):
        raise ReservationError('선택한 공연은 픽업 신청이 마감되었거나 신청할 수 없습니다. 다른 공연을 선택해 주세요.', 409, code='validation.show')

    clean = {}
    for field, limit in [('name', 60), ('phone', 30), ('email', 120), ('note', 500)]:
        value = data.get(field, '')
        if not isinstance(value, str) or len(value.strip()) > limit:
            raise ReservationError('신청 정보의 형식과 길이를 확인해 주세요.', code='validation.format')
        clean[field] = value.strip()
        if field != 'note' and (not clean[field] or re.search(r'[\r\n]', value)):
            raise ReservationError('필수 신청 정보를 확인해 주세요.', code='validation.required')
    if not EMAIL_RE.fullmatch(clean['email']):
        raise ReservationError('이메일 주소를 확인해 주세요.', code='validation.email')
    if not (data.get('privacy') is True or data.get('privacy') == 'on'):
        raise ReservationError('개인정보 수집·이용에 동의해 주세요.', code='validation.privacy')

    items = data.get('items')
    if not isinstance(items, list) or not 1 <= len(items) <= 50:
        raise ReservationError('신청할 상품을 확인해 주세요.', code='validation.items')
    products = {product['id']: product for product in catalog['products']}
    merged = {}
    for item in items:
        if not isinstance(item, dict) or not isinstance(item.get('productId'), str):
            raise ReservationError('상품 정보를 확인해 주세요.', code='validation.product')
        product = products.get(item['productId'])
        if not product:
            raise ReservationError('존재하지 않는 상품입니다. 페이지를 새로고침해 주세요.', code='validation.missingProduct')
        size = item.get('size', '')
        if not isinstance(size, str) or (size not in product['sizes'] if product['sizes'] else size != ''):
            raise ReservationError(f"{product['name']}의 사이즈를 확인해 주세요.", code="validation.size")
        quantity = item.get('quantity')
        if type(quantity) is not int or not 1 <= quantity <= 9:
            raise ReservationError('상품별 수량은 1개부터 9개까지 선택할 수 있습니다.', code='validation.quantity')
        key = (product['id'], size)
        if key in merged:
            merged[key]['quantity'] += quantity
            if merged[key]['quantity'] > 9:
                raise ReservationError('같은 상품과 사이즈는 최대 9개까지 신청할 수 있습니다.', code='validation.limit')
        else:
            merged[key] = {'productId': product['id'], 'name': product['name'],
                           'size': size, 'quantity': quantity, 'unitPrice': product['price']}
    clean['items'] = list(merged.values())
    clean['show'] = show
    clean['quantity'] = sum(item['quantity'] for item in clean['items'])
    clean['total'] = sum(item['unitPrice'] * item['quantity'] for item in clean['items'])
    return clean


def reservation_body(reservation):
    show = reservation['show']
    lines = ['새 현장 픽업 신청이 접수되었습니다.', '', '신청 물품:']
    for item in reservation['items']:
        option = f" / 사이즈 {item['size']}" if item['size'] else ''
        lines.append(f"- {item['name']}{option} × {item['quantity']} · ₩{item['unitPrice'] * item['quantity']:,}")
    lines.extend([
        '', f"총 수량: {reservation['quantity']}", f"예상 합계: ₩{reservation['total']:,}",
        f"픽업 공연: {show['date']} {show['venue']} ({show['city']})", '',
        f"신청자: {reservation['name']}", f"연락처: {reservation['phone']}",
        f"이메일: {reservation['email']}", '개인정보 수집·이용 동의: 확인',
        f"요청 사항: {reservation['note'] or '없음'}", '',
        '처리 안내: 상품과 픽업 가능 여부를 확인한 뒤 이 메일에 답장하여 신청자에게 확인 메일을 보내 주세요.',
        '확인 메일에는 상품·수량·픽업 공연을 안내해 주세요. 확인 메일 수령 후 예약이 확정됩니다.',
        '현장 수령 시 신청자 성함과 휴대폰 번호 뒤 4자리를 확인해 주세요.'
    ])
    return '\n'.join(lines)
