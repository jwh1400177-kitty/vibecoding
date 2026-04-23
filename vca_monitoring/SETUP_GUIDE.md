# VCA 미디어 모니터링 시스템 — 배포 가이드 v0.1a

---

## 파일 구성

| 파일 | 버전 | 역할 |
|------|------|------|
| `utils.gs` | v0.1a | 키워드 상수, 날짜/해시/브랜드탐지/Jaccard 유틸리티 |
| `sheet.gs` | v0.1a | PropertiesService 기반 시트 관리, 3단계 중복제거 |
| `collector_portals.gs` | v0.1a | Naver(API+HTML) / Daum(4단계폴백) / Google+Bing RSS |
| `collector_web.gs` | v0.1a | 웹 56개 (직접→GoogleCache→GoogleRSS→BingRSS) |
| `collector_instagram.gs` | v0.1a | Instagram 62개 (JSON→HTML→GoogleRSS) |
| `mailer.gs` | v0.1a | 이중수신자 HTML 이메일, 브랜드별 요약테이블 |
| `main.gs` | v0.1a | 배치 7개 + setup() + runNow() |

---

## ▶ 배포 순서

### STEP 1 — Google Apps Script 프로젝트 생성

1. **https://script.google.com** 접속
2. **새 프로젝트** → 이름: `VCA 미디어 모니터링`

---

### STEP 2 — 타임존 설정 (KST 필수)

1. GAS 에디터 좌측 **⚙ 프로젝트 설정** 클릭
2. **시간대** → `(GMT+09:00) 서울` 선택 → 저장

또는 `appsscript.json` 편집:
```json
{
  "timeZone": "Asia/Seoul",
  "runtimeVersion": "V8"
}
```

---

### STEP 3 — PropertiesService 등록 (스프레드시트 생성 전 필수)

> ⚠️ **이 시스템은 기존 구글 시트를 사용합니다. 새로 생성하지 않습니다.**

1. 모니터링 결과를 저장할 **구글 스프레드시트**를 미리 열기
2. URL에서 ID 복사: `https://docs.google.com/spreadsheets/d/**여기가ID**/edit`
3. GAS 에디터 → **⚙ 프로젝트 설정** → **스크립트 속성** → **속성 추가**

| 속성 이름 | 값 | 필수여부 |
|-----------|-----|---------|
| `SPREADSHEET_ID` | 위에서 복사한 시트 ID | **필수** |
| `ADMIN_EMAIL` | 이메일 수신자1 | **필수** |
| `ADMIN_EMAIL2` | 이메일 수신자2 | 선택 |
| `NAVER_CLIENT_ID` | 네이버 검색 API Client ID | 선택 |
| `NAVER_CLIENT_SECRET` | 네이버 검색 API Client Secret | 선택 |

---

### STEP 4 — 7개 .gs 파일 추가

GAS 에디터에서 아래 순서로 파일 추가:

1. 기본 `Code.gs` → 이름을 `utils`로 변경 → 내용 교체
2. **+** → 스크립트 → `sheet` → 내용 붙여넣기
3. 동일하게 `collector_portals`, `collector_web`, `collector_instagram`, `mailer`, `main` 추가

---

### STEP 5 — 권한 승인

1. 함수 드롭다운에서 `setup` 선택 → **▶ 실행**
2. **권한 검토** → 구글 계정 로그인
3. **고급** → **[프로젝트명](으)로 이동** → **허용**

허용 필요 권한:
- Google Sheets 보기/관리
- 이메일 보내기 (Gmail)
- 외부 서비스 연결 (UrlFetchApp)
- 스크립트 트리거 관리

---

### STEP 6 — setup() 실행

`setup` 함수 실행 시 자동 처리:
- ✅ 구글 시트에 **없는 탭만 생성** (기존 데이터 절대 유지)
  - 브랜드 탭 12개: VCA / Cartier / Piaget / Chaumet / Chopard / Tiffany / Bvlgari / Graff / Chanel_Jewelry / Boucheron / Dior_Jewelry / LV_Jewelry
  - 관리 탭 3개: Duplicate_Check / Error_Log / Config
- ✅ 트리거 7개 등록 (07:00~08:00 KST)
- ✅ 테스트 수집 (Google News, 반클리프, 최근 3일)
- ✅ 테스트 이메일 발송

---

### STEP 7 — 트리거 확인

