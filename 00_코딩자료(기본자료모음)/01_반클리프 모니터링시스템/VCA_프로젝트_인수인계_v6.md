# VCA 미디어 모니터링 프로젝트 — 인수인계 문서 v6
*작성일: 2026-04-07 | 코드 버전: v1.25 기준*

---

## 👤 프로젝트 담당자
- 정우형 (전 CJ 14년 근무, 현재 컨설턴트)
- 클라이언트: Van Cleef & Arpels (반클리프 아펠)
- 클라이언트 담당자: 기샛별나님
- 바이브코딩 환경: 터미널 Claude Code + VS Code + Python

---

## 💻 개발 환경
- **PC**: Windows, LG 노트북
- **경로**: `C:\Users\LG\Desktop\바이브코딩\vca_monitoring_python`
- **Python**: 3.12.10
- **Claude Code**: v2.1.84 (터미널에서 `claude` 입력으로 실행)
- **GitHub**: https://github.com/jwh1400177-kitty/vca-monitoring-python
- **플랜**: Claude Pro

---

## 🎯 프로젝트 핵심 목표 (절대 원칙)

브랜드 키워드가 기사 제목 또는 본문(summary)에 포함된 기사를 **단 하나도 빠짐없이 수집**하는 것.

> ⚠️ 필터 과정에서 키워드 있는 기사가 누락되는 것은
> 키워드 없는 기사가 딸려오는 것보다 훨씬 큰 문제.

### 수집 원칙
- 키워드가 기사 제목/본문에 있으면 **기사 내용과 무관하게 무조건 수집** (정치기사, 사법기사 등 포함)
- 브랜드탭 / 전체종합 / All_Competitors → 크로스데이 중복 상관없이 **전부 수집 저장**
- 이메일발송최종_v2 탭에서만 크로스데이 URL 중복 필터 적용

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
        "Van Cleef & Arpels", "Van Cleef", "반클리프", "반클리프아펠", "반 클리프"
    ],
    # 알함브라, 페리도 제외 — 오탐 발생

    "Cartier": ["Cartier", "까르띠에"],
    "Piaget": ["Piaget", "피아제"],
    "Chaumet": ["Chaumet", "쇼메"],
    "Chopard": ["Chopard", "쇼파드"],

    "Tiffany & Co": ["Tiffany & Co", "티파니앤코", "티파니 앤 코"],
    # "티파니" 단독 제외 — 연예인 소녀시대 티파니와 혼동

    "Bvlgari": ["Bvlgari", "Bulgari", "불가리", "블가리"],

    "Graff": ["Graff", "그라프 다이아몬드", "그라프 주얼리"],
    # "그라프" 단독 제외

    "Chanel Jewelry": ["Chanel Jewelry", "샤넬 주얼리", "샤넬 파인주얼리", "샤넬", "Chanel"],
    # "샤넬"/"Chanel" 단독은 주얼리 필터 추가 적용 (BROAD_KEYWORD_BRANDS)

    "Boucheron": ["Boucheron", "부쉐론"],

    "Dior Jewelry": ["Dior Jewelry", "디올 주얼리", "디올 파인주얼리", "Dior", "디올"],
    # "Dior"/"디올" 단독은 주얼리 필터 추가 적용 (BROAD_KEYWORD_BRANDS)

    "Louis Vuitton Jewelry": [
        "Louis Vuitton Jewelry", "LV Jewelry", "루이비통 주얼리", "루이비통", "Louis Vuitton"
    ],
    # "루이비통"/"Louis Vuitton" 단독은 주얼리 필터 추가 적용 (BROAD_KEYWORD_BRANDS)
}
```

---

## 🔄 파이프라인 구조 (5단계)

```
1단계: 수집
       포털(네이버/다음/구글) — VCA + 경쟁사 11개
         → 키워드로 1차 검색
       웹사이트 56개 — VCA만
       인스타 62채널 — VCA만 (Google RSS 간접수집)
       ↓
2단계: HTML 태그 정리 (filter_articles)
       ↓
3단계: 키워드 필터 (filter_by_keyword)
       - 모든 소스 동일 규칙: title OR summary에 키워드 있으면 통과
       - BROAD_KEYWORD_BRANDS(샤넬/디올/루이비통): 넓은 키워드 매칭 시 JEWELRY_KEYWORDS 추가 확인
       ↓
