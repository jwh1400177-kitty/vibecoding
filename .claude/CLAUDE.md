# VCA 미디어 모니터링 시스템 — CLAUDE.md

## 프로젝트 개요

- **클라이언트:** Van Cleef & Arpels (반클리프 아펠)
- **목적:** 자사 및 경쟁사 관련 기사를 매일 자동 수집 → 구글 시트 저장 → 매일 오전 8시 이메일 발송
- **언어:** Python 3.10+
- **핵심 원칙:** GAS(Google Apps Script) 없이 Python 단일 스택으로 구현

---

## 모니터링 대상 브랜드

### 자사 (VCA)
- Van Cleef & Arpels (반클리프 아펠)

### 경쟁사 (Competitors) — 11개
- Cartier, Piaget, Chaumet, Chopard, Tiffany & Co
- Bvlgari, Graff, Chanel Jewelry, Boucheron, Dior Jewelry, Louis Vuitton Jewelry

---

## 수집 전략 (확정)

### 포털 (네이버/다음/구글/빙)
- **전체 브랜드 키워드로 수집** (VCA + 경쟁사 11개 모두)
- 네이버: API + Naver RSS + Google RSS 전체 동시 실행 (폴백 아님, 전부 실행)
- **모든 소스 동일 규칙**: title OR summary에 브랜드 키워드 있으면 통과, 없으면 제거
  - 소스별 예외 없음 (Naver/Google/Bing/Daum/Web/Instagram 모두 동일)

### 웹사이트 (56개 패션/럭셔리 매체)
- **VCA 키워드만 수집** (경쟁사 기사는 웹사이트에서 수집 안 함)
- **키워드 필터 적용** — 제목에 브랜드 키워드 없으면 제거

### 인스타그램 (62개 채널)
- **VCA 키워드만 수집**
- Google News RSS로 인스타그램 관련 기사 수집 (직접 API 불안정)
- **키워드 필터 적용** — 제목에 브랜드 키워드 없으면 제거
- 글로벌 VCA 검색 먼저 실행 후 채널별 검색

---

## 수집 소스 및 Python 최적 방법

### 1. 네이버 뉴스
- **1순위:** 네이버 검색 API (NAVER_CLIENT_ID 있을 때)
  - `requests` 라이브러리로 직접 호출
  - display=100, sort=date
- **2순위:** 네이버 뉴스 RSS (`feedparser` 라이브러리)
- **3순위:** Google News RSS (`feedparser`)
- ⚠️ 세 가지 모두 동시 실행 (폴백이 아닌 수집 극대화)

### 2. 다음 뉴스
- Google News RSS (`site:daum.net` + 키워드)
- 타임아웃: 3초

### 3. 구글/빙 뉴스 RSS
- `feedparser` 라이브러리로 파싱
- Google News RSS: `https://news.google.com/rss/search?q={keyword}&hl=ko&gl=KR`
- Bing News RSS: `https://www.bing.com/news/search?q={keyword}&format=RSS`

### 4. 패션/럭셔리 웹사이트 (56개)
- `requests` + `BeautifulSoup` (bs4)
- User-Agent 헤더 설정 필수 (차단 방지)
- 접속 실패 시 → Google Cache RSS → Bing RSS 순으로 폴백
- 타임아웃: 8초

### 5. 인스타그램 (62개 채널)
- Google News RSS (`site:instagram.com` + VCA 키워드) 글로벌 검색 우선
- 이후 채널별 검색 (URL 중복 제거)
- ⚠️ 완전한 자동화 어려움 → 수동 보완 또는 별도 유료툴 병행 권장

---

## 키워드 구성 (BRAND_SEARCH_KEYWORDS, config.py)

### VCA (반클리프 아펠)
```python
"Van Cleef & Arpels", "Van Cleef", "반클리프", "반클리프아펠", "반 클리프"
```
- "알함브라" 제외 — 스페인 그라나다 알함브라 궁전 등 무관 기사 혼용
- "페리도" 제외 — 단독 사용 시 오탐 발생
- "반클리프 아펠" (공백 있는 버전) 제외 — "반클리프"로 커버됨

