"""
빅카인즈 뉴스 LDA 토픽모델링 파이프라인
- 데이터: 빅카인즈 NewsResult CSV (경제>서비스_쇼핑 / 경제>유통 / 경제>산업_기업)
- 모델: gensim LDA
- 출력: 토픽 키워드, 기사별 토픽, 월별 트렌드, CBIM 매핑
"""

import os
import re
import sys
import json
import warnings
import traceback
from pathlib import Path
from datetime import datetime

# JAVA_HOME 자동 설정 (KoNLPy 필요)
if not os.environ.get("JAVA_HOME"):
    candidates = [
        r"C:\Program Files\Java\jdk-26",
        r"C:\Program Files\Java\jdk-17",
        r"C:\Program Files\Java\jdk-11",
        r"C:\Program Files\Eclipse Adoptium\jdk-17.0.0",
    ]
    for c in candidates:
        if Path(c).exists():
            os.environ["JAVA_HOME"] = c
            break

from dotenv import load_dotenv
load_dotenv()

warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────
# 0. 경로 설정
# ─────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
DATA_FILE = BASE_DIR / "빅카인즈 NewsResult_20260115-20260415.csv"
OUTPUT_DIR = BASE_DIR / "output" / "output_v5"
OUTPUT_DIR.mkdir(exist_ok=True)

OUT_KEYWORDS = OUTPUT_DIR / "lda_topics_keywords.csv"
OUT_ARTICLES = OUTPUT_DIR / "lda_articles_topics.csv"
OUT_TREND    = OUTPUT_DIR / "lda_topics_trend.csv"
OUT_CHART    = OUTPUT_DIR / "lda_topics_chart.png"
OUT_CBIM     = OUTPUT_DIR / "lda_cbim_mapping.csv"
OUT_LOG      = OUTPUT_DIR / "lda_run_log.txt"

# 분석 대상 카테고리
TARGET_CATEGORIES = ["경제>서비스_쇼핑", "경제>유통", "경제>산업_기업"]

# LDA 파라미터
NUM_TOPICS = 7
PASSES     = 20
TOP_WORDS  = 15

# CBIM 9요소
CBIM_ELEMENTS = [
    "브랜드 코어 (Brand Core)",
    "포지셔닝",
    "개성",
    "역량",
    "비전",
    "가치",
    "문화",
    "관계",
    "표현",
]

# 불용어
STOPWORDS = set([
    # 조사/어미
    "은", "는", "이", "가", "을", "를", "에", "의", "로", "으로",
    "와", "과", "도", "만", "에서", "까지", "부터", "보다",
    # 도메인 불용어
    "기자", "뉴스", "기사", "년", "월", "일", "것", "수", "등",
    "관련", "통해", "위해", "대한", "따른", "대해", "있어",
    "진행", "운영", "제공", "최대", "지난", "오는", "올해",
    "지원", "행사", "이번", "전년", "대비", "지속",
    # 일반 불용어
    "이다", "있다", "없다", "하다", "되다", "않다", "그", "저",
    "들", "때", "곳", "중", "더", "또", "어", "아", "며", "면",
    "고", "나", "너", "우리", "그들", "오전", "오후", "지난해",
    "억원", "만원", "원", "억", "만", "천", "달러",
])


# ─────────────────────────────────────────────
# 로그 헬퍼
# ─────────────────────────────────────────────
log_lines = []

def log(msg: str, level: str = "INFO"):
    ts = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] [{level}] {msg}"
    print(line, flush=True)
    log_lines.append(line)

def save_log():
    with open(OUT_LOG, "w", encoding="utf-8") as f:
        f.write("\n".join(log_lines))


