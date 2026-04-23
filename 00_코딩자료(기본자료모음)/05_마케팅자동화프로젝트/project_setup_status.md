# 프로젝트 셋업 현황 (Setup Status)

> **이 파일을 읽는 Claude에게**: 이 문서는 마케팅 자동화 프로젝트의 인프라 셋업이 어디까지 완료되었는지를 담고 있습니다. 새 채팅(특히 브랜드별 채팅)을 시작할 때 이 파일을 먼저 읽고 작업을 시작하세요. "지침" 문서가 전략·원칙을 담는다면, 이 파일은 "이미 만들어진 자산과 접근 방법"을 담습니다.
>
> **마지막 업데이트**: 2026-04-21 (셋업 1차 완료 시점)

---

## 1. 셋업 진척도 한눈에

```
✅ 완료 — 프로젝트 인프라 (이 파일에 정리)
⏳ 진행 중 — Phase 1 벤치마크 라이브러리 구축 (브랜드별 채팅에서)
🔜 예정 — Phase 2 콘텐츠 생성 / Phase 3 발행 분석 / Phase 4 자율 에이전트
```

**현재 위치**: Phase 1 진입 직전. 인프라 100% 준비됨.

---

## 2. 완료된 자산 목록

### 2-1. GitHub 레포지터리 (Private)

- **URL**: https://github.com/jwh1400177-kitty/marketing-automation
- **소유자**: jwh1400177-kitty (정우형 개인 계정)
- **공개 범위**: Private (브랜드 정보·전략 문서 보관용)
- **기본 브랜치**: `main`
- **현재 커밋**: `b35153e` ("Phase 1 셋업: gspread 연동, 통합 시트 자동 생성 스크립트 추가")

### 2-2. 로컬 작업 폴더

