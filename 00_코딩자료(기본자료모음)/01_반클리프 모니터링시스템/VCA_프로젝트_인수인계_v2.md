# VCA 미디어 모니터링 프로젝트 — 인수인계 문서 v2
*작성일: 2026-04-01 | CLAUDE.md v1.4 기준 최신본*

---

## 👤 프로젝트 담당자
- 정우형 (전 CJ 14년 근무, 현재 컨설턴트)
- 클라이언트: Van Cleef & Arpels (반클리프 아펠)
- 바이브코딩 환경: 터미널 Claude Code + VS Code + Python

---

## 💻 개발 환경
- **PC**: Windows, LG 노트북
- **경로**: `C:\Users\LG\Desktop\바이브코딩\vca_monitoring_python`
- **VS Code**: 설치 완료 + Claude Code 확장 설치
- **Git**: 설치 완료
- **Claude Code**: 터미널에서 `claude` 입력으로 실행
- **Python**: 3.12.10
- **플랜**: Claude Pro

---

## 🎯 프로젝트 핵심 목표 (절대 원칙)

### 가장 중요한 것
브랜드 키워드가 기사 제목 또는 본문(summary)에 포함된 기사를 **단 하나도 빠짐없이 수집**하는 것.

> ⚠️ 필터 과정에서 키워드 있는 기사가 누락되는 것은
> 키워드 없는 기사가 딸려오는 것보다 훨씬 큰 문제.

### 핵심 품질 지표
- 브랜드 키워드 있는 기사 누락 = 0건 (최우선 목표)
- 브랜드 키워드 없는 기사 수집 = 0건 (차순위 목표)

### 수집 범위
| 대상 | 소스 |
|------|------|
| VCA (자사) | 포털 3개 + 웹사이트 56개 + 인스타 62채널 |
| 경쟁사 11개 | 포털 3개만 (네이버/다음/구글) |

---

## 🔑 브랜드 키워드 (확정)

```python
BRAND_SEARCH_KEYWORDS = {
    "Van Cleef & Arpels": [
        "Van Cleef & Arpels", "반클리프", "반클리프아펠",
        "Van Cleef", "반 클리프"
    ],
    # ※ 알함브라, 페리도 제외 — 스페인 알함브라 궁전 등 오탐 발생

    "Cartier": ["Cartier", "까르띠에", "카르띠에"],

    "Tiffany & Co": [
        "Tiffany & Co", "티파니앤코", "티파니 앤 코"
    ],
    # ※ "티파니" 단독 제외 — 연예인 소녀시대 티파니와 혼동

    "Bvlgari": ["Bvlgari", "Bulgari", "불가리", "블가리"],

    "Chanel Jewelry": [
        "샤넬 주얼리", "샤넬 파인주얼리", "Chanel Jewelry"
    ],
    # ※ "샤넬" 단독 제외 — 패션/뷰티와 혼동

    "Piaget": ["Piaget", "피아제"],
    "Chaumet": ["Chaumet", "쇼메"],
    "Chopard": ["Chopard", "쇼파드"],

    "Graff": ["Graff", "그라프 다이아몬드", "그라프 주얼리"],
    # ※ "그라프" 단독 제외 — 오탐 범위 너무 넓음

    "Boucheron": ["Boucheron", "부쉐론"],

    "Dior Jewelry": [
        "Dior Jewelry", "디올 주얼리", "디올 파인주얼리"
    ],
    # ※ "Dior" 단독 제외 — 패션/뷰티와 혼동

    "Louis Vuitton Jewelry": [
        "Louis Vuitton Jewelry", "루이비통 주얼리", "LV Jewelry"
    ],
    # ※ "Louis Vuitton" 단독 제외 — 패션과 혼동
}
```

---

## 🔄 파이프라인 구조 (5단계)

