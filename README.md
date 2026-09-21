# Sakarin Cosmos

음악, 공연 기록, 아카이브, 오브젝트와 현장 픽업 신청을 위한 정적 웹사이트입니다.

## 실행

프로젝트 루트에서 다음 명령을 실행하고 `http://localhost:8000`을 엽니다.

```sh
python3 server.py
```

페이지를 실행하는 데 Node.js나 빌드는 필요하지 않습니다. Tailwind CSS와 웹폰트, 일부 이미지는 외부 네트워크를 사용합니다. 이메일 발송에는 별도의 SMTP 환경변수 설정이 필요합니다. [메일 설정](docs/EMAIL_SETUP.md)을 참고하세요. `.env.example`은 설정 예시이며 `server.py`가 `.env`를 자동으로 읽지는 않습니다.

## 구조

```text
index.html                 홈 (리다이렉트 없이 바로 표시)
transmissions.html         음악·영상
observations.html          공연 타임라인·달력
archive.html               사진·영상·기록
objects.html               물품·개별 픽업 신청
cart.html                  장바구니·일괄 픽업 신청
assets/
  css/
    site.css               공통 헤더·푸터·접근성 스타일
    media.css              반응형 Instagram·YouTube·SoundCloud 임베드
    pages/                 페이지별 스타일
  js/
    theme.js               공통 Tailwind 디자인 토큰
    i18n.js                언어·경로·문구·숫자/날짜 형식
    site.js                공통 헤더·푸터·모바일 메뉴
    catalog.js             공통 일정·상품 로딩, 서울 날짜 기준 마감
    media.js               콘텐츠 주소 로딩·공식 임베드 생성
    media-feed.js          콘텐츠 카드·최신순 정렬·서비스별 필터
    dialog.js              신청 창 키보드·초점 관리
    cart-store.js          상품·사이즈별 장바구니 저장과 개수 표시
    reservation.js         개별 픽업 신청 폼
    pages/                 페이지별 동작
locales/
  ko.js                    한국어 공통 문구
  en.js                    영어 공통 문구
  ja.js                    일본어 공통 문구
data/catalog.json          공연 일정·픽업 가능 여부·상품 가격·사이즈
data/media.json            실제 SNS 콘텐츠·게시일·표시 여부
server.py                  개발용 정적 서버·메일 발송 API
reservation_service.py     서버의 공연·상품·사이즈·수량 검증
package.json               브라우저 테스트용 개발 의존성
package-lock.json          테스트 의존성 버전 고정
.env.example               메일 서버 설정 예시
tests/                     정적 검사·브라우저 회귀 검사
docs/
  DESIGN.md                기존 디자인 명세
  EMAIL_SETUP.md           메일 발송 설정
  I18N.md                  다국어 페이지 추가 방법
  MEDIA.md                 실제 콘텐츠와 임베드 연결 방법
  SITE_REVIEW.md           확인된 후속 작업과 우선순위
```

모든 페이지가 동일한 헤더와 디자인 토큰을 사용합니다. 페이지 식별은 `<html data-page="…">`를 사용하며, 메뉴를 바꾸려면 `assets/js/site.js`를 수정합니다. 브랜드 이름과 실제 표시용 SNS 핸들은 콘텐츠로 유지하고, 파일·폴더 이름에서 프로젝트 접두어를 제거했습니다. 이전 중첩 URL은 새 루트 HTML로 바뀌었으므로, 기존 주소를 공개한 적이 있다면 배포 서버에서 리다이렉트를 설정해야 합니다.

## 픽업 신청과 모바일 화면

공연과 상품은 `data/catalog.json`을 기준으로 표시하고 서버에서도 같은 데이터로 검증합니다. `pickup: true`인 공연 중 **서울 시간으로 공연일이 지나지 않은 공연**만 신청할 수 있습니다. 예를 들어 9월 19일 공연은 서울 시간 9월 20일 00:00부터 마감됩니다. 페이지를 열어 둔 채 날짜가 바뀌는 경우도 갱신하며, 서버가 제출 시 다시 확인합니다. 아직 공연일인 경우에는 신청할 수 있습니다.

티셔츠는 S/M/L/XL을 선택해서 담고, 장바구니에서도 사이즈를 바꾸거나 다른 사이즈를 추가할 수 있습니다. 상품+사이즈별 수량은 1–9개이며, 선택이 같은 항목은 합쳐집니다. 이전 장바구니의 티셔츠는 수량을 유지하고 사이즈를 다시 선택하도록 안내합니다. 키링·출판물 등은 사이즈가 없습니다. 신청 메일에는 상품별 사이즈·수량이 포함되고, 발송에 성공한 항목만 장바구니에서 차감합니다. 실패하면 그대로 보관합니다.

모바일에서는 공연 목록과 장바구니를 세로로 배열하고 필터·제목·버튼이 줄바꿈됩니다. 신청 폼은 화면 높이에 맞게 스크롤되며 Escape 닫기와 키보드 초점 이동을 지원합니다.

공식 Instagram·YouTube·SoundCloud 계정을 연결했습니다. 공개 목록에서 확인한 Instagram 게시물 6개, YouTube 영상 1개, SoundCloud 음원 1개를 `data/media.json`에서 관리합니다. 아카이브는 전체, 음악 페이지는 음악·영상을 최신순으로 표시하며 홈도 같은 목록을 사용합니다. 필요 없는 항목을 삭제하거나 `enabled`를 `false`로 바꾸면 모든 페이지에서 제외됩니다. 직접 음원 파일은 연결하지 않습니다. [콘텐츠 관리 안내](docs/MEDIA.md)를 참고하세요.

## 다국어 준비 상태

실제 페이지·콘텐츠를 먼저 구성하기 위해 본문 번역과 언어 선택 UI는 보류했습니다. 기존 ko/en/ja 공통 사전과 경로 기반만 유지합니다. 영어·일본어 본문 페이지와 언어 버튼은 아직 공개하지 않습니다. [다국어 작업 안내](docs/I18N.md)에 추후 작업 절차를 정리했습니다.

## 검증

정적 문서, 내부 링크·앵커, JavaScript 문법은 Python 3와 Node.js로 검사합니다.

```sh
python3 tests/check_site.py
```

브라우저 검사는 개발 의존성과 Chromium을 설치한 뒤 실행합니다.

```sh
npm ci
npx playwright install chromium --only-shell
npm test
```

브라우저 테스트는 임시 포트에서 로컬 서버를 시작하고 종료합니다. 여섯 페이지의 메뉴 이동·헤더와 320–1440px 레이아웃, 상품별 사이즈·주문 실패 재시도·이전 장바구니 이관, 서울 자정 경계·열어 둔 창의 마감 처리, 번역 사전과 경로를 확인합니다. 임베드는 Instagram·곡·플레이리스트·영상의 크기, 필터 변경, 정렬·삭제·숨김 반영과 오류 처리도 검사합니다. 서버 테스트는 유효하지 않은 공연·사이즈·수량을 거절하고 메일 본문에 사이즈가 들어가는지 검사합니다. 신청 API와 외부 플레이어는 모의 응답을 사용하며 실제 이메일은 보내지 않습니다. 실제 SNS 임베드 표시와 SoundCloud·YouTube 재생도 별도로 확인했습니다. 본문 레이아웃 확인을 위해 Tailwind CDN에 접근할 수 있어야 합니다.
