# VCA 미디어 모니터링 프로젝트 — 인수인계 문서 v3
*작성일: 2026-04-02 | CLAUDE.md v1.9 기준 최신본*

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
- **GitHub**: https://github.com/jwh1400177-kitty/vca-monitoring-python

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
        "샤넬 주얼리", "샤넬 파인주얼리", "Chanel Jewelry",
        "샤넬", "Chanel"
    ],
    # ※ "샤넬"/"Chanel" 단독은 주얼리 필터 추가 적용

    "Piaget": ["Piaget", "피아제"],
    "Chaumet": ["Chaumet", "쇼메"],
    "Chopard": ["Chopard", "쇼파드"],

    "Graff": ["Graff", "그라프 다이아몬드", "그라프 주얼리"],
    # ※ "그라프" 단독 제외

    "Boucheron": ["Boucheron", "부쉐론"],

    "Dior Jewelry": [
        "Dior Jewelry", "디올 주얼리", "디올 파인주얼리"
    ],
    # ※ "Dior" 단독 제외

    "Louis Vuitton Jewelry": [
        "Louis Vuitton Jewelry", "루이비통 주얼리", "LV Jewelry",
        "루이비통", "Louis Vuitton"
    ],
    # ※ "루이비통"/"Louis Vuitton" 단독은 주얼리 필터 추가 적용
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
       → summary 없으면 title만으로 판단
       → 소스별 예외 없음
       ↓
4단계: URL 중복 제거 (deduplicate_url_only)
       → 브랜드별 독립 추적 (brand, url_hash) 페어
       → 당일 배치 내에서만 중복 체크
       → 브랜드별 탭 저장
       ↓
5단계: 제목 유사도 중복 제거 (deduplicate_title_only)
       → Jaccard 60% 이상 → 중복 제거
       → SNS 기사는 제외 (무조건 통과)
       → 이메일전송최종본 탭 저장
       → 이메일발송최종_v2 탭 저장
       → 이메일 발송
