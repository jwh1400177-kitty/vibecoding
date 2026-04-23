# VCA 미디어 모니터링 프로젝트 — 인수인계 문서
*작성일: 2026-03-31 | 이전 대화에서 이어받는 문서*

---

## 👤 정우형 소개
- 전 CJ 14년 근무, 현재 컨설턴트
- 패션회사(반클리프 아펠 VCA) 미디어 모니터링 프로젝트 진행 중
- 바이브코딩 입문자 → 터미널 Claude Code + VS Code + Python 환경 구축 완료
- Pro 플랜 사용 중

---

## 💻 개발 환경
- **PC**: Windows, LG 노트북
- **경로**: `C:\Users\LG\Desktop\바이브코딩\vca_monitoring_python`
- **VS Code**: 설치 완료 + Claude Code 확장 설치
- **Git**: 설치 완료
- **Claude Code**: v2.1.84 설치 완료 (터미널)
- **Python**: 3.12.10 설치 완료
- **작업 방식**: VS Code 하단 터미널에서 `claude` 입력 후 대화

---

## 🎯 프로젝트 핵심 목표 (최종 확정)

### 가장 중요한 것
각 브랜드(자사+경쟁사)의 키워드가 **제목 또는 본문요약**에 포함된 기사를 **단 하나도 빠짐없이 수집**하는 것.

- 정치/연예/사회/스포츠 기사 상관없음
- 키워드만 포함되면 무조건 수집
- **키워드 없는 기사 수집 = 0건 (버그)**
- **키워드 있는 기사 누락 = 0건 (목표)**

### 수집 대상
| 소스 | 대상 |
|---|---|
| 포털 3개 (네이버/다음/구글) | VCA + 경쟁사 11개 전체 |
| 웹사이트 56개 | VCA 키워드 포함 기사만 |
| 인스타그램 62채널 | VCA 키워드 포함 게시물만 |

---

## 📁 구글 시트 구조 (최종 확정)

### 탭 구성
| 탭명 | 역할 |
|---|---|
| Van Cleef & Arpels | VCA 기사 원본 전체 (URL중복만 제거) |
| Cartier, Tiffany 등 | 각 경쟁사 기사 원본 전체 |
| All_Competitors | 경쟁사 전체 종합 |
| 전체종합 | VCA + 경쟁사 전체 |
| **이메일전송최종본** | 키워드 검증 + 유사기사 중복제거 완료본 |
| Duplicate_Check | URL 해시 중복 체크 |
| Error_Log | 수집 오류 로그 |

### 구글 시트 저장 기준 (확정)
- **각 브랜드 탭**: URL 완전 일치만 제거, 전체 저장 (원본 보존)
- **이메일전송최종본**: 키워드 검증 → 유사기사 중복제거 완료본

### 시트 컬럼 구조 (A~I열)
| 열 | 컬럼명 | 내용 |
|---|---|---|
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

## 🔑 브랜드 키워드 (최종 확정)

```python
BRAND_SEARCH_KEYWORDS = {
    "Van Cleef & Arpels": [
        "Van Cleef & Arpels", "반클리프", "반클리프아펠",
        "Van Cleef", "알함브라", "페리도", "페리 도", "반 클리프"
    ],
    # 알함브라 = VCA 시그니처 클로버 컬렉션명
    # 페리도 = VCA 골드 비즈 컬렉션명

    "Cartier": ["Cartier", "까르띠에", "카르띠에"],

    "Tiffany & Co": [
        "Tiffany & Co", "티파니앤코", "티파니 앤 코"
    ],
    # "티파니" 단독 제외 → 연예인 소녀시대 티파니(박티파니)와 혼동

    "Bvlgari": ["Bvlgari", "Bulgari", "불가리", "블가리"],

    "Chanel Jewelry": [
        "샤넬 주얼리", "샤넬 파인주얼리", "Chanel Jewelry"
    ],
    # "샤넬" 단독 제외 → 패션/뷰티와 혼동

    "Piaget": ["Piaget", "피아제"],
    "Chaumet": ["Chaumet", "쇼메"],
    "Chopard": ["Chopard", "쇼파드"],

    "Graff": ["Graff", "그라프 다이아몬드", "그라프 주얼리"],
    # "그라프" 단독 제외

    "Boucheron": ["Boucheron", "부쉐론"],

    "Dior Jewelry": [
        "Dior Jewelry", "디올 주얼리", "디올 파인주얼리"
    ],
    # "Dior" 단독 제외 → 패션/뷰티와 혼동

    "Louis Vuitton Jewelry": [
        "Louis Vuitton Jewelry", "루이비통 주얼리", "LV Jewelry"
    ],
    # "Louis Vuitton" 단독 제외 → 패션과 혼동
}
```