### Tiffany & Co
- "티파니" 단독 제외 — 연예인 소녀시대 티파니(박티파니)와 혼용됨
```python
"Tiffany & Co", "티파니앤코", "티파니 앤 코"
```

### Bvlgari
```python
"Bvlgari", "Bulgari", "불가리", "블가리"
```

### Graff
- "그라프" 단독 제외 — 너무 넓은 범위
```python
"Graff", "그라프 다이아몬드", "그라프 주얼리"
```

### Dior Jewelry
- "Dior" 단독 제외 — 패션/뷰티 기사 혼용
```python
"Dior Jewelry", "디올 주얼리", "디올 파인주얼리"
```

---

## 구글 시트 구조 (핵심)

### 컬럼 구성 (A~I열) — 모든 탭 공통

| 열 | 컬럼명 | 내용 |
|----|--------|------|
| A | 수집날짜 | 코드 실행 날짜 (오늘, yyyy-MM-dd) |
| B | 발행날짜 | 기사 원문 발행일 |
| C | 브랜드명 | Van Cleef & Arpels / Cartier 등 |
| D | 카테고리 | VCA 또는 Competitor |
| E | 기사제목 | HTML 태그 제거된 순수 텍스트 |
| F | 링크 | 기사 원문 URL |
| G | 출처 | 미디어사명 |
| H | 미디어타입 | MM/O/SNS/TGD/BD/WM |
| I | 비고2 | 유사기사 N건 또는 빈칸 |

### 탭 구성 및 역할 (중요!)

| 탭 | 역할 | 중복 제거 기준 |
|----|------|----------------|
| 브랜드별 탭 12개 | **원본 데이터** — 키워드검증+URL 중복 제거 후 저장 | 키워드+URL 중복 |
| `전체종합` | 전체 기사 종합 (브랜드탭과 동일 기준) | 키워드+URL 중복 |
| `All_Competitors` | 경쟁사 전체 종합 | 키워드+URL 중복 |
| `이메일전송최종본` | **이메일용 최종본** — Jaccard 중복 제거까지 완료 | 키워드+URL+Jaccard |
| `웹사이트_일별수집` | **웹 원본 전체** — 키워드 필터 전 56개 사이트 수집 결과 (모니터링용) | 없음 |
| `Duplicate_Check` | URL 해시 기록 (참조용, 중복 판단에는 미사용) | — |
| `Error_Log` | 수집 오류 로그 | — |
| `Config` | 설정값 | — |

> ⚠️ 이메일 발송은 항상 `이메일전송최종본` 기준
>
> ⚠️ `웹사이트_일별수집` 탭은 VCA 필터 전 전체 웹 수집 결과 (컬럼: 수집날짜/발행날짜/사이트명/기사제목/링크)