```

---

## 📁 구글 시트 구조

### 탭 구성
| 탭명 | 역할 | 컬럼 수 |
|------|------|---------|
| Van Cleef & Arpels | VCA 원본 전체 | 10열 |
| Cartier, Tiffany 등 | 각 경쟁사 원본 | 10열 |
| All_Competitors | 경쟁사 전체 종합 | 10열 |
| 전체종합 | VCA + 경쟁사 전체 | 10열 |
| **이메일전송최종본** | 기존 이메일용 (유지) | 9열 |
| **이메일발송최종_v2** | 신규 이메일용 최종본 | 9열 |
| 웹사이트_일별수집 | 56개 사이트 전체 수집 | 5열 |
| Duplicate_Check | URL 해시 기록 | — |
| Error_Log | 수집 오류 로그 | — |

### 브랜드탭 컬럼 구조 (A~J열)
| 열 | 컬럼명 | 내용 |
|----|--------|------|
| A | 수집날짜 | 코드 실행 날짜 |
| B | 발행날짜 | 기사 원문 발행일 (없으면 빈칸) |
| C | 브랜드명 | Van Cleef & Arpels / Cartier 등 |
| D | 함께노출된브랜드 | 같은 기사에 언급된 타 브랜드명 |
| E | 기사제목 | HTML 태그 제거된 순수 텍스트 |
| F | 링크 | 기사 원문 URL |
| G | 출처 | 수집 소스 (Naver News 등) |
| H | 미디어명 | 실제 언론사명 (URL에서 추출) |
| I | 타입 | TGD/BD/T/NW/SD/O/ED/TV/WM/MM/IT/SNS |
| J | 비고 | URL중복 / 발행일 확인 필요 |

### 이메일발송최종_v2 컬럼 구조 (A~I열)
| 열 | 컬럼명 | 내용 |
|----|--------|------|
| A | No | 순번 |
| B | 수집일 | 수집날짜 |
| C | 발행일 | 발행날짜 |
| D | 브랜드명 | 브랜드명 |
| E | 함께노출된브랜드 | 함께 언급된 브랜드 |
| F | 기사제목 | 클릭 시 링크 이동 (하이퍼링크) |
| G | 채널 | 포털/인스타그램/웹사이트 |
| H | 미디어명 | 실제 언론사명 |
| I | 타입 | MM/O/SNS 등 |

---

## 🏷️ 미디어 타입 기준

| 타입 | 설명 | 예시 |
|------|------|------|
| TGD | General Daily (종합일간지) | 조선, 중앙, 동아, 한겨레, 경향 |
| BD | Business Daily (경제일간지) | 한국경제, 매일경제, 서울경제 |
| T | Trade (전문지) | Fashionbiz, 어패럴뉴스, WWD Korea |
| NW | Newswire (통신사) | 연합뉴스, 뉴시스, 뉴스1 |
| SD | Sports Daily (스포츠) | 스타뉴스, 스포츠조선 |
| O | Online News (온라인 매체) | 데일리안, 뉴스픽 등 |
| ED | English Daily (영문 매체) | Korea JoongAng Daily |
| TV | Broadcasting (방송) | KBS, MBC, SBS, JTBC |
| WM | Weekly Magazine (주간지) | High Cut, 주간조선 |
| MM | Monthly Magazine (월간지) | Vogue, Elle, Bazaar, GQ, Esquire |
| IT | IT Trade (IT 전문지) | ZDNet, IT조선 |
| SNS | 인스타그램 | Instagram 채널 |

---

## 🔧 중복 제거 기준

### URL 중복 (브랜드탭)
- **(brand, url_hash) 페어** 기준 — 같은 URL도 다른 브랜드면 중복 아님
- 당일 배치 내에서만 체크
- 중복 기사도 저장 (J열에 "URL중복" 표시)

### 제목 유사도 중복 (이메일전송최종본)
- Jaccard 60% 이상 → 중복 제거
- SNS 기사는 제외
- 소스 우선순위: MM/WM > 네이버 > 다음 > 구글 > 빙

### 함께노출된브랜드 처리
브랜드 우선순위:
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

동일 URL 기사 → 우선순위 높은 브랜드에 1건
나머지는 D열(함께노출된브랜드)에 기재

---

## 📧 이메일 구조

### 섹션 순서
1. **VCA 소스별 현황** (최상단)
   - VCA수집 / URL중복 / 시트저장 / 중복제거 / 이메일노출
2. **전체 수집 현황 요약**
3. **브랜드별 저장 현황**
4. **VCA 기사 상세** (이메일발송최종_v2 기준)
5. **경쟁사 기사 통합 테이블**
6. **웹사이트 56개 현황**
   - 접속 실패 사이트 목록 (상단, No+사이트명+URL+실패원인)
   - 전체 현황 표 (No+사이트명+URL+상태+수집방법+기사수+VCA)

---

## 📅 수집 날짜 기준

| 요일 | 수집 대상 |
|------|-----------|
| 월요일 | 금~일 3일치 |
| 화~금 | 어제 1일치 |
| 토·일 | 수집 없음 |

---

## 🌐 56개 웹사이트 목록

| No | 사이트명 | URL |
|----|---------|-----|
| 1 | Vogue Korea | https://www.vogue.co.kr/ |
| 2 | Harper's Bazaar | https://www.harpersbazaar.co.kr/ |
| 3 | Marie Claire Korea | https://www.marieclairekorea.com/ |
| 4 | Cosmopolitan Korea | https://www.cosmopolitan.co.kr/ |
| 5 | W Korea | https://www.wkorea.com/ |
| 6 | Allure Korea | https://www.allurekorea.com/ |
| 7 | Singles | https://m.thesingle.co.kr/ |
| 8 | Dazed Korea | http://www.dazedkorea.com/ |
| 9 | GQ Korea | https://www.gqkorea.co.kr/ |
| 10 | Esquire Korea | https://www.esquirekorea.co.kr/ |
| 11 | Arena Korea | https://www.arenakorea.com/ |
| 12 | Noblesse | https://www.noblesse.com/ |
| 13 | Men Noblesse | https://mennoblesse.com/ |
| 14 | Y Noblesse | https://ynoblesse.com/ |
| 15 | Luxury DesignHouse | http://luxury.designhouse.co.kr/ |
| 16 | The Neighbor | https://www.theneighbor.co.kr/ |
| 17 | Galleria | https://dept.galleria.co.kr/story/style |
| 18 | Style Chosun | http://www.stylechosun.co.kr/online/ |
| 19 | Happy DesignHouse | http://happy.designhouse.co.kr/ |
| 20 | Maison Korea | https://www.maisonkorea.com/ |
| 21 | Casa | https://www.casa.co.kr/ |
| 22 | Living Sense | https://www.living-sense.co.kr/ |
| 23 | M Design | https://mdesign.designhouse.co.kr/ |
| 24 | Wedding21 | https://www.wedding21.co.kr/ |
| 25 | Wedding H | https://www.weddingh.co.kr/ |
| 26 | Woman Sense | https://www.womansense.co.kr/woman |
| 27 | Queen | http://www.queen.co.kr/ |
| 28 | Woman Chosun | https://woman.chosun.com/ |
| 29 | Woman Donga | https://woman.donga.com/ |
| 30 | Fortune Korea | https://www.fortunekorea.co.kr/ |
| 31 | CEO Partners | https://www.ceopartners.co.kr/ |
| 32 | Hankyung Money | https://magazine.hankyung.com/money/ |
| 33 | Hotel & Restaurant | http://www.hotelrestaurant.co.kr/ |
| 34 | The Edit | https://the-edit.co.kr/ |
| 35 | Hypebeast Korea | https://hypebeast.kr/ |
| 36 | Eyes Mag | https://www.eyesmag.com/ |
| 37 | WWD Korea | https://www.wwdkorea.com/ |
| 38 | The Den | https://www.theden.co.kr/ |
| 39 | Magazine B | https://magazine-b.com/ |
| 40 | Chronos | http://www.chronos.co.kr/ |
| 41 | Timeforum | https://www.timeforum.co.kr/ |
| 42 | Montres Korea | https://www.montreskorea.com/ |
| 43 | GMT Korea | https://www.gmtkoreaseoul.com/ |
| 44 | Dreams Magazine | https://www.dreamsmagazine.co.kr/ |
| 45 | Fashionbiz | https://www.fashionbiz.co.kr/ |
| 46 | WWD Korea (Naver) | https://contents.premium.naver.com/wwd/korea |
| 47 | Shinsegae Magazine | https://www.shinsegae.com/magazine/list.do |
| 48 | 1% Club | https://1percentclub.kr/ |
| 49 | Watch Manual | https://watch-manual.com/ |
| 50 | Dafanew | https://dafanew.com/ |
| 51 | Lotte Shopping Magazine | https://www.lotteshopping.com/magazine/magazineMain |
| 52 | Hyundai Department | https://www.ehyundai.com/newPortal/ST/ST007001_M.do |
| 53 | Elle Korea | https://www.elle.co.kr/ |
| 54 | Klocca | https://www.klocca.com/ |
| 55 | Timeforum VCA | https://www.timeforum.co.kr/?mid=NEWSNINFORMATION&category=4802502 |
| 56 | L'Officiel Korea | https://www.lofficielkorea.com/ |

---

## 🗂️ 파일 구조

```
vca_monitoring_python/
├── CLAUDE.md              # 프로젝트 지침 (v1.9)
├── .claude/CLAUDE.md      # 동일 내용 백업
├── .github/
│   └── workflows/
│       └── monitoring.yml # GitHub Actions 자동 실행 설정
├── .env                   # 환경변수 (API 키 등)
├── credentials.json       # 구글 서비스 계정 키
├── requirements.txt
├── main.py
├── config.py              # 키워드, 브랜드, 사이트, 타입 상수
├── run_monitoring.bat     # Windows 스케줄러 실행용
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