---

## 🔧 중복 제거 기준 (확정)

### 구글 시트 저장 시
- URL 완전 일치만 제거
- 제목 유사도 중복 제거 안 함 (원본 보존)

### 이메일전송최종본 생성 시
1. 키워드 검증: 제목 또는 본문요약에 브랜드 키워드 포함 여부
2. 제목 유사도 60% 이상 → 중복 제거
3. 남긴 기사 I열(비고2)에 "유사기사 N건" 표시

### 소스 우선순위 (중복 시 어느 기사를 남길지)
1순위: 패션 전문 매체 (Vogue, Bazaar, Elle 등 MM/WM)
2순위: Naver News
3순위: Daum News
4순위: Google News
5순위: Bing News

---

## 📧 이메일 구조 (최종 확정)

### 섹션 순서
1. **VCA 요약** (최상단, 가장 중요)
   - 매체별: 수집건수 / 시트저장 / 이메일노출
2. **전체 수집 현황 요약**
   - 소스별: 수집/URL중복/제목유사/저장/VCA/경쟁사
3. **브랜드별 저장 현황**
   - 자사/경쟁사 구분, 시트저장/중복제거/노출
4. **VCA 기사 상세** (이메일전송최종본 기준)
5. **경쟁사 기사 통합 테이블** (브랜드명 컬럼 포함, 하나의 표)
6. **웹사이트 56개 현황** (맨 아래)

---

## 📅 수집 날짜 기준

| 요일 | 수집 대상 |
|---|---|
| 월요일 | 금~일 3일치 |
| 화~금 | 어제 1일치 |
| 토·일 | 수집 없음 |

---

## 🗂️ 파일 구조

```
vca_monitoring_python/
├── CLAUDE.md              # 프로젝트 설명 파일
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
│   └── dedup.py           # 중복 제거
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

# 인스타그램만 실행
python main.py --batch instagram

# 시트 전체 초기화
python main.py --clear-all
```

---

## 🐛 현재 알려진 문제 및 과제

### 해결 완료
- ✅ 이메일 요약표 숫자 일치 (URL중복/제목유사/최종저장 합계 검증)
- ✅ 구글 시트 정렬 (수집날짜↓ → 브랜드명↑ → 발행날짜↓)
- ✅ 이메일 합계 행 정렬 통일
- ✅ Tiffany 키워드 정확화 (222건 → 80건, -64%)
- ✅ normalize_url() 버그 수정 (idxno 식별자 보존)
- ✅ 그룹 중복 제거 추가 (인물명/주제어 기반)
- ✅ 소스 간 교차 중복 제거 (네이버/다음 동일 기사)
- ✅ 웹사이트 56개로 제한 (87개 → 56개)
- ✅ 날짜 필터 통일 (포털/웹/인스타 동일 기준)

### 현재 진행 중 (다음 작업)
- 🔧 **핵심 버그**: 브랜드 키워드 없는 기사 수집 문제
  - Tiffany & Co 기사 중 완전 무관 기사 다수 포함
  - 원인: RSS 피드에서 키워드와 무관한 기사 반환
  - 해결책: 수집 후 키워드 포함 여부 검증 추가
- 🔧 **이메일전송최종본 탭 신규 추가**
  - 키워드 검증 + 유사기사 중복제거 완료본
  - 이메일은 이 탭 기준으로 발송
- 🔧 **이메일 양식 전면 재설계**
  - 섹션1 VCA 요약 최상단 배치
  - 경쟁사 통합 테이블 (브랜드명 컬럼 포함)

### 미해결 한계
- ⚠️ 인스타그램: 공식 API 없어서 수집 제한적 (현재 1~3건)
- ⚠️ RSS summary에 키워드 없고 본문에만 있는 기사 수집 불가
- ⚠️ Sheets API 429 Rate Limit → fallback 처리 중