- **경로**: `C:\Users\LG\Desktop\바이브코딩\marketing_automation_python\`
- **OS**: Windows (Git Bash 사용)
- **Python 버전**: 3.12.10
- **가상환경**: `.venv/` (Python 표준 venv 모듈)
- **활성화 명령**: `source .venv/Scripts/activate`

### 2-3. 통합 Google Sheet (마스터 데이터베이스)

- **시트 이름**: `마케팅자동화_통합시트`
- **시트 ID**: `1jWl1D-OwfqXgM5rjZ1mTewP1KkzO6odhS-otbjp5Pcs`
- **URL**: https://docs.google.com/spreadsheets/d/1jWl1D-OwfqXgM5rjZ1mTewP1KkzO6odhS-otbjp5Pcs/edit
- **소유자**: 정우형 개인 Google 계정
- **편집자**: 서비스 계정 (`marketing-automation-bot@marketing-automation.iam.gserviceaccount.com`)

#### 탭 구조 (7개)

| # | 탭 이름 | 컬럼 수 | 용도 |
|---|---|---|---|
| 1 | `벤치마크_원본` | 18 | Phase 1 수집 데이터 원본. 4개 브랜드 + 공통참고 모두 여기에 적재 |
| 2 | `후킹패턴_분석` | 6 | 1~3초 후킹 문장의 패턴 정제 |
| 3 | `해시태그_분석` | 5 | 태그 조합 패턴 |
| 4 | `CTA_분석` | 5 | CTA 문구 모음 |
| 5 | `브랜드정보` | 5 | 4개 브랜드 메타데이터 (4행 미리 채워짐) |
| 6 | `수집로그` | 5 | 스크립트 실행 이력 (자가교정 루프용) |
| 7 | `대시보드` | - | 요약 뷰 (Phase 1 완료 후 차트 추가 예정) |

#### `벤치마크_원본` 탭 컬럼 정의 (가장 중요)

```
1. 수집일
2. 매칭카테고리       ← 드롭다운: 딸기디저트 / 수제햄버거 / 카페버거복합 / 테니스레슨 / 공통참고
3. 원본카테고리       ← 자유 입력 (도넛, 베이글, 헬스장 등)
4. 플랫폼             ← 인스타릴스 / 유튜브쇼츠
5. 계정명
6. 콘텐츠URL
7. 조회수
8. 좋아요
9. 저장수
10. 공유수
11. 영상길이(초)
12. 게시일
13. 후킹문장          ← 1~3초 첫 대사
14. 본문카피          ← 캡션 전체
15. 해시태그
16. CTA
17. 적용포인트        ← "이 콘텐츠의 어떤 요소가 우리에게 적용 가능한가" 한 줄 메모
18. 비고
```

### 2-4. Google Cloud 프로젝트 (서비스 계정)

- **GCP 프로젝트 이름**: `marketing-automation`
- **활성화된 API**: Google Sheets API, Google Drive API
- **서비스 계정 이메일**: `marketing-automation-bot@marketing-automation.iam.gserviceaccount.com`
- **인증 키 파일 위치**: `credentials/service-account.json` (로컬에만 존재, Git 제외됨)
- **권한 모델**: 시트 소유자는 정우형 개인 계정, 서비스 계정은 편집자로 공유됨 (Drive 용량 0 문제 우회)

### 2-5. 작동 중인 자동화 스크립트

| 스크립트 | 위치 | 용도 |
|---|---|---|
| `create_master_sheet.py` | `shared/utilities/` | 통합 시트 7개 탭·헤더·드롭다운 자동 설정 (멱등성 보장) |

**실행 방법**:
```bash
cd ~/Desktop/바이브코딩/marketing_automation_python
source .venv/Scripts/activate
python shared/utilities/create_master_sheet.py
```

### 2-6. 폴더 구조

```
marketing_automation_python/
├── .venv/                          ← Python 가상환경 (Git 제외)
├── credentials/                    ← API 인증 (Git 제외, 로컬 전용)
│   └── service-account.json
├── phase1-benchmark/
│   ├── scripts/                    ← Phase 1 수집·분석 스크립트 들어갈 곳
│   ├── prompts/                    ← Phase 1 프롬프트
│   └── outputs/                    ← Phase 1 산출물
├── phase2-generation/              ← (비어있음, 추후 사용)
├── phase3-publishing/              ← (비어있음, 추후 사용)
├── phase4-agent/                   ← (비어있음, 추후 사용)
├── brands/
│   ├── bliss-burger/               ← 블리스버거 자료
│   │   ├── assets/                 ← 로고·컬러·폰트
│   │   └── content-log/            ← 발행 콘텐츠 기록
│   ├── four-season-berry/          ← 포시즌베리 자료 (전략 문서 별도 보유)
│   ├── bliss-cafe/                 ← 블리스버거 세컨드
│   └── monster-tennis/             ← 몬스터테니스장
├── shared/
│   ├── google-sheets-templates/    ← 시트 템플릿
│   ├── prompt-library/             ← 재사용 프롬프트
│   └── utilities/
│       └── create_master_sheet.py
├── CLAUDE.md                       ← Claude Code 작업 지침
├── README.md
├── requirements.txt                ← Python 의존성 (gspread, google-auth 등)
└── .gitignore                      ← credentials/, *.json, *.backup, .venv/ 등 차단
```

---

## 3. 4개 브랜드 메타데이터 (시트와 동일)

| 브랜드 | 매칭카테고리 코드 | 우선순위 | 폴더 |
|---|---|---|---|
| 블리스버거 | `수제햄버거` | 1순위 | `brands/bliss-burger/` |
| 포시즌베리 | `딸기디저트` | 1순위 | `brands/four-season-berry/` |
| 블리스버거 세컨드 | `카페버거복합` | 2순위 | `brands/bliss-cafe/` |
| 몬스터테니스장 | `테니스레슨` | 1순위 | `brands/monster-tennis/` |

**브랜드별 추가 정보**: `브랜드정보` 탭의 해시태그·담당매장수 컬럼은 비어 있음. 각 브랜드 채팅에서 채울 예정.

---

## 4. 새 채팅에서 작업 시작 시 권장 워크플로우

### 4-1. 브랜드별 채팅 시작 시

1. **이 파일과 "지침" 문서가 프로젝트에 첨부되어 있는지 확인** (정우형 님은 첨부했지만 Claude는 명시적으로 인지해야 함)
2. **첫 메시지 형식 권장**:
   ```
   [브랜드] (브랜드명)
   [Phase] 1
   [목표 결과물] (구체적으로)
   [제약] (예산·시간·도구)
   [채널] (인스타 릴스 / 유튜브 쇼츠)
   ```
3. **Claude의 첫 응답 권장 동작**:
   - 작업 진입 체크리스트 4항목(타겟·USP·채널·KPI) 중 누락된 것 빠르게 질문
   - 시트 구조와 매칭카테고리 코드를 즉시 활용 (재설명 불필요)
   - 결과는 항상 통합 시트(`벤치마크_원본` 등)에 적재되도록 설계

### 4-2. 데이터 적재 시 주의사항

- 모든 새 데이터는 **통합 시트의 해당 탭에 append** (덮어쓰기 금지)
- `매칭카테고리`는 반드시 5개 코드 중 하나 사용 (오타 시 드롭다운 검증으로 차단됨)
- 우리 4개 브랜드 카테고리 외 콘텐츠는 `매칭카테고리=공통참고` 로 분류

### 4-3. 코드 작업 시 주의사항

- 로컬 파일을 만들거나 수정할 때는 **Claude Code로 작업** (이 채팅 인터페이스에서는 코드만 설계, 실행은 Claude Code에서)
- 새 스크립트는 `phase1-benchmark/scripts/` 또는 `shared/utilities/`에 배치
- **인증 정보**(`credentials/service-account.json`)는 절대 채팅에 노출 금지, GitHub 커밋 금지

---

## 5. 도구 스택 빠른 참조

| 작업 종류 | 사용 도구 | 비고 |
|---|---|---|
| 전략·기획·카피 설계 | Claude (이 채팅) | |
| 코드 작성·실행 | Claude Code | 로컬 터미널에서 실행 |
| 코드·문서 버전 관리 | GitHub | private repo |
| 데이터 저장·분석 | Google Sheets (gspread) | 통합 시트 1개에 모두 |
| 무거운 데이터 처리 | Python | 가상환경 사용 |
| 이미지 생성 (Phase 2~) | Midjourney / Imagen / Flux | |
| 영상 생성 (Phase 2~) | Runway / Veo / Sora | |
| 보고서·시각자료 | Gamma / Canva | |

---

## 6. 미해결 / 후속 과제 메모

- [ ] 각 브랜드별 브리프 작성 (`brands/[브랜드명]/brief.md`) — 정보 모이는 대로
- [ ] `브랜드정보` 탭의 빈 컬럼(해시태그, 담당매장수) 채우기
- [ ] `requirements.txt`에 `pip install -r` 가이드 README에 추가
- [ ] Phase 1 벤치마크 수집 스크립트 (각 브랜드 채팅에서 진행)
- [ ] 바탕화면 `바이브코딩/` 상위 폴더가 별도 Git 저장소로 잡혀있음 — 추후 정리 검토

---

## 7. 변경 이력

- **2026-04-21**: 셋업 1차 완료. 인프라 7개 항목(GitHub·로컬·시트·GCP·스크립트·폴더·메타) 구축. 이 파일 작성.