### 미디어타입 코드
- MM: 월간지 (Vogue, Harper's Bazaar, GQ 등)
- O: 온라인 뉴스
- SNS: 인스타그램
- TGD: 포털/종합 (Naver, Daum, Google, Bing)
- BD: 비즈니스 (한경, Fortune 등)
- WM: 주간지

---

## 파이프라인 구조 (핵심 — 5단계)

```
1단계: 수집 (포털 + 웹사이트 + 인스타그램)
       ↓
2단계: HTML 태그 정리 (filter_articles) — 블랙리스트/화이트리스트 없음
       ↓
3단계: 키워드 검증 필터 (filter_by_keyword)
       → 모든 소스 동일 규칙: title OR summary에 브랜드 키워드 있으면 통과
       → 소스별 예외 없음 (Naver/Daum/Google/Bing/Web/Instagram 동일)
       ↓
4단계: URL 중복 제거 (deduplicate_url_only)
       → **브랜드별** 중복 체크 (seen_by_brand: dict — 같은 URL도 다른 브랜드면 중복 아님)
       → 당일 배치 내에서만 중복 판단 (Duplicate_Check 탭 참조 X)
       → 브랜드별 탭 저장 (키워드 통과 기사만)
       → Duplicate_Check 탭에 해시 추가 (참조용)
       ↓
5단계: 제목 유사도 중복 제거 (deduplicate_title_only)
       → SNS(media_type==SNS) 기사는 Jaccard 비교 없이 무조건 통과 — 짧은 제목 오탐 방지
       → 같은 브랜드 내 2-gram Jaccard ≥ 0.6 → 중복
       → 소스 우선순위 기준 1건 유지
       → 2차 그룹 중복 제거 (동일 인물/주제어 3건 이상)
       → 이메일전송최종본 탭 저장
       → 이메일 발송
```

---

## 중복 제거 로직

### URL 중복 제거 (deduplicate_url_only — 브랜드탭용)
- URL 정규화: http→https, www 제거, 트래킹 파라미터 제거
- **기사 식별자(idxno, aid, no 등)는 유지** — 다른 기사가 같은 URL로 처리되는 오류 방지
- 제거 파라미터: utm_*, ref, fbclid, gclid, sid, m, mobile 등
- ⚠️ **`from`, `type`, `mode` 제거 안 함** — 일부 사이트에서 기사 식별자로 사용 (예: `?from=1001`, `?type=3`)
- **중복 판단 기준: (brand, url_hash) 페어** — 같은 URL이 다른 브랜드로 수집된 경우는 중복 아님
  - 예: allurekorea 멀티브랜드 기사("소장가치 500%" 등)가 여러 브랜드 탭에 모두 저장됨 → 정상 동작
  - 구현: `seen_by_brand: dict = defaultdict(set)` — 브랜드별 독립 seen_urls 관리
- **당일 배치 내에서만 중복 판단** — Duplicate_Check 탭의 누적 데이터 참조 X
  - 이유: 누적 데이터 참조 시 오늘 기사도 전부 "이전 중복"으로 판정되는 버그 발생

### 키워드 검증 (filter_by_keyword)
- **모든 소스 동일 규칙**: title OR summary에 BRAND_SEARCH_KEYWORDS 키워드(따옴표 제거 후) 포함 여부 확인
  - 소스별 예외 없음 (Naver/Daum/Google/Bing/Web/Instagram 동일)
  - title + summary 합쳐서 키워드 체크 (summary 없으면 title만으로 판단)
- **portals.py `summary` 필드**: RSS `description`/Naver API `description`을 `summary` 키로 저장 — 키워드 판단에 사용

### 제목 유사도 중복 제거 (deduplicate_title_only — 이메일용)
- **SNS(media_type=="SNS") 기사는 Jaccard 비교 완전 제외** — 짧은 인스타그램 제목은 오탐률 높아 무조건 이메일전송최종본 포함
- 같은 브랜드 내에서만 비교 (브랜드 간 비교 없음)
- 출처 접미사 제거 후 2-gram Jaccard 유사도 ≥ 0.6 → 중복 판단
- 소스 우선순위 높은 기사 유지, 비고2에 "유사기사 N건" 누적
- 2차 그룹 중복 제거: 동일 2~3글자 한국어 토큰 3건 이상 → 1건 유지

### 소스 우선순위 (낮은 숫자 = 높은 우선순위)
```
1순위: 패션 전문 매체 (media_type=MM 또는 WM)
2순위: 네이버 (Naver News, Naver RSS)
3순위: 다음 (Daum News)
4순위: 구글뉴스 (Google News)
5순위: 빙뉴스 (Bing News)
6순위: 기타
```

---

## 날짜 수집 기준

```
월요일 실행 → 금~일 발행 기사 (3일치)
화~금 실행  → 어제 발행 기사 (1일치)
토·일        → 수집 없음 (--force 플래그로 강제 실행 가능)

A열 수집날짜 = 오늘 (코드 실행일)
B열 발행날짜 = 기사 원문 발행일
```

---

## 이메일 형식

### 제목
```
[VCA 미디어 모니터링] 2026년 3월 27일 (금) — 총 N건
```
- N = 이메일전송최종본 기사 수 (키워드검증+Jaccard중복제거 후)

### 섹션 구조 (report.py)
```
1. 헤더 (날짜, 총건수)
2. [Section 1] VCA 소스별 현황 — VCA 기사만 집계 (5컬럼)
   VCA수집 | URL중복 | 시트저장 | 중복제거(Jaccard) | 이메일노출
   소스별: 네이버 / 다음 / 구글뉴스 / 웹사이트 / 인스타
   (웹/인스타는 URL중복 항목 "-" 표시)
3. [Section 2] 전체 수집 현황 요약 (소스별 수집/URL중복/키워드제거/제목유사/시트저장/이메일노출/VCA/경쟁사)
4. [Section 3] 브랜드별 저장 현황 (시트저장/이메일노출 — 자사/경쟁사 구분)
5. Van Cleef & Arpels 상세 테이블
6. Competitors News 통합 테이블 (브랜드명 컬럼 포함, ALL_BRANDS 순서)
7. [Section 6] 웹사이트 56개 개별 수집 현황
8. 범례 + 구글 시트 링크
9. 푸터
```

### 디자인 규칙
- 이모지 완전 제거
- 심플 테이블 레이아웃 (인라인 CSS, 네이버 메일 호환)
- 폰트: Malgun Gothic, Arial, sans-serif
- 헤더: 배경 #222222, 글자 흰색
- 데이터 행 교차색: #f9f9f9 / #ffffff
- 기사제목 최대 60자 (초과 시 "..." 처리)
- 건수 제한 없이 전체 발송

### 기사 테이블 컬럼 (7개)
```
No | 발행일 | 브랜드명 | 기사제목(링크) | 미디어 | 타입 | 비고2
```

---

## 기사 정렬 기준

### VCA 기사 테이블
```
1순위: 발행날짜 내림차순
2순위: 기사제목 가나다/알파벳 오름차순
3순위: 출처 오름차순
```

### 경쟁사 통합 테이블 (ALL_BRANDS 순서 그룹화)
```
그룹 순서: ALL_BRANDS 리스트 순서 유지 (VCA 이후 경쟁사들)
각 브랜드 내 정렬:
  1순위: 발행날짜 내림차순
  2순위: 기사제목 가나다/알파벳 오름차순
```

---

## Python 핵심 라이브러리

```python
# 수집
requests          # HTTP 요청
feedparser        # RSS 파싱
beautifulsoup4    # HTML 파싱
lxml              # HTML 파서

# 구글 시트 연동
gspread           # 구글 시트 읽기/쓰기
google-auth       # 구글 OAuth 인증

# 이메일 발송
smtplib           # Python 내장 (Gmail SMTP)

# 유틸리티
python-dotenv     # 환경변수 관리 (.env 파일)
```

---

## 환경변수 (.env 파일로 관리)

```
SPREADSHEET_ID=구글시트ID
ADMIN_EMAIL=수신자1@email.com
ADMIN_EMAIL2=수신자2@email.com
NAVER_CLIENT_ID=네이버API_ID
NAVER_CLIENT_SECRET=네이버API_SECRET
GMAIL_USER=발신자@gmail.com
GMAIL_APP_PASSWORD=앱비밀번호
GOOGLE_CREDENTIALS_PATH=credentials.json경로
```

---

## 파일 구조 (현재)

```
vca_monitoring_python/
├── CLAUDE.md              # 이 파일 — 프로젝트 인수인계 문서
├── .env                   # 환경변수 (git 제외)
├── credentials.json       # 구글 서비스 계정 키 (git 제외)
├── requirements.txt       # 라이브러리 목록
├── main.py                # 메인 실행 파일
├── config.py              # 브랜드/사이트/설정 상수
├── test_dedup.py          # dedup.py 단위 테스트
├── collector/
│   ├── portals.py         # 네이버/다음/구글/빙 수집
│   ├── web.py             # 56개 웹사이트 수집
│   └── instagram.py       # 인스타그램 수집
├── processor/
│   ├── filter.py          # HTML 정리 + 키워드 검증 (filter_by_keyword)
│   └── dedup.py           # URL중복/제목유사 중복 제거 (두 단계 분리)
├── storage/
│   └── sheets.py          # 구글 시트 저장/조회 (브랜드탭 + 이메일전송최종본)
├── mailer/
│   └── report.py          # HTML 이메일 생성 및 발송
└── utils/
    ├── date_utils.py      # 날짜 처리
    └── logger.py          # 로그 관리
```

---

## 실행 방식

```bash
# 전체 파이프라인 즉시 실행 (평일)
python main.py

# 포털만 테스트
python main.py --batch portals

# 이메일만 재발송 (이메일전송최종본 탭 기준)
python main.py --send-only

# 특정 날짜 수집
python main.py --date 2026-03-26

# 토·일에도 강제 실행 (테스트용)
python main.py --force

# 시트 전체 초기화 (헤더 유지)
python main.py --clear-all

# 단위 테스트
python test_dedup.py
```

---

## 자동 스케줄 (윈도우 작업 스케줄러)

- 매일 07:00 KST → `python main.py` 실행
- 수집 완료 후 자동 이메일 발송
- 토·일 실행 시 자동 스킵

---

## 코딩 규칙

- 모든 주석은 한국어로 작성
- 함수명/변수명은 영어 snake_case
- 오류 발생 시 Error_Log에 기록 후 계속 진행 (전체 중단 금지)
- 각 수집 소스는 독립적으로 동작 (하나 실패해도 나머지 계속)
- 로그는 실시간으로 콘솔 출력

---

## 알려진 한계 및 주의사항

- **인스타그램**: 공식 API 없이 완전 자동화 어려움. Google News RSS로 간접 수집.
- **다음 뉴스**: 직접 접속 불안정, RSS만 사용 (Google RSS `site:daum.net`).
- **Graff**: 단독 한국어 "그라프" 너무 넓은 범위 → 주얼리 조합 키워드만 사용.
- **Tiffany**: "티파니" 단독 제외 → 소녀시대 티파니(박티파니) 연예인 기사 혼용 방지.
- **Jaccard 0.6 기준**: 너무 낮으면 오탐, 너무 높으면 누락. 현재 60% 적용.
- **URL 정규화**: 기사 식별자 파라미터(idxno, aid 등) 유지 필수 — 제거 시 다른 기사가 같은 URL로 처리됨.
- **URL 중복 체크**: Duplicate_Check 탭 누적 데이터를 참조하면 오늘 기사도 전부 중복으로 판정됨 → 당일 배치 내에서만 체크.
- **다음 뉴스 키워드 필터**: 모든 소스와 동일하게 title OR summary에 브랜드 키워드 없으면 제거. 과거 VCA Daum bypass 규칙이 있었으나 무관 기사("9개월 경력 AI 연봉" 등) 유입으로 제거함 (v1.6).
- **Daum News RSS summary 특성**: Google News RSS description은 HTML `<a>` 태그 링크만 반환. HTML 제거 후 실질적 summary 없음 → title 키워드만으로 판단됨.
- **멀티브랜드 기사**: 하나의 기사가 복수 브랜드 키워드를 모두 포함하면 각 브랜드 탭에 중복 저장됨 → 정상 동작 (버그 아님). 예: allurekorea 주얼리 종합 기사가 6개 브랜드 탭에 모두 저장.
- **SNS Jaccard 완전 제외**: 인스타그램 제목은 짧아 관련 없는 기사끼리 Jaccard 0.6 이상 나오는 오탐 발생 → 무조건 통과.
- **URL 정규화 `from`/`type`/`mode` 미제거**: 일부 언론사 CMS에서 기사 식별자로 사용 (예: `?from=1001` = 코너ID). 제거 시 다른 기사가 동일 URL로 처리됨.
- **VCA 키워드 알함브라/페리도 제외**: "알함브라" = 스페인 궁전 기사 대량 혼입, "페리도" = 단독 사용 시 오탐. 제거 후 VCA 이메일 노출 정상 유지 확인.
- **SNS _group_dedup 제외**: `_group_dedup` 함수에서 media_type=="SNS" 기사를 token_to_idxs 매핑에서 완전 제외 — 짧은 인스타그램 제목의 토큰 매칭 오탐으로 제거되던 버그 수정.
- **인스타그램 수집 건수 변동**: Google News RSS 캐시가 시간대별로 달라져 실행 시마다 결과 건수가 달라질 수 있음. filter_by_keyword 탈락이 아닌 수집 단계 변동 — 정상 범위.
- **웹사이트_일별수집 탭**: `collect_all_web`이 `(vca_articles, site_stats, all_web_articles)` 3개 값 반환. `all_web_articles`는 키워드 필터 전 원본 전체. `sheets.py::save_web_daily`가 이 탭에 저장.

---

*프로젝트명: VCA 미디어 모니터링 | 버전: v1.6 Python | 최종수정: 2026-04-01*