# ─────────────────────────────────────────────
# 1. 데이터 로딩 + 카테고리 필터링
# ─────────────────────────────────────────────
def load_and_filter():
    import pandas as pd

    log("=" * 55)
    log("STEP 1: 데이터 로딩 및 카테고리 필터링")
    log("=" * 55)

    if not DATA_FILE.exists():
        log(f"파일 없음: {DATA_FILE}", "ERROR")
        sys.exit(1)

    df = None
    for enc in ["utf-8-sig", "cp949", "euc-kr"]:
        try:
            df = pd.read_csv(DATA_FILE, encoding=enc, low_memory=False)
            log(f"인코딩 '{enc}' 로딩 성공 - 전체 {len(df):,}건")
            break
        except Exception:
            pass

    if df is None:
        log("CSV 로딩 실패", "ERROR")
        sys.exit(1)

    # 일자 컬럼 문자열 변환
    if "일자" in df.columns:
        df["일자"] = df["일자"].astype(str).str.strip()

    # 카테고리 필터링
    if "통합 분류1" not in df.columns:
        log("'통합 분류1' 컬럼 없음", "ERROR")
        sys.exit(1)

    before = len(df)
    df = df[df["통합 분류1"].isin(TARGET_CATEGORIES)].copy().reset_index(drop=True)
    log(f"카테고리 필터링: {before:,} → {len(df):,}건")
    log(f"  대상: {TARGET_CATEGORIES}")

    # 카테고리별 건수
    for cat, cnt in df["통합 분류1"].value_counts().items():
        log(f"  {cat}: {cnt:,}건")

    # 본문 결측치 제거
    df = df.dropna(subset=["본문"]).copy()
    df = df[df["본문"].str.strip() != ""].copy().reset_index(drop=True)
    log(f"본문 결측치 제거 후: {len(df):,}건")

    # 분석제외 제거
    if "분석제외 여부" in df.columns:
        df = df[df["분석제외 여부"].isna() | (df["분석제외 여부"] == "")].copy()
        df = df.reset_index(drop=True)
        log(f"분석제외 기사 제거 후: {len(df):,}건")

    return df