# 강제 실행 (토일 포함)
python main.py --force

# 특정 날짜 수집
python main.py --date 2026-03-30

# 포털만 실행
python main.py --batch portals

# 이메일만 재발송
python main.py --send-only

# 오늘 수집분만 클리닝 후 재실행
# (별도 스크립트로 오늘 날짜 행만 삭제 후 실행)
```

---

## 🤖 자동 실행 설정

### GitHub Actions (PC 꺼도 실행)
- 레포: https://github.com/jwh1400177-kitty/vca-monitoring-python
- 매일 08:00 KST 자동 실행 (월~금)
- GitHub Secrets에 환경변수 등록 완료

### Windows 작업 스케줄러 (PC 켜져 있을 때)
- VCA_Monitoring_Mon: 월요일 08:00
- VCA_Monitoring_TueFri: 화~금 08:00

### GitHub Push (코드 수정 후)
바탕화면 **git_push.bat** 더블클릭
→ 자동으로 git add . && commit && push

---

## 🐛 알려진 문제 및 한계

### 해결 완료
- ✅ URL 중복 체크 누적 버그
- ✅ 키워드 필터 미작동
- ✅ Tiffany 과다 수집
- ✅ SNS 기사 Jaccard 오탐
- ✅ 알함브라 키워드 오탐
- ✅ VCA 소스별 현황 수치 오류
- ✅ URL 중복 브랜드 간 오탐
- ✅ 56개 사이트 목록 전면 교체
- ✅ 미디어명 실제 언론사명으로 수정
- ✅ 이메일발송최종_v2 신설
- ✅ 함께노출된브랜드 처리
- ✅ GitHub Actions 자동 실행 설정

### 현재 진행 중 / 미해결
- 🔧 56개 사이트 실패 11개 (HTTP 404 등)
- 🔧 웹사이트 VCA관련 기사 매칭 개선 중
- ⚠️ 인스타그램 수집 제한적 (Google RSS 간접 수집)
- ⚠️ 발행날짜 없는 기사 처리 (비고에 표시)

### 접속 실패 사이트 11개
Singles, Dazed Korea, Luxury DesignHouse,
The Neighbor, Galleria, Happy DesignHouse,
Casa, M Design, Magazine B,
Lotte Shopping Magazine, Hyundai Department

---

## 💡 Claude Code 사용 팁

- **CLAUDE.md** = 프로젝트 기억 파일. 매 세션마다 자동으로 읽음
- **"내 동의 없이 끝까지 진행해줘"** 프롬프트에 포함하면 자동 진행
- **숫자로 검증 요청 필수** → "완료했습니다" 보고만 믿으면 안 됨
- 코드 수정 후 반드시 **git_push.bat 더블클릭**

---

*프로젝트명: VCA 미디어 모니터링 | 버전: v3.0 | 최종수정: 2026-04-02*