```
1단계: 수집
       포털(네이버/다음/구글) — VCA + 경쟁사 11개
       웹사이트 56개 — VCA만
       인스타 62채널 — VCA만
       ↓
2단계: HTML 태그 정리 (filter_articles)
       ↓
3단계: 키워드 필터 (filter_by_keyword)
       모든 소스 동일 규칙:
       → title OR summary에 브랜드 키워드 있으면 통과 ✅
       → 둘 다 없으면 제거 ❌
       → summary가 없으면 title만으로 판단
       → SNS(인스타) 기사는 Jaccard 비교 제외, 무조건 통과
       ↓
4단계: URL 중복 제거 (deduplicate_url_only)
       → 당일 배치 내에서만 중복 체크 (누적 DB 참조 X)
       → 브랜드별 탭 저장 (URL 중복만 제거한 원본)
       ↓
5단계: 제목 유사도 중복 제거 (deduplicate_title_only)
       → Jaccard 60% 이상 → 중복 제거
       → SNS 기사는 제외 (무조건 통과)
       → 이메일전송최종본 탭 저장
       → 이메일 발송
```

---

## 📁 구글 시트 구조

### 탭 구성
| 탭명 | 역할 | 중복 제거 기준 |
|------|------|---------------|
| Van Cleef & Arpels | VCA 원본 전체 | URL 중복만 제거 |
| Cartier, Tiffany 등 | 각 경쟁사 원본 | URL 중복만 제거 |
| All_Competitors | 경쟁사 전체 종합 | URL 중복만 제거 |
| 전체종합 | VCA + 경쟁사 전체 | URL 중복만 제거 |
| **이메일전송최종본** | 이메일 발송 기준 | 키워드검증 + Jaccard 중복제거 |
| Duplicate_Check | URL 해시 기록 (참조용) | — |
| Error_Log | 수집 오류 로그 | — |

### 컬럼 구조 (A~I열)
| 열 | 컬럼명 | 내용 |
|----|--------|------|
| A | 수집날짜 | 코드 실행 날짜 |
| B | 발행날짜 | 기사 원문 발행일 |
| C | 브랜드명 | Van Cleef & Arpels / Cartier 등 |
| D | 카테고리 | VCA 또는 Competitor |
| E | 기사제목 | HTML 태그 제거된 순수 텍스트 |
| F | 링크 | 기사 원문 URL |
| G | 출처 | 미디어사명 |
| H | 미디어타입 | MM/O/SNS/TGD/BD/WM |
| I | 비고2 | 유사기사 N건 또는 빈칸 |

---

## 🔧 중복 제거 기준

### 구글 시트 저장 시 (브랜드탭)
- URL 완전 일치만 제거
- 당일 배치 내에서만 체크 (Duplicate_Check 탭 누적 참조 X)
- 이유: 누적 참조 시 오늘 기사도 전부 "중복"으로 판정되는 버그 발생

### 이메일전송최종본 생성 시
1. 키워드 검증: title OR summary에 키워드 포함 여부
2. Jaccard 60% 이상 → 중복 제거
3. 남긴 기사 I열(비고2)에 "유사기사 N건" 표시
4. SNS 기사는 Jaccard 제외, 무조건 포함

### 소스 우선순위 (중복 시 어느 기사를 남길지)
1순위: 패션 전문 매체 (Vogue, Bazaar, Elle 등 MM/WM)
2순위: Naver News
3순위: Daum News
4순위: Google News
5순위: Bing News

### URL 정규화 규칙
- http → https 변환, www 제거
- 제거 파라미터: utm_*, ref, fbclid, gclid, sid, m, mobile 등
- **유지 파라미터**: from, type, mode, idxno, aid, no 등 기사 식별자

---

## 📧 이메일 구조

### 섹션 순서
1. **VCA 소스별 현황** (최상단, 가장 중요)
   - 소스별: VCA수집 / URL중복 / 시트저장 / 중복제거 / 이메일노출
2. **전체 수집 현황 요약**
   - 소스별: 수집/URL중복/키워드제거/제목유사/저장/이메일노출/VCA/경쟁사
3. **브랜드별 저장 현황**
   - 자사/경쟁사 구분, 시트저장/이메일노출
4. **VCA 기사 상세** (이메일전송최종본 기준)
5. **경쟁사 기사 통합 테이블** (브랜드명 컬럼 포함)
6. **웹사이트 56개 현황** (맨 아래)

---

## 📅 수집 날짜 기준

| 요일 | 수집 대상 |
|------|-----------|
| 월요일 | 금~일 3일치 |
| 화~금 | 어제 1일치 |
| 토·일 | 수집 없음 |