---

## 📝 다음 작업에서 할 것 (프롬프트 준비 완료)

아래 프롬프트를 터미널 Claude Code에 붙여넣기:

```
이번에 프로젝트 핵심 목표와 구조를 전면 재설계한다.
내 동의 없이 끝까지 스스로 진행해줘.
각 단계마다 검증 후 다음 단계 진행.
문제 발견 시 즉시 수정하고 재실행.
80% 이상 완성도까지 반복해줘.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 프로젝트 핵심 목표 재정의
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
이 프로젝트의 가장 중요한 목표:
1. 각 브랜드 키워드가 제목 또는 본문요약에
   포함된 기사를 단 하나도 빠짐없이 수집
2. 정치/연예/사회/스포츠 상관없이 키워드 포함 기사 전부 수집
3. 구글 시트 = 키워드 포함 기사 전체 저장 (URL중복만 제거)
4. 이메일전송최종본 = 키워드 검증 + 중복제거 완료본
5. 이메일 = 이메일전송최종본 기준 발송

핵심 품질 지표:
- 브랜드 키워드 없는 기사 수집 = 0건 (버그)
- 브랜드 키워드 있는 기사 누락 = 0건 (목표)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ STEP 1 — 구글 시트 구조 재설계
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[기존 브랜드 탭들] 역할 변경:
→ URL 중복만 제거 후 전체 저장 (원본 데이터 보존)
→ 제목 유사도 중복 제거 안 함

[신규 탭 추가] "이메일전송최종본":
→ 각 브랜드 탭에서 아래 2단계 처리 후 저장:
  1단계: 키워드 검증
     제목(title) 또는 본문요약(summary)에
     브랜드 키워드 포함 여부 확인
     통과한 기사만 다음 단계로
  2단계: 제목 유사도 중복 제거
     Jaccard 60% 이상 중복 제거
     남긴 기사 비고2에 "유사기사 N건" 표시
→ 이메일은 이 탭 기준으로 발송
→ 실행할 때마다 탭 초기화 후 새로 작성

이메일전송최종본 정렬:
1순위: D열(카테고리) - VCA 먼저
2순위: B열(발행날짜) 내림차순
3순위: C열(브랜드명) 알파벳순
4순위: E열(기사제목) 오름차순

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ STEP 2 — 핵심 버그 수정
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
현재 가장 큰 버그:
브랜드 키워드가 없는 기사가 수집됨.

원인 진단 스크립트 실행:
python -c "
import os, sys
sys.path.insert(0, '.')
from dotenv import load_dotenv
load_dotenv()
import gspread
from google.oauth2.service_account import Credentials
from config import BRAND_SEARCH_KEYWORDS

creds = Credentials.from_service_account_file(
    os.getenv('GOOGLE_CREDENTIALS_PATH'),
    scopes=['https://spreadsheets.google.com/feeds',
            'https://www.googleapis.com/auth/drive']
)
gc = gspread.authorize(creds)
sh = gc.open_by_key(os.getenv('SPREADSHEET_ID'))

for brand in ['Tiffany & Co', 'Van Cleef & Arpels', 'Cartier']:
    try:
        ws = sh.worksheet(brand)
        rows = ws.get_all_records()
        keywords = BRAND_SEARCH_KEYWORDS.get(brand, [])
        no_kw = [r for r in rows
                 if not any(k.lower().strip('\"') in
                           r.get('기사제목','').lower()
                           for k in keywords)]
        print(f'{brand}: 전체={len(rows)}건, 키워드없음={len(no_kw)}건')
        for r in no_kw[:3]:
            print(f'  - {r[\"기사제목\"][:50]}')
    except Exception as e:
        print(f'{brand}: 오류 - {e}')
"

원인별 수정:
모든 수집 소스(portals.py, web.py, instagram.py)에서
기사 저장 전 키워드 포함 여부 검증 추가:

def _has_brand_keyword(title, summary, brand):
    from config import BRAND_SEARCH_KEYWORDS
    keywords = BRAND_SEARCH_KEYWORDS.get(brand, [])
    text = (title + ' ' + (summary or '')).lower()
    for kw in keywords:
        clean_kw = kw.lower().strip('"')
        if clean_kw in text:
            return True
    return False

키워드 없으면 저장 안 함 + 로그:
"[키워드없음] Tiffany: 사설 제목... → 제거"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ STEP 3 — 브랜드 키워드 최적화
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
config.py BRAND_SEARCH_KEYWORDS 수정:

Van Cleef & Arpels:
["Van Cleef & Arpels", "반클리프", "반클리프아펠",
 "Van Cleef", "알함브라", "페리도", "페리 도", "반 클리프"]

Tiffany & Co:
["Tiffany & Co", "티파니앤코", "티파니 앤 코"]
→ "티파니" 단독, "Tiffany" 단독 제외

Chanel Jewelry:
["샤넬 주얼리", "샤넬 파인주얼리", "Chanel Jewelry"]
→ "샤넬" 단독 제외

Graff:
["Graff", "그라프 다이아몬드", "그라프 주얼리"]
→ "그라프" 단독 제외

Dior Jewelry:
["Dior Jewelry", "디올 주얼리", "디올 파인주얼리"]
→ "Dior" 단독 제외

Louis Vuitton Jewelry:
["Louis Vuitton Jewelry", "루이비통 주얼리", "LV Jewelry"]
→ "Louis Vuitton" 단독 제외

수정 후 각 키워드로 테스트:
각 브랜드 키워드로 수집 테스트 후
제목(title) 또는 본문요약(summary)에
키워드 포함 여부 확인.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ STEP 4 — 이메일 양식 전면 재설계
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[섹션 1] VCA 요약 (최상단, 가장 중요)
매체별: 수집건수 / 시트저장 / 이메일노출 표

[섹션 2] 전체 수집 현황
소스별: 수집/URL중복/저장/VCA/경쟁사

[섹션 3] 브랜드별 현황
자사/경쟁사 구분: 시트저장/중복제거/노출

[섹션 4] VCA 기사 상세
이메일전송최종본 VCA 기사
(발행날짜↓ → 기사제목↑)

[섹션 5] 경쟁사 기사 통합 테이블
브랜드명 컬럼 포함 하나의 표:
No | 발행일 | 브랜드명 | 기사제목 | 미디어 | 타입 | 비고2
(브랜드명↑ → 발행날짜↓ → 기사제목↑)

[섹션 6] 웹사이트 56개 현황 (맨 아래)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ STEP 5 — 전체 테스트 및 검증
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. python main.py --clear-all
2. python main.py --force

핵심 검증:
□ 각 브랜드 탭: 키워드 없는 기사 = 0건
□ 이메일전송최종본 탭 존재 및 정상 구성
□ 섹션3 시트저장 합계 = 구글시트 실제 행수
□ 섹션3 노출 합계 = 이메일전송최종본 행수
□ 숫자 불일치 시 즉시 수정

하나라도 실패하면 즉시 수정 후 재실행.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ STEP 6 — CLAUDE.md 전면 업데이트
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
모든 작업 완료 후 CLAUDE.md를 현재 상태로
완전히 업데이트해줘.

포함 내용:
- 프로젝트 핵심 목표
- 구글 시트 구조 (이메일전송최종본 포함)
- 수집 구조 (포털/웹/인스타 역할)
- 브랜드 키워드 전체 목록 및 제외 이유
- 이메일 섹션 구조
- 중복 제거 기준 (저장 시 vs 이메일 발송 시)
- 알려진 한계
- 마지막 업데이트 날짜 및 주요 변경사항
```

---

## 💡 바이브코딩 팁 (대화에서 정리된 것들)

- **CLAUDE.md** = 프로젝트 기억 파일. 매 세션마다 자동으로 읽음
- **터미널 닫아도 괜찮음** → `claude` 다시 입력하면 CLAUDE.md 읽고 이어서
- **Y/N 묻는 것만 답하고** 나머지는 알아서 진행
- **오류 나도 기다리면** Claude Code가 스스로 수정
- **1 shell still running** = 백그라운드 작업 중 → 기다리면 됨
- 프롬프트가 길고 구체적일수록 결과 품질이 올라감

---

*이 문서를 새 채팅창에 공유하면 이전 대화 내용 없이도 이어서 진행 가능합니다.*