# ─────────────────────────────────────────────
# 2. 전처리
# ─────────────────────────────────────────────
def clean_html(text: str) -> str:
    if not isinstance(text, str):
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&[a-z]+;", " ", text)
    text = re.sub(r"https?://\S+", " ", text)
    text = re.sub(r"[^\w\s가-힣]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def extract_nouns(texts: list) -> list:
    from konlpy.tag import Okt
    okt = Okt()
    total = len(texts)
    log(f"형태소 분석 시작: {total:,}건")
    results = []
    for i, text in enumerate(texts):
        if i % 1000 == 0:
            log(f"  형태소 분석 진행: {i:,}/{total:,}")
        try:
            nouns = okt.nouns(text)
            filtered = [n for n in nouns if len(n) >= 2 and n not in STOPWORDS]
            results.append(filtered)
        except Exception:
            results.append([])
    log(f"형태소 분석 완료: {total:,}건")
    return results


def preprocess(df):
    import pandas as pd

    log("=" * 55)
    log("STEP 2: 전처리")
    log("=" * 55)

    # HTML 정제
    log("HTML 태그 제거 중...")
    df["본문_정제"] = df["본문"].apply(clean_html)

    # 키워드 컬럼 보조 활용
    if "키워드" in df.columns:
        df["키워드"] = df["키워드"].fillna("").apply(clean_html)
        df["분석텍스트"] = df["본문_정제"] + " " + df["키워드"]
    else:
        df["분석텍스트"] = df["본문_정제"]

    # 명사 추출
    texts = df["분석텍스트"].tolist()
    df["명사목록"] = extract_nouns(texts)

    # 빈 문서 제거
    before = len(df)
    df = df[df["명사목록"].apply(len) > 0].copy().reset_index(drop=True)
    log(f"빈 문서 제거: {before:,} → {len(df):,}건")

    log(f"전처리 완료: 최종 {len(df):,}건")
    return df


# ─────────────────────────────────────────────
# 3. LDA 학습
# ─────────────────────────────────────────────
def run_lda(df):
    from gensim import corpora
    from gensim.models import LdaModel

    log("=" * 55)
    log("STEP 3: LDA 토픽 모델링")
    log("=" * 55)
    log(f"토픽 수: {NUM_TOPICS}, passes: {PASSES}, 상위 키워드: {TOP_WORDS}")

    docs = df["명사목록"].tolist()

    # 사전 생성
    dictionary = corpora.Dictionary(docs)
    # 극단적으로 희귀하거나 너무 흔한 단어 제거
    dictionary.filter_extremes(no_below=3, no_above=0.85)
    log(f"사전 크기: {len(dictionary):,}개 단어")

    # BOW 코퍼스 생성
    corpus = [dictionary.doc2bow(doc) for doc in docs]
    log(f"코퍼스 생성 완료: {len(corpus):,}건")

    # LDA 학습
    log("LDA 학습 중... (시간 소요)")
    lda_model = LdaModel(
        corpus=corpus,
        id2word=dictionary,
        num_topics=NUM_TOPICS,
        passes=PASSES,
        random_state=42,
        alpha="auto",
        eta="auto",
        per_word_topics=True,
    )
    log("LDA 학습 완료")

    return lda_model, corpus, dictionary


# ─────────────────────────────────────────────
# 4. 결과 저장
# ─────────────────────────────────────────────
def save_keywords(lda_model):
    import pandas as pd

    rows = []
    for tid in range(NUM_TOPICS):
        words = lda_model.show_topic(tid, topn=TOP_WORDS)
        for rank, (word, weight) in enumerate(words, 1):
            rows.append({
                "topic_id": tid,
                "rank": rank,
                "keyword": word,
                "weight": round(weight, 6),
            })
    df_kw = pd.DataFrame(rows)
    df_kw.to_csv(OUT_KEYWORDS, index=False, encoding="utf-8-sig")
    log(f"토픽 키워드 저장: {OUT_KEYWORDS}")

    # 콘솔 요약
    log("=" * 55)
    log("토픽 키워드 요약")
    log("=" * 55)
    for tid in range(NUM_TOPICS):
        words = lda_model.show_topic(tid, topn=10)
        kw = ", ".join([w for w, _ in words])
        log(f"  T{tid}: {kw}")

    return df_kw


def assign_topics(df, lda_model, corpus):
    import pandas as pd

    log("기사별 토픽 할당 중...")
    topic_ids, topic_probs = [], []
    for bow in corpus:
        dist = lda_model.get_document_topics(bow, minimum_probability=0)
        best = max(dist, key=lambda x: x[1])
        topic_ids.append(best[0])
        topic_probs.append(round(best[1], 4))

    df = df.copy()
    df["topic_id"] = topic_ids
    df["topic_prob"] = topic_probs

    cols = ["뉴스 식별자", "일자", "언론사", "제목", "통합 분류1", "topic_id", "topic_prob", "URL"]
    save_cols = [c for c in cols if c in df.columns]
    df[save_cols].to_csv(OUT_ARTICLES, index=False, encoding="utf-8-sig")
    log(f"기사별 토픽 저장: {OUT_ARTICLES} ({len(df):,}건)")

    return df


# ─────────────────────────────────────────────
# 5. DTM - 월별 트렌드
# ─────────────────────────────────────────────
def run_dtm(df, lda_model):
    import pandas as pd
    import matplotlib.pyplot as plt
    import matplotlib.font_manager as fm
    import seaborn as sns

    log("=" * 55)
    log("STEP 4: DTM - 월별 토픽 트렌드")
    log("=" * 55)

    # 한글 폰트 설정
    available = {f.name for f in fm.fontManager.ttflist}
    for font in ["Malgun Gothic", "AppleGothic", "NanumGothic", "DejaVu Sans"]:
        if font in available:
            plt.rcParams["font.family"] = font
            plt.rcParams["axes.unicode_minus"] = False
            log(f"한글 폰트: {font}")
            break

    if "일자" not in df.columns:
        log("'일자' 컬럼 없음 - DTM 건너뜀", "WARN")
        return

    df = df.copy()
    df["월"] = df["일자"].astype(str).str[:6].apply(
        lambda x: f"{x[:4]}-{x[4:6]}" if len(x) >= 6 else "unknown"
    )
    df = df[df["월"] != "unknown"]

    # 토픽 레이블 (상위 3개 키워드)
    topic_labels = {}
    for tid in range(NUM_TOPICS):
        words = lda_model.show_topic(tid, topn=3)
        label = ", ".join([w for w, _ in words])
        topic_labels[tid] = f"T{tid}: {label}"

    # 월별 × 토픽 피벗
    pivot = df.groupby(["월", "topic_id"]).size().unstack(fill_value=0)
    pivot_pct = pivot.div(pivot.sum(axis=1), axis=0) * 100
    pivot_pct = pivot_pct.rename(columns=topic_labels)

    # 시각화
    fig, axes = plt.subplots(2, 1, figsize=(14, 12))

    ax1 = axes[0]
    pivot_pct.plot(ax=ax1, marker="o", linewidth=2)
    ax1.set_title("월별 토픽 비중 변화 (%)", fontsize=14, pad=10)
    ax1.set_xlabel("월")
    ax1.set_ylabel("비중 (%)")
    ax1.legend(loc="upper right", fontsize=7, ncol=2)
    ax1.grid(True, alpha=0.3)

    ax2 = axes[1]
    sns.heatmap(
        pivot_pct.T, ax=ax2, cmap="YlOrRd", linewidths=0.5,
        annot=True, fmt=".1f", annot_kws={"size": 8},
    )
    ax2.set_title("토픽별 월별 비중 히트맵 (%)", fontsize=14, pad=10)
    ax2.set_xlabel("월")
    ax2.set_ylabel("토픽")

    plt.tight_layout(pad=3)
    plt.savefig(OUT_CHART, dpi=150, bbox_inches="tight")
    plt.close()
    log(f"시각화 저장: {OUT_CHART}")

    pivot_pct.to_csv(OUT_TREND, encoding="utf-8-sig")
    log(f"월별 트렌드 저장: {OUT_TREND}")


# ─────────────────────────────────────────────
# 6. Claude API - CBIM 매핑
# ─────────────────────────────────────────────
def map_cbim(lda_model):
    import anthropic, pandas as pd

    log("=" * 55)
    log("STEP 5: Claude API - CBIM 9요소 자동 매핑")
    log("=" * 55)

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        log("ANTHROPIC_API_KEY 없음 - CBIM 매핑 건너뜀", "WARN")
        return

    client = anthropic.Anthropic(api_key=api_key)
    cbim_list = "\n".join(f"{i+1}. {e}" for i, e in enumerate(CBIM_ELEMENTS))

    # 토픽별 키워드 구성
    topics_text = "\n".join(
        f"- 토픽 T{tid}: {', '.join([w for w, _ in lda_model.show_topic(tid, topn=15)])}"
        for tid in range(NUM_TOPICS)
    )

    prompt = f"""당신은 소비자 브랜드 인사이트 분석 전문가입니다.
아래 뉴스 토픽 키워드 목록을 보고, 각 토픽을 CBIM(Consumer Brand Insight Map) 9요소 중 가장 적합한 하나에 매핑해 주세요.

[CBIM 9요소]
{cbim_list}

[토픽 키워드 목록]
{topics_text}

[출력 규칙]
- 반드시 아래 형식의 JSON 배열만 출력하세요. 설명 없이 JSON만.
- 각 항목: {{"topic_id": 숫자, "cbim_element": "요소명", "reason": "한 문장 근거"}}
- cbim_element 값은 위 9요소 이름과 정확히 일치해야 합니다.

JSON:"""

    log(f"Claude API 호출 중... (토픽 {NUM_TOPICS}개)")
    try:
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text.strip()
        raw_clean = re.sub(r"```(?:json)?", "", raw).strip().rstrip("```").strip()
        mappings = json.loads(raw_clean)
        log("Claude API 응답 완료")
    except Exception as e:
        log(f"Claude API 오류: {e}", "ERROR")
        return

    rows = []
    for item in mappings:
        tid = item.get("topic_id")
        words = lda_model.show_topic(int(tid), topn=TOP_WORDS)
        rows.append({
            "topic_id": tid,
            "top_keywords": ", ".join([w for w, _ in words]),
            "cbim_element": item.get("cbim_element", ""),
            "reason": item.get("reason", ""),
        })

    df_cbim = pd.DataFrame(rows)
    df_cbim.to_csv(OUT_CBIM, index=False, encoding="utf-8-sig")
    log(f"CBIM 매핑 저장: {OUT_CBIM} ({len(df_cbim)}개 토픽)")

    log("-" * 55)
    for _, r in df_cbim.iterrows():
        log(f"  T{int(r['topic_id'])} -> [{r['cbim_element']}] | {r['reason']}")


# ─────────────────────────────────────────────
# 메인
# ─────────────────────────────────────────────
def main():
    start = datetime.now()
    log("=" * 55)
    log("빅카인즈 뉴스 LDA 토픽모델링 파이프라인 시작")
    log(f"시작 시각: {start.strftime('%Y-%m-%d %H:%M:%S')}")
    log("=" * 55)

    try:
        # 1. 데이터 로딩 + 필터링
        df = load_and_filter()

        # 2. 전처리
        df = preprocess(df)

        # 3. LDA 학습
        lda_model, corpus, dictionary = run_lda(df)

        # 4. 결과 저장
        log("=" * 55)
        log("STEP 3-2: 결과 저장")
        log("=" * 55)
        save_keywords(lda_model)
        df = assign_topics(df, lda_model, corpus)

        # 5. DTM
        run_dtm(df, lda_model)

        # 6. CBIM 매핑
        map_cbim(lda_model)

        elapsed = (datetime.now() - start).seconds
        log("=" * 55)
        log(f"전체 완료! 소요 시간: {elapsed // 60}분 {elapsed % 60}초")
        log(f"결과 폴더: {OUTPUT_DIR}")
        log("=" * 55)

    except KeyboardInterrupt:
        log("사용자 중단 (Ctrl+C)", "WARN")
    except Exception as e:
        log(f"예기치 않은 오류: {e}", "ERROR")
        traceback.print_exc()
    finally:
        save_log()


if __name__ == "__main__":
    main()