GAS 에디터 → **⏰ 트리거** 메뉴에서 7개 확인:

```
runBatch1_Portals     매일 오전 7:00 (±15분)
runBatch2_Web1        매일 오전 7:10
runBatch3_Web2        매일 오전 7:20
runBatch4_Web3        매일 오전 7:30
runBatch5_Instagram1  매일 오전 7:40
runBatch6_Instagram2  매일 오전 7:50
runFinalReport        매일 오전 8:00
```

---

## ▶ 시트 구조

### 브랜드 탭 12개 (A~I열)

| 열 | 이름 | 설명 |
|----|------|------|
| A | 수집날짜 | 코드 실행 날짜 (yyyy-MM-dd) |
| B | 발행날짜 | 기사 원문 발행일 |
| C | 브랜드명 | Van Cleef & Arpels / Cartier 등 |
| D | 카테고리 | VCA 또는 Competitor |
| E | 기사제목 | HTML 태그 제거된 순수 텍스트 |
| F | 링크 | 기사 원문 URL |
| G | 출처 | 미디어사명 (Instagram은 Instagram-handle 형식) |
| H | 미디어타입 | MM/O/SNS/TGD/BD/WM |
| I | 비고 | 수집 경로 메모 |

### 미디어타입 코드

| 코드 | 의미 |
|------|------|
| MM | 월간지 (Vogue, Harper's Bazaar, GQ 등) |
| O | 온라인 뉴스 (Hypebeast, Eyes Mag 등) |
| SNS | 인스타그램 |
| TGD | 포털/종합 (Naver, Daum, Google, Bing) |
| BD | 비즈니스 (Fortune, Hankyung Money) |
| WM | 주간지 (Woman Sense, Woman Donga 등) |

### 중복 제거 3단계

1. **URL 정규화**: http→https, www 제거, 쿼리스트링 제거
2. **해시 비교**: Duplicate_Check 시트의 URL Hash와 비교
3. **제목 유사도**: 2-gram Jaccard ≥ 0.9면 중복 처리

---

## ▶ 수동 실행

```
# 전체 파이프라인 즉시 실행 (테스트용)
함수: runNow → 실행

# 배치별 개별 테스트
runBatch1_Portals   → 포털만
collectWebBatch1    → 웹 1~20만
collectInstagramBatch1 → IG 1~30만

# 이메일만 재발송
sendDailyReport → 실행 (isTest=false)
```

---

## ▶ 요일별 수집 범위

| 실행 요일 | 수집 기간 | 비고 |
|-----------|-----------|------|
| 월요일 | 금~일 (3일) | 주말 기사 소급 수집 |
| 화~금 | 어제 (1일) | |
| 토·일 | 없음 | 트리거는 실행되나 수집 건너뜀 |

---

## ▶ 네이버 API 키 발급 (선택)

1. **https://developers.naver.com** → 로그인
2. **Application 등록** → 서비스명 입력
3. **사용 API** → **검색** 선택
4. 등록 완료 후 **Client ID / Client Secret** 복사
5. PropertiesService에 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` 추가

> API 키 없어도 HTML 크롤링 + Google/Bing RSS로 대체 동작합니다.

---

## ▶ 자주 묻는 문제

**Q. "SPREADSHEET_ID가 등록되지 않았습니다" 오류**
→ STEP 3 다시 확인. PropertiesService에 SPREADSHEET_ID 추가 필요.

**Q. 기사가 0건**
→ Error_Log 탭 확인. 차단된 사이트는 4단계 폴백 모두 실패 시 0건.
→ `runBatch1_Portals` 단독 실행으로 포털만 테스트.

**Q. 트리거가 KST 기준으로 실행 안 됨**
→ STEP 2 타임존 설정 확인. `Asia/Seoul` 로 설정.

**Q. 기존 데이터가 삭제됨**
→ v0.1a는 절대 기존 탭/데이터를 삭제하지 않습니다. `initSheets()`는 없는 탭만 생성.

**Q. Instagram 수집이 안 됨**
→ Instagram은 로그인 없이 공개 접근이 점점 제한됨. Google RSS 폴백이 VCA 키워드 위주로 동작.
→ 완전한 IG 수집은 Meta Instagram Graph API 필요 (별도 OAuth 설정).

---

*버전: v0.1a | 최초 작성: 2026-03-27*