4단계: URL 중복 제거 → 브랜드탭 / 전체종합 / All_Competitors 저장
       당일 배치 내에서만 중복 체크 (크로스데이 체크 없음)
       ↓
5단계: 제목 유사도 중복 제거 (Jaccard 0.6)
       이메일발송최종_v2 탭 저장 시 크로스데이 URL 중복 필터 적용
       → 이메일 발송
```

---

## 📁 구글 시트 구조

### 탭 구성
| 탭명 | 역할 | 비고 |
|------|------|------|
| Van Cleef & Arpels | VCA 원본 전체 | 11열 |
| Cartier 등 경쟁사 11개 | 각 경쟁사 원본 | 11열 |
| All_Competitors | 경쟁사 전체 종합 | 11열 |
| 전체종합 | VCA + 경쟁사 전체 | 11열 |
| **이메일발송최종_v2** | 이메일용 최종본 (누적, 크로스데이 URL 중복 제거) | 11열 |
| ~~이메일전송최종본~~ | 비활성화됨 (수동 삭제 권장) | — |
| 웹사이트_일별수집 | 56개 사이트 전량 | 5열 |
| Duplicate_Check | URL 해시 기록 | — |
| Error_Log | 수집 오류 로그 | — |

### 브랜드탭 / 이메일발송최종_v2 컬럼 구조 (A~K열)
| 열 | 컬럼명 |
|----|--------|
| A | No |
| B | 수집일 |
| C | 발행일 |
| D | 브랜드명 |
| E | 함께노출된브랜드 |
| F | 기사제목 |
| G | 링크 |
| H | 채널 (포털/웹/SNS) |
| I | 미디어명 |
| J | 타입 |
| K | 비고 |

### 정렬 기준 (전체 시트 통일)
```
수집날짜↓ → 브랜드명(BRAND_PRIORITY 순) → 발행날짜↓(없으면 맨 아래)
→ 채널(포털>웹>SNS) → 기사제목↑
```

### 브랜드 우선순위 (BRAND_PRIORITY)
```
1. Van Cleef & Arpels
2. Cartier
3. Piaget
4. Chaumet
5. Chopard
6. Tiffany & Co
7. Bvlgari
8. Graff
9. Chanel Jewelry
10. Boucheron
11. Dior Jewelry
12. Louis Vuitton Jewelry
```

---

## 🏷️ 미디어 타입 기준

| 타입 | 설명 |
|------|------|
| MM | 월간지 (Vogue, Elle, Bazaar 등) |
| WM | 주간지 |
| O | 온라인 뉴스 |
| BD | 비즈니스/경제지 |
| TGD | 포털/종합 |
| NW | 종합일간지 |
| T | 통신사 |
| SD | 스포츠/연예 |
| ED | 전문지 |
| TV | 방송 |
| IT | IT 전문지 |
| SNS | 인스타그램 |

---

## 📅 수집 날짜 기준

| 요일 | 수집 대상 |
|------|-----------|
| 월요일 | 금~일 3일치 |
| 화~금 | 어제 1일치 |
| 토·일 | 수집 없음 (--force로 강제 가능) |

---

## 🤖 자동 실행 설정

### GitHub Actions (주 운영) ✅
- 레포: https://github.com/jwh1400177-kitty/vca-monitoring-python
- cron: `'0 22 * * 0-4'` (UTC 일~목 22:00 = KST 월~금 **07:00**)
- 명령: `python main.py`
- 월요일 소요시간: 약 45~50분 (3일치 수집)
- 화~금 소요시간: 약 15~20분

### Windows 작업 스케줄러 ✅ 비활성화 완료
- GitHub Actions와 중복 실행 방지를 위해 비활성화됨

### GitHub Push (코드 수정 후)
바탕화면 **git_push.bat** 더블클릭
→ 자동으로 git add . && commit && push

---

## 🚀 실행 명령어

```bash
# 전체 파이프라인 실행 (정규 운영)
python main.py

# 특정 날짜 강제 수집 + 이메일 발송 (테스트)
python main.py --force --date 2026-04-07

# 수집만, 이메일 발송 안 함
python main.py --force --date 2026-04-07 --no-email

# 특정 날짜 데이터만 삭제 (테스트 클리닝)
python main.py --clear-date 2026-04-07

# 전체 초기화 (주의!)
python main.py --clear-all