---

## 🗂️ 파일 구조

```
vca_monitoring_python/
├── CLAUDE.md              # 프로젝트 지침 (Claude Code가 매 세션 자동 읽음)
├── .claude/CLAUDE.md      # 동일 내용 백업
├── .env                   # 환경변수 (API 키 등)
├── credentials.json       # 구글 서비스 계정 키
├── requirements.txt       # 라이브러리 목록
├── main.py                # 메인 실행 파일
├── config.py              # 키워드, 브랜드, 사이트 상수
├── collector/
│   ├── portals.py         # 네이버/다음/구글 수집
│   ├── web.py             # 56개 웹사이트 수집
│   └── instagram.py       # 인스타그램 수집
├── processor/
│   ├── filter.py          # 키워드 검증 필터
│   └── dedup.py           # URL 중복 / 제목 유사도 중복 제거
├── storage/
│   └── sheets.py          # 구글 시트 저장/조회
├── mailer/
│   └── report.py          # HTML 이메일 생성 및 발송
└── utils/
    ├── date_utils.py      # 날짜 처리
    └── logger.py          # 로그 관리
```

---

## ⚙️ 환경변수 (.env)

```
SPREADSHEET_ID=구글시트ID
GOOGLE_CREDENTIALS_PATH=credentials.json
NAVER_CLIENT_ID=네이버API_ID
NAVER_CLIENT_SECRET=네이버API_SECRET
GMAIL_USER=발신이메일@gmail.com
GMAIL_APP_PASSWORD=앱비밀번호16자리
ADMIN_EMAIL=수신이메일1@gmail.com
ADMIN_EMAIL2=수신이메일2@naver.com
INSTAGRAM_SESSION_ID=인스타세션ID
```

---

## 🚀 실행 명령어

```bash
# 전체 파이프라인 실행
python main.py

# 월요일(3일치) 강제 실행 (테스트용)
python main.py --force

# 포털만 실행
python main.py --batch portals

# 웹사이트만 실행
python main.py --batch web

# 이메일만 재발송
python main.py --send-only

# 시트 전체 초기화
python main.py --clear-all
```

---

## 🐛 알려진 문제 및 한계

### 해결 완료
- ✅ URL 중복 체크 누적 버그 (Duplicate_Check 탭 참조 → 당일 배치만)
- ✅ 키워드 필터 미작동 (필터 함수 호출 순서 수정)
- ✅ Tiffany 과다 수집 (82건 → 2건, 다음 소프트 필터)
- ✅ SNS 기사 Jaccard 오탐 (SNS 무조건 통과)
- ✅ URL 정규화 오탐 (from/type/mode 파라미터 유지)
- ✅ 알함브라 키워드 오탐 (스페인 궁전 기사 수집)
- ✅ VCA 소스별 현황 수치 오류 (전체 → VCA 전용)

### 현재 진행 중 / 미해결
- 🔧 VCA 무관 기사 혼입 (다음 RSS 비구문 매칭 한계)
- 🔧 웹사이트 56개 VCA관련 0건 (키워드 매칭 미작동)
- ⚠️ 인스타그램: 공식 API 없어서 수집 제한적 (1~3건)
- ⚠️ RSS summary에 키워드 없고 본문에만 있는 기사 수집 불가

### 구조적 한계
- 코드가 버그 수정을 반복하면서 복잡해진 상태
- 단순화 리셋 검토 중 (filter.py + main.py 파이프라인)

---

## 💡 Claude Code 사용 팁

- **CLAUDE.md** = 프로젝트 기억 파일. 매 세션마다 자동으로 읽음
- **터미널 닫아도 괜찮음** → `claude` 다시 입력하면 CLAUDE.md 읽고 이어서
- **"내 동의 없이 끝까지 진행해줘"** 프롬프트에 포함하면 자동 진행
- **숫자로 검증 요청 필수** → "완료했습니다" 보고만 믿으면 안 됨
- 프롬프트가 길고 구체적일수록 결과 품질이 올라감

---

*프로젝트명: VCA 미디어 모니터링 | 버전: v2.0 | 최종수정: 2026-04-01*
