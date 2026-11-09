# ISCU URL Shortener (클라우드 컴퓨팅 종합 실습 과제)

1~7주차 실습을 바탕으로 완성한 URL Shortener 서비스입니다. Next.js(App Router) + Neon Postgres로 만들고 Vercel에 배포합니다.

## 주요 기능

| 주차 | 기능 |
| --- | --- |
| 1주차 | GitHub 저장소와 Vercel 자동 배포 |
| 2주차 | URL 입력 화면과 입력값 검증(빈 값·길이·http/https·형식) |
| 3주차 | `POST /api/shorten`: SHA-256 해시 기반 6자리 shortCode 생성, 상태 코드(201/400/500) |
| 4주차 | Neon Postgres `urls` 테이블에 shortCode ↔ originalUrl 저장 |
| 5주차 | `GET /{shortCode}`: 307 Redirect(`Cache-Control: no-store`), 없으면 404 |
| 6주차 | 클릭 수·최근 클릭 시간 기록, `/admin` 통계 화면, `/api/stats` |
| 7주차 | Basic 인증·인가로 `/admin`(Proxy)과 `/api/stats`(Route) 보호 |

### 종합 과제에서 추가한 기능

1. **동일 URL 중복 처리**: 이미 단축한 URL을 다시 요청하면 DB에서 기존 shortCode를 찾아 `200`으로 반환합니다. (`lib/db.js`의 `findShortCodeByOriginalUrl`)
2. **자기 서비스 URL 단축 방지**: 요청을 받은 서비스의 호스트(Host 헤더, Vercel 배포 주소)와 같은 호스트의 URL은 경로·http/https와 관계없이 `400 SELF_URL`로 거부합니다. 다른 `*.vercel.app` 서비스는 정상적으로 단축됩니다. (`app/api/shorten/route.js`의 `isOwnServiceUrl`)

## API

| 요청 | 성공 | 실패 |
| --- | --- | --- |
| `POST /api/shorten` `{ "originalUrl": "https://..." }` | 새 URL `201`, 이미 단축한 URL `200` → `{ shortCode, shortUrl, originalUrl }` | `400 MISSING_URL` / `400 URL_TOO_LONG` / `400 INVALID_URL` / `400 SELF_URL` / `500 INTERNAL_ERROR` |
| `GET /{shortCode}` | `307` + `Location`, `Cache-Control: no-store` | `404` |
| `GET /admin`, `GET /api/stats` | Basic 인증(`admin` / `ADMIN_PASSWORD`) 성공 시 `200` | 인증 없음 `401` + `WWW-Authenticate: Basic` |

## 환경변수 (Vercel Project Settings → Environment Variables)

| 이름 | 설명 |
| --- | --- |
| `DATABASE_URL` | Neon Postgres 접속 문자열 (Vercel Storage에서 Neon을 연결하면 자동 추가) |
| `ADMIN_PASSWORD` | 관리자 비밀번호. `NEXT_PUBLIC_` 접두사를 붙이지 않습니다. |

`urls` 테이블과 클릭 기록 컬럼은 첫 요청 때 `CREATE TABLE IF NOT EXISTS`로 자동 생성되므로 SQL을 따로 실행하지 않아도 됩니다.

## 로컬 실행

```bash
npm install
npm run dev
```

`.env.local`에 `DATABASE_URL`, `ADMIN_PASSWORD`를 넣습니다. (`.env.local`은 GitHub에 올리지 않습니다.)

## 자동 점검 결과

수업 제공 `iscu_url_shortener_check.py`로 확인한 결과입니다.

| ID | 항목 | 로컬 (`--allow-local`) |
| --- | --- | --- |
| T01 | GET `/` → 200 | PASS |
| T02 | POST `/api/shorten` → 201 | PASS |
| T03 | 빈 입력 → 400 `MISSING_URL` | PASS |
| T04 | 잘못된 URL → 400 `INVALID_URL` | PASS |
| T05 | 같은 URL → 같은 shortCode | PASS |
| T06 | Redirect 307 + Location | PASS |
| T07 | 없는 shortCode → 404 | PASS |
| T08 | `Cache-Control: no-store` | PASS |
| T09 | 인증 없는 `/admin`, `/api/stats` → 401 | PASS |
| T10 | 자기 서비스 URL → 400 | PASS |
| T11 | 다른 Vercel 서비스 URL → 201 | PASS |
| | **합계** | **20 / 20** |
