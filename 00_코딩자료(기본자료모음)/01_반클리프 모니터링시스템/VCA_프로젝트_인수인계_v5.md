# VCA 미디어 모니터링 프로젝트 — 인수인계 문서 v5
*작성일: 2026-04-07 | 코드 버전: v1.23 기준*

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
    # "샤넬"/"Chanel" 단독은 주얼리 필터 추가 적용

    "Boucheron": ["Boucheron", "부쉐론"],

    "Dior Jewelry": ["Dior Jewelry", "디올 주얼리", "디올 파인주얼리", "Dior", "디올"],
    # v1.23에서 "Dior", "디올" 단독 추가 — 주얼리 필터 연계

    "Louis Vuitton Jewelry": [
        "Louis Vuitton Jewelry", "LV Jewelry", "루이비통 주얼리", "루이비통", "Louis Vuitton"
    ],
    # "루이비통"/"Louis Vuitton" 단독은 주얼리 필터 추가 적용
}
```

---

## 🔄 파이프라인 구조 (5단계)

```
1단계: 수집
       포털(네이버/다음/구글) — VCA + 경쟁사 11개
         → 키워드로 1차 검색 → search_keyword 필드 저장
       웹사이트 56개 — VCA만 (title + summary 체크)
       인스타 62채널 — VCA만 (Google RSS 간접수집)
       ↓
2단계: HTML 태그 정리 (filter_articles)
       ↓
3단계: 키워드 필터 (filter_by_keyword)
       - 포털 기사: search_keyword 있으면 무조건 통과 (v1.23)
       - 웹/인스타: title OR summary에 키워드 있으면 통과
       ↓
4단계: URL 중복 제거 → 브랜드탭 / 전체종합 / All_Competitors 저장
       당일 배치 내에서만 중복 체크 (크로스데이 체크 없음)
       ↓
5단계: 제목 유사도 중복 제거 (Jaccard 0.6)
       이메일발송최종_v2 탭 저장 시 크로스데이 URL 중복 필터 적용 (v1.23)
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
| ~~이메일전송최종본~~ | 비활성화됨 | 수동 삭제 필요 |
| 웹사이트_일별수집 | 56개 사이트 전량 | 5열 |
| Duplicate_Check | URL 해시 기록 | — |
| Error_Log | 수집 오류 로그 | — |

### 브랜드탭 컬럼 구조 (A~K열)
| 열 | 컬럼명 |
|----|--------|
| A | NO |
| B | 수집날짜 |
| C | 발행날짜 |
| D | 브랜드명 |
| E | 함께노출된브랜드 |
| F | 기사제목 |
| G | 링크 |
| H | 채널 (포털/웹/SNS) |
| I | 미디어명 |
| J | 타입 |
| K | 비고 |

### 이메일발송최종_v2 컬럼 구조 (A~K열)
| 열 | 컬럼명 |
|----|--------|
| A | No |
| B | 수집일 |
| C | 발행일 |
| D | 브랜드명 |
| E | 함께노출된브랜드 |
| F | 기사제목 (순수 텍스트) |
| G | 링크 (URL 별도) |
| H | 채널 |
| I | 미디어명 |
| J | 타입 |
| K | 비고 |

### 정렬 기준 (전체 시트 통일)
```
수집날짜↓ → 브랜드명(BRAND_PRIORITY 순) → 발행날짜↓(없으면 맨 아래)
→ 채널(포털>웹>SNS) → 기사제목↑(특수문자 제거 후)
```

### 브랜드 우선순위 (BRAND_PRIORITY)
```
1. Van Cleef & Arpels  (0)
2. Cartier             (1)
3. Piaget              (2)
4. Chaumet             (3)
5. Chopard             (4)
6. Tiffany & Co        (5)
7. Bvlgari             (6)
8. Graff               (7)
9. Chanel Jewelry      (8)
10. Boucheron          (9)
11. Dior Jewelry       (10)
12. Louis Vuitton Jewelry (11)
```

---

## 🏷️ 미디어 타입 기준

| 타입 | 설명 | 예시 |
|------|------|------|
| TGD | General Daily (종합일간지) | 조선, 중앙, 동아 |
| BD | Business Daily (경제일간지) | 한국경제, 매일경제 |
| T | Trade (전문지/통신사) | 연합뉴스, 패션비즈 |
| NW | Newswire (통신사) | 뉴시스, 뉴스1 |
| SD | Sports Daily (스포츠) | 스타뉴스, 스포츠조선 |
| O | Online News (온라인) | 데일리안 등 |
| ED | English Daily (영문) | Korea JoongAng Daily |
| TV | Broadcasting (방송) | KBS, MBC, SBS |
| WM | Weekly Magazine (주간지) | High Cut, 주간조선 |
| MM | Monthly Magazine (월간지) | Vogue, Elle, Bazaar |
| IT | IT Trade (IT 전문지) | ZDNet |
| SNS | 인스타그램 | Instagram 채널 |

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
- cron: `'0 22 * * 0-4'` (UTC 일~목 22:00 = KST 월~금 **07:00**) ← v1.23 변경
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
4. **VCA 기사 상세** (이메일발송최종_v2 기준)
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
- 크로스데이 URL 중복체크 제거 (VCA 기사 0건 버그)

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
- Dior Jewelry 주얼리 필터 적용 ("Dior", "디올" 단독 키워드 추가)
- clean_title() 제목 정제 개선 ([OOO], 【OOO】 등 브래킷 제거)

