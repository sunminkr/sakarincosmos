# SNS 콘텐츠 관리

2026-09-21에 확인한 공개 목록을 등록했습니다. 사이트 안내는 한국어·영어·일본어로 표시하며, 작품명과 SNS 게시물·임베드는 공식 계정의 원문을 유지합니다.

| 계정 | 등록한 콘텐츠 |
| --- | --- |
| [Instagram @sakarincosmos](https://www.instagram.com/sakarincosmos/) | 선택한 사진·릴스. 협업 계정 게시물 포함 |
| [YouTube @sakarincosmos](https://www.youtube.com/@sakarincosmos) | 공개 영상 1개 |
| [SoundCloud sakarincosmos159](https://soundcloud.com/sakarincosmos159) | 공개 음원 1개 |

공개 목록에서 확인한 시점의 스냅샷입니다. 새로운 게시물이 자동으로 추가되지는 않습니다. 비공개·삭제된 게시물, 스토리·하이라이트는 목록에 포함하지 않습니다.

## 필요 없는 콘텐츠 삭제·숨김

`data/media.json`의 `entries`에서 해당 항목 전체를 삭제하거나, `"enabled": true`를 `"enabled": false`로 바꾼 뒤 `python3 scripts/build_locales.py`를 실행합니다. JSON과 갱신된 세 언어의 HTML을 함께 배포합니다. 사이트에서만 제외되며 원본 SNS 게시물은 변경하지 않습니다.

홈·음악 페이지·아카이브가 같은 목록을 사용하므로 한 번만 수정하면 됩니다. 남은 항목이 적으면 홈 미리보기 열 수가 줄어들고, 항목이 없으면 빈 목록 안내를 표시합니다. 홈 최신 음악·영상, 최근 기록과 필터 개수도 자동으로 갱신됩니다. 마지막 쉼표 등 JSON 문법에 주의하세요.

| 항목 ID | 콘텐츠 |
| --- | --- |
| `youtube-i7-C-GW8MZ8` | 그럼에도 계속되는 것 · 클럽 빵 전체 공연 영상 |
| `instagram-DddvgjZR5xC` | 9월 19일 클럽 빵 라이브 릴스 (`clubbbang`) |
| `instagram-DbxKf9WhgXe` | 8월 7일 공연 안내 (`idiots.band`) |
| `soundcloud-2336597921` | C코드혁명(demo) |
| `instagram-DZZkpWwTPwN` | 6월 10일 첫 릴스 |

## 표시와 정렬

- 아카이브: 세 SNS의 등록된 콘텐츠 전체를 게시일 기준 최신순으로 표시합니다. 서비스별 필터를 제공합니다.
- 음악 페이지: SoundCloud와 YouTube를 최신순으로 표시합니다.
- 홈: 가장 최근 음악·영상 한 개와 그 항목을 제외한 최근 기록 세 개를 표시합니다.
- 음악·영상은 카드 안에서 바로 임베드를 볼 수 있습니다. Instagram은 일정한 높이의 미리보기로 표시하며, 미리보기 또는 **Instagram에서 더 보기**를 누르면 새 창에서 원본을 엽니다. 필터 변경으로 빠지는 iframe은 제거합니다.
- 콘텐츠마다 원본 링크가 있어 외부 임베드를 표시하지 못하는 환경에서도 해당 서비스로 이동할 수 있습니다.

`publishedAt`은 공연일이 아닌 **게시일**입니다. YouTube와 SoundCloud는 공개 데이터의 게시 시각을 저장하고 서울 시간으로 날짜를 표시합니다. Instagram은 공개 페이지에서 확인한 날짜를 저장하며, 시각을 임의로 추정하지 않습니다. 같은 날짜의 Instagram 게시물은 `sourceOrder`에 기록한 프로필 표시 순서를 유지합니다.

## 항목 추가

`entries` 안에 고유한 키로 항목을 추가합니다. 필수값은 `url`이며, 나머지 콘텐츠 정보도 함께 채우는 것이 좋습니다.

| 필드 | 용도 |
| --- | --- |
| `url` | 공개 SoundCloud 곡·플레이리스트, YouTube 영상, Instagram `/p/…/` 또는 `/reel/…/` 주소 |
| `title` | 화면에 표시할 제목. 본문이 없는 Instagram 사진에는 일반적인 사진 제목 사용 |
| `description` | 설명. 긴 Instagram 캡션은 복사하지 않고 원본 링크에서 확인 |
| `publishedAt` | 날짜 `YYYY-MM-DD` 또는 시간대가 있는 ISO 시각 |
| `datePrecision` | 날짜만 확인했으면 `day`, 정확한 시각이 있으면 `second` |
| `author` | 원본 작성자 핸들. 협업 게시물의 작성자도 보존 |
| `sourceOrder` | 동일 게시일의 원본 목록 순서. 선택 사항 |
| `enabled` | `false`로 설정하면 모든 페이지에서 숨김 |

추가·수정한 뒤 `python3 scripts/build_locales.py`로 정적 HTML도 갱신합니다. 실행 환경에 별도 빌드 서버는 필요 없습니다. 제목·날짜·설명·원본 링크는 HTML에 들어가며, 브라우저의 데이터 요청이 실패해도 유지됩니다. URL 대신 전체 iframe 코드를 붙이지 않습니다. SoundCloud의 공유 → Embed 코드에 들어 있는 `src` 주소는 지원하며 자동 재생은 끕니다. 직접 음원 파일과 API 키는 사용하지 않습니다.

Instagram은 공식 `embed.js`의 캡션 없는 임베드를 사용합니다. 미리보기는 모바일과 데스크톱 모두 사진의 3:4 비율에 프로필 영역 64px을 더한 높이로 표시합니다. 하단 그라데이션 없이 사진 전체를 보여 줍니다. 외부 서비스가 iframe 높이를 나중에 바꿔도 미리보기 영역 밖으로 카드가 늘어나지 않습니다. 긴 제목은 두 줄까지만 표시합니다. 미리보기 안의 잘린 조작 버튼에 키보드 초점이 들어가지 않도록 하고, 원본 링크는 항상 미리보기 바깥에 표시합니다. 규격은 `assets/css/media.css`의 `.instagram-preview`에서 변경합니다. 모바일에서는 기본 최소 너비 326px도 화면 안에 맞춥니다.

SoundCloud는 640px 미만 화면에서 생성할 때 커버를 배경으로 표시하는 visual 플레이어를 사용해 파형이 가로 전체를 사용하도록 합니다. 트랙은 1:1 비율을 기본으로 높이 280–450px, 플레이리스트는 450px입니다. 데스크톱에서 생성한 트랙은 기존 가로형 166px을 유지합니다. 화면 회전 중에는 플레이어를 다시 로드하지 않아 재생이 끊기지 않습니다. YouTube는 16:9를 기본으로 하되 높이 200px 이상을 확보합니다.

참고: [SoundCloud Widget](https://developers.soundcloud.com/docs/api/html5-widget), [YouTube 플레이어](https://developers.google.com/youtube/player_parameters), [Instagram 공개 게시물 임베드 안내](https://help.instagram.com/620154495870484).

## 검증과 남은 콘텐츠

`npm test`는 실제 목록의 정렬·서비스별 필터·개수, 삭제/숨김의 전체 페이지 반영, 오류와 빈 목록, 320/390/768/1440px 임베드 크기, 공식 SNS 링크 및 기존 픽업 기능을 검사합니다. 자동 회귀 검사에서는 외부 플레이어를 모의 응답으로 대체하며, 실제 SNS 임베드 표시와 SoundCloud·YouTube 재생을 확인했으며, 삭제 후 남은 콘텐츠와 긴 Instagram 게시물의 고정 미리보기도 검사합니다.

홈 첫 화면은 `assets/images/band/sakarin-cosmos-live.jpeg`의 밴드 사진을 사용합니다. 세 언어의 홈에서 같은 파일을 공유하며, 모바일에서도 세 멤버가 잘리지 않도록 사진 전체를 표시합니다. 하단 소개 영역의 배경에는 기존 디자인용 예시가 남아 있습니다. 공연·상품 목록은 전달받은 실제 정보로 교체했으며, 로고 티셔츠 이미지는 비워 두었습니다. PRESS KIT와 SMTP 운영 설정은 후속 작업입니다.