# 이메일만 재발송 (이메일발송최종_v2 기준)
python main.py --send-only
```

---

## 📧 이메일 구조

### 섹션 순서
1. **VCA 소스별 현황** (최상단)
2. **전체 수집 현황 요약**
3. **브랜드별 저장 현황**
4. **VCA 기사 상세**
5. **경쟁사 기사 통합 테이블**
6. **웹사이트 56개 현황**
7. **인스타그램 62채널 현황**

---

## 🗂️ 파일 구조

```
vca_monitoring_python/
├── CLAUDE.md
├── .github/workflows/
│   └── monitoring.yml
├── .env
├── credentials.json
├── requirements.txt
├── main.py
├── config.py
├── collector/
│   ├── portals.py
│   ├── web.py
│   └── instagram.py
├── processor/
│   ├── filter.py
│   └── dedup.py
├── storage/
│   └── sheets.py
├── mailer/
│   └── report.py
└── utils/
    ├── date_utils.py
    └── logger.py
```

---

## 🐛 버전별 주요 수정 이력

### v1.13
- GitHub Actions UTC→KST 날짜 버그 수정

### v1.15
- 크로스데이 URL 중복체크 제거 (VCA 기사 0건 버그 해결)

### v1.16
- 인스타 날짜 버그 수정
- 웹사이트 동일기사 매일 재수집 방지
- 웹사이트 VCA 필터 title+summary 체크

### v1.17
- 이메일발송최종_v2 누적 저장
- SNS 기사 제목 앞 50자 중복 제거
- --clear-date, --no-email 옵션 추가

### v1.18
- 이메일발송최종_v2 링크 컬럼 추가 (G열)
- 전체 시트 정렬 통일 (BRAND_PRIORITY 순)
- 이메일전송최종본 탭 비활성화
- 인스타그램 62채널 현황 표 이메일 추가

### v1.19
- 이메일발송최종_v2 정렬 수정:
  수집일↓ → 브랜드명(VCA 최우선) → 발행일↓ → 채널(포털>웹>SNS) → 기사제목↑

### v1.20
- JEWELRY_KEYWORDS에 "쥬얼리" 추가
- Dior Jewelry 키워드 추가 ("Dior", "디올") + BROAD_KEYWORD_BRANDS 등록
- clean_title() 제목 정제 개선 ([OOO], 【OOO】 등 브래킷 제거)

### v1.21
- --send-only 읽기 소스를 이메일발송최종_v2 탭으로 변경
- 브랜드탭 폴백 로직 제거

### v1.22
- --send-only 통계 폴백 로직 수정
- 이메일발송최종_v2 탭 로드 기사(channel="포털"/"웹"/"SNS")도 통계 정상 표시

### v1.23
- 이메일발송최종_v2 크로스데이 URL 중복 제거 (sheets.py)
  → 이전 날짜에 이미 저장된 URL은 당일 새로 추가하지 않음
  → 브랜드탭/전체종합/All_Competitors는 영향 없음

### v1.24
- v1.23 search_keyword 무조건 통과 로직 롤백
  → portals.py search_keyword 필드 제거
  → filter.py 기존 키워드 필터 복원
  → sheets.py 크로스데이 중복 제거는 유지

### v1.25
- GitHub Actions 실행 시간 변경
  → 08:00 KST (`'0 23 * * 0-4'`) → **07:00 KST** (`'0 22 * * 0-4'`)

---

## ✅ 현재 정상 작동 중인 것들

- GitHub Actions 매일 **07:00 KST** 자동 실행 ✅
- 포털(네이버/다음/구글) + 웹사이트 56개 + 인스타 62채널 수집 ✅
- 키워드 필터 정상 작동 (title OR summary 체크) ✅
- 이메일발송최종_v2 누적 저장 + 크로스데이 URL 중복 제거 ✅
- --send-only 이메일발송최종_v2 기준 정상 발송 ✅
- 이메일 통계 (수집/중복/키워드제거/이메일노출) 정상 표시 ✅

---

## ⚠️ 현재 알려진 문제 및 한계

| 항목 | 상태 | 비고 |
|------|------|------|
| 다음(Daum) 0건 | 구조적 한계 | Google RSS site:daum.net 반환 기사의 RSS 스니펫에 키워드 없어서 필터 제거됨. 함부로 건드리면 무관 기사 대량 수집 위험 |
| 인스타 채널별 수집 57개 실패 | 구조적 한계 | Google RSS 간접수집 방식 한계 |
| 웹사이트 실패 9~10개 | 미해결 | 사이트 차단/종료 (Singles, Dazed Korea 등) |
| RSS 수정일 기준 재수집 | 구조적 한계 | 언론사가 기사 수정 시 RSS 날짜 업데이트 → 재수집 (정상 동작) |
| 과거 데이터 크로스데이 중복 | 시간 해결 | 수집 초기(4/3~)라 이전 데이터 적음, 누적될수록 해결됨 |
| 이메일전송최종본 탭 | PENDING | 구글 시트에서 수동 삭제 권장 |

---

## ⚠️ 절대 건드리면 안 되는 것

| 항목 | 이유 |
|------|------|
| 다음 0건 문제 수정 시 search_keyword 무조건 통과 | 키워드 무관 기사 대량 수집 위험 (v1.23→v1.24 롤백 교훈) |
| 크로스데이 중복 체크를 브랜드탭에도 적용 | VCA 기사 0건 버그 재발 위험 |
| GitHub Actions cron 표현식 임의 변경 | 이중 실행 또는 미실행 위험 |

---

## 💡 클라이언트 관련 사항 (기샛별나님)

- **샤넬/루이비통/디올 주얼리 필터**: "쥬얼리" 키워드 + BROAD_KEYWORD_BRANDS 적용 완료 ✅
- **"예전 데이터가 잡힌다" 이슈**:
  - 크로스데이 URL 중복 필터(v1.23) 적용으로 점진적 해결 중
  - 수집 초기라 4/3 이전 데이터 없어 완전 해결까지 시간 필요
  - 언론사 기사 수정 시 RSS 날짜 업데이트로 재수집되는 건 정상 동작
  - → **"필터 적용됐고, 수집 초기라 과거 데이터가 없어서 시간이 지나면 해결됨"** 으로 안내

---

## 💡 운영/테스트 분리 원칙

- **매일 07:00 KST GitHub Actions** → 절대 중단하지 않음
- **테스트**: `--force --date YYYY-MM-DD` 조합 사용
- **테스트 클리닝**: `--clear-date YYYY-MM-DD` (해당 날짜만 삭제)
- **전체 초기화**: `--clear-all` (컬럼 구조 변경 시에만 사용)
- **코드 수정 후**: 반드시 git_push.bat 실행

---

## 💡 Claude Code 프롬프트 원칙

- **"다른 로직은 절대 건드리지 마. 내 동의 없이 끝까지 진행해줘."** 항상 포함
- **한 번에 최대 2~3개 수정** (많으면 cascading 버그 발생)
- **수정 후 숫자로 검증 필수** → "완료했습니다" 보고만 믿으면 안 됨
- **연관된 부분 반드시 같이 챙길 것** (예: 탭 비활성화 → --send-only 읽기 소스도 함께 변경)
- **코드 수정 후 반드시 git_push.bat 더블클릭**
- **절전모드 주의** (코드 실행 중 PC 절전 시 중단됨)

---

## 📋 새 대화창 시작 시 공유할 자료

### 파일 공유 방법
- **구글 시트**: 파일 → 다운로드 → **CSV** (탭별로 각각, 가장 가벼움)
- **터미널 로그**: 텍스트 복사해서 붙여넣기
- **업체 리포트**: `reports/` 폴더에 저장 후 Claude Code로 직접 읽기
- **PDF 공유 최소화** → 이미지 변환으로 컨텍스트 많이 차지

### 필요 시 공유할 코드 파일
- `collector/portals.py` — 포털 수집 문제 시
- `collector/instagram.py` — 인스타 수집 문제 시
- `collector/web.py` — 웹사이트 수집 문제 시
- `processor/filter.py` — 키워드 필터 문제 시
- `processor/dedup.py` — 중복 제거 문제 시
- `storage/sheets.py` — 시트 저장 문제 시
- `mailer/report.py` — 이메일 형식 문제 시
- `main.py` — 전체 파이프라인 문제 시
- `config.py` — 키워드/설정 문제 시
- `CLAUDE.md` — 새 대화창 시작 시 항상

---

*프로젝트명: VCA 미디어 모니터링 | 버전: v6.0 | 최종수정: 2026-04-07*
