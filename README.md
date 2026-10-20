# A&F Style Tracker

Abercrombie & Fitch · Hollister 상품의 컬러 × 사이즈별 재고, 가격·할인, 소재를 모으고, 매일 자동 수집으로 쌓이는 이력에서 주간 판매 추정을 계산합니다. 세아 스타일을 표시해 타사와 비교할 수 있습니다.

## 구성

| 경로 | 역할 |
|---|---|
| `public/index.html` | 화면 (한/영, 상품별 · 주간 리포트, 북마클릿 포함) |
| `api/capture.js` | `POST {url}` — 서버가 상품 페이지를 열어 바로 수집·저장 |
| `api/ingest.js` | `POST` — 북마클릿이 보낸 데이터 저장 (서버 수집이 막힐 때의 대안) |
| `api/styles.js`, `api/history.js`, `api/daily.js` | 조회 |
| `api/admin.js` | 세아 표시 / 해제 / 삭제 (헤더 `x-admin-key`) |
| `api/cron.js` | 매일 등록된 상품 전체 재수집 (Vercel Cron) |
| `lib/extract.js` | 상품 페이지 HTML → 데이터 추출 |
| `lib/store.js` | 저장과 일별 판매 추정 계산 |

판매 추정: 하루 전 수집과 비교해 줄어든 재고는 판매, 늘어난 재고는 입고로 계산하고, 추정 매출은 판매 수량 × 당시 판매가입니다.

## Vercel 배포 (처음 한 번)

1. **프로젝트 만들기**: Vercel 대시보드 → Add New… → Project → 이 GitHub 저장소 Import → Framework Preset은 `Other` 그대로 → Deploy.
2. **데이터베이스 연결**: 프로젝트 → Storage → Create Database → **Neon (Postgres)** 선택 → 이 프로젝트에 Connect. `DATABASE_URL` 환경변수가 자동으로 들어갑니다. 표는 첫 요청 때 자동으로 만들어집니다.
3. **환경변수 추가**: 프로젝트 → Settings → Environment Variables
   - `ADMIN_KEY` — 관리자 비밀번호 (세아 표시·삭제용). 원하는 값으로.
   - `CRON_SECRET` — 아무 긴 임의 문자열. 자동 수집 주소를 외부에서 못 부르게 막습니다.
4. **다시 배포**: Deployments → 최근 배포 ⋯ → Redeploy. (환경변수는 다시 배포해야 반영됩니다.)
5. **확인**: 사이트를 열고 A&F 상품 주소를 붙여넣어 추가 → 바로 결과가 나오면 끝.

자동 수집은 `vercel.json`에 매일 01:40 UTC(베트남 08:40)로 설정돼 있습니다. Hobby(무료) 플랜은 하루 1회 크론을 지원합니다.

## 서버 수집이 막힐 때

A&F가 서버 접속을 막으면 추가할 때 "서버 접속을 막았습니다" 메시지가 나옵니다. 그때는 화면의 **북마클릿 설치 방법**대로 북마크를 만들고, 상품 페이지에서 북마크를 누르면 데이터가 바로 저장됩니다(붙여넣기 불필요).

## 로컬 실행

```
npm install
npm test          # 메모리 DB로 API 전체 점검
npm run dev       # http://localhost:3000
```