### v1.21
- --send-only 읽기 소스를 이메일발송최종_v2 탭으로 변경
- 브랜드탭 폴백 로직 제거

### v1.22
- --send-only 통계 폴백 로직 수정
- 이메일발송최종_v2 탭 로드 기사(channel="포털"/"웹"/"SNS")도 통계 정상 표시

### v1.23
- 포털 수집 기사 search_keyword 신뢰 통과 (다음 0건 버그 수정)
- 이메일발송최종_v2 크로스데이 URL 중복 제거 (기존 보낸 기사 재발송 방지)
- GitHub Actions 실행 시간 08:00 → **07:00 KST** 변경

---

## ✅ 현재 정상 작동 중인 것들

- GitHub Actions 매일 **07:00 KST** 자동 실행 ✅
- 포털(네이버/다음/구글) 수집 ✅ (v1.23에서 다음 수집 정상화)
- 웹사이트 56개 수집 (성공 41개 / 우회 5개 / 실패 10개) ✅
- 인스타그램 글로벌 VCA 키워드 검색 수집 ✅
- 이메일발송최종_v2 누적 저장 + 크로스데이 중복 제거 ✅
- --send-only 이메일발송최종_v2 기준 정상 발송 ✅
- 이메일 발송 (VCA 상세 + 경쟁사 + 웹사이트 현황 + 인스타 현황) ✅

---

## ⚠️ 현재 알려진 문제 및 한계

| 항목 | 상태 | 비고 |
|------|------|------|
| 이메일전송최종본 탭 수동 삭제 | PENDING | 구글 시트에서 수동 삭제 필요 |
| 인스타 채널별 수집 57개 실패 | 구조적 한계 | Google RSS 간접수집 방식 한계 |
| 웹사이트 실패 10개 | 미해결 | 사이트 차단/종료 |
| 다음 RSS 링크 깨짐 | 구조적 한계 | google-analytics.com URL로 대체됨 |
| RSS 수정일 기준 재수집 | 구조적 한계 | 언론사가 기사 수정 시 RSS 날짜가 수정일로 업데이트되어 재수집될 수 있음 (정상 동작) |
| 과거 데이터 크로스데이 중복 | 시간 해결 | 수집 초기(4/3~)라 이전 데이터 없어 일부 중복 발생 가능, 누적될수록 해결됨 |

---

## 💡 클라이언트 관련 사항 (기샛별나님)

- **샤넬/루이비통/디올 주얼리 필터**: "쥬얼리", "jewelry" 등 키워드로 2차 필터 적용 완료 ✅
- **"예전 데이터가 잡힌다" 이슈**: 크로스데이 URL 중복 필터(v1.23) 적용으로 점진적 해결 중
  - 수집 초기라 4/3 이전 데이터 없어 완전 해결까지 시간 필요
  - 언론사 기사 수정 시 RSS 날짜가 업데이트되어 재수집되는 건 정상 동작

---

## 💡 운영/테스트 분리 원칙

- **매일 07:00 KST GitHub Actions** → 절대 중단하지 않음
- **테스트**: `--force --date YYYY-MM-DD` 조합 사용
- **테스트 클리닝**: `--clear-date YYYY-MM-DD` (해당 날짜만 삭제)
- **전체 초기화**: `--clear-all` (컬럼 구조 변경 시에만 사용)
- **코드 수정 후**: 반드시 git_push.bat 실행

---

## 💡 Claude Code 사용 팁

- **CLAUDE.md** = 프로젝트 기억 파일. 매 세션마다 자동으로 읽음
- **"내 동의 없이 끝까지 진행해줘"** 프롬프트에 포함하면 자동 진행
- **숫자로 검증 요청 필수** → "완료했습니다" 보고만 믿으면 안 됨
- 코드 수정 후 반드시 **git_push.bat 더블클릭**
- 한 번에 최대 2~3개 수정 (많으면 cascading 버그 발생)
- 절전모드 주의 (코드 실행 중 PC 절전 시 중단됨)
- 수정 시 연관된 부분 반드시 같이 챙길 것 (예: 탭 비활성화 시 --send-only 읽기 소스도 같이 변경)

---

## 📋 새 대화창 시작 시 공유할 자료 순서

1. **코드 파일** (버그 수정 시 필수):
   - `collector/portals.py`
   - `collector/instagram.py`
   - `collector/web.py`
   - `processor/filter.py`
   - `processor/dedup.py`
   - `storage/sheets.py`
   - `mailer/report.py`
   - `main.py`
   - `config.py`
   - `CLAUDE.md`

2. **결과 확인용**:
   - 이메일 PDF
   - 구글 시트 Excel (.xlsx)

3. **실행 로그**:
   - Claude Code 터미널 결과 텍스트

---

*프로젝트명: VCA 미디어 모니터링 | 버전: v5.0 | 최종수정: 2026-04-07*
