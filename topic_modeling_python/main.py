"""
빅카인즈 뉴스 데이터 토픽모델링 파이프라인
- 데이터: 빅카인즈 NewsResult CSV (약 55,000건)
- 모델: BERTopic (한국어 sentence-transformer)
- 출력: 토픽 키워드, 기사별 토픽, 월별 트렌드, 시각화
"""

import os
import sys
import re
import warnings
import traceback
from pathlib import Path
from datetime import datetime

warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────
# 0. 경로 설정
# ─────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
DATA_FILE = BASE_DIR / "빅카인즈 NewsResult_20260115-20260415.csv"
OUTPUT_DIR = BASE_DIR / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

ENCODING = "utf-8-sig"   # 빅카인즈 기본 인코딩 (UTF-8 with BOM)

# 출력 파일 경로
OUT_KEYWORDS   = OUTPUT_DIR / "topics_keywords.csv"
OUT_ARTICLES   = OUTPUT_DIR / "articles_with_topics.csv"
OUT_TREND      = OUTPUT_DIR / "topics_trend.csv"
OUT_CHART      = OUTPUT_DIR / "topics_chart.png"
OUT_LOG        = OUTPUT_DIR / "run_log.txt"


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
# 1. 라이브러리 임포트 (설치 여부 검사 포함)
# ─────────────────────────────────────────────
def check_and_import():
    """필요한 라이브러리를 임포트하고, 없으면 안내 메시지 출력 후 종료."""
    missing = []
    for pkg, import_name in [
        ("pandas",               "pandas"),
        ("konlpy",               "konlpy"),
        ("bertopic",             "bertopic"),
        ("sentence_transformers","sentence_transformers"),
        ("sklearn",              "sklearn"),
        ("matplotlib",           "matplotlib"),
        ("seaborn",              "seaborn"),
        ("umap",                 "umap"),
        ("hdbscan",              "hdbscan"),
    ]:
        try:
            __import__(import_name)
        except ImportError:
            missing.append(pkg)

    if missing:
        log(f"설치 필요 라이브러리: {missing}", "ERROR")
        log("아래 명령어로 설치 후 재실행하세요:", "ERROR")
        log(f"  pip install {' '.join(missing)}", "ERROR")
        sys.exit(1)

    log("모든 라이브러리 임포트 완료")


# ─────────────────────────────────────────────
# 2. 데이터 로딩
# ─────────────────────────────────────────────
def load_data():
    """CSV 파일을 로드하고 기본 정보를 출력한다."""
    log("=" * 55)
    log("STEP 2: 데이터 로딩")
    log("=" * 55)

    if not DATA_FILE.exists():
        log(f"파일 없음: {DATA_FILE}", "ERROR")
        log("파일 경로를 확인하세요.", "ERROR")
        sys.exit(1)

    log(f"파일: {DATA_FILE.name}")

    import pandas as pd

    # 인코딩 자동 감지 (utf-8-sig → euc-kr → cp949 순 시도)
    df = None
    for enc in [ENCODING, "euc-kr", "cp949"]:
        try:
            df = pd.read_csv(DATA_FILE, encoding=enc, low_memory=False)
            log(f"인코딩 '{enc}' 로딩 성공")
            break
        except Exception as e:
            log(f"인코딩 '{enc}' 실패: {e}", "WARN")

    if df is None:
        log("CSV 로딩 실패. 인코딩을 확인하세요.", "ERROR")
        sys.exit(1)

    log(f"총 기사 수: {len(df):,}건")
    log(f"컬럼 목록: {df.columns.tolist()}")

    # 결측치 요약
    null_counts = df.isnull().sum()
    null_cols = null_counts[null_counts > 0]
    if len(null_cols):
        log(f"결측치 현황:\n{null_cols.to_string()}")
    else:
        log("결측치 없음")

    # 일자 컬럼 정수 → 문자열 변환
    if "일자" in df.columns:
        df["일자"] = df["일자"].astype(str).str.strip()

    return df


# ─────────────────────────────────────────────
# 3. 전처리
# ─────────────────────────────────────────────
STOPWORDS = set([
    "은", "는", "이", "가", "을", "를", "에", "의", "로", "으로",
    "와", "과", "도", "만", "에서", "까지", "부터", "보다", "이다",
    "있다", "없다", "하다", "되다", "않다", "것", "수", "등", "및",
    "그", "이", "저", "것", "들", "때", "곳", "중", "더", "또",
    "어", "아", "며", "면", "고", "나", "너", "우리", "그들",
    "통해", "위해", "대한", "관련", "기자", "기사", "뉴스", "보도",
    "연합", "뉴시스", "헤럴드", "조선", "중앙", "동아", "한국",
    "오전", "오후", "지난", "올해", "올", "지난해", "내년",
    "억원", "만원", "천원", "달러", "원", "억", "만", "천",
    "이번", "다음", "이후", "현재", "최근", "지금",
])

def clean_html(text: str) -> str:
    """HTML 태그 및 특수문자 제거."""
    if not isinstance(text, str):
        return ""
    text = re.sub(r"<[^>]+>", " ", text)          # HTML 태그
    text = re.sub(r"&[a-z]+;", " ", text)          # HTML 엔티티
    text = re.sub(r"https?://\S+", " ", text)      # URL
    text = re.sub(r"[^\w\s가-힣]", " ", text)      # 특수문자 (한글/영문/숫자/공백 외)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def extract_nouns(texts: list, sample_size: int = None) -> list:
    """
    KoNLPy Okt로 명사 추출.
    sample_size: 테스트용 샘플 수 (None이면 전체)
    """
    from konlpy.tag import Okt

    okt = Okt()
    if sample_size:
        texts = texts[:sample_size]

    results = []
    total = len(texts)
    log(f"형태소 분석 시작: {total:,}건")

    for i, text in enumerate(texts):
        if i % 5000 == 0:
            log(f"  형태소 분석 진행: {i:,}/{total:,}")
        try:
            nouns = okt.nouns(text)
            # 2글자 이상, 불용어 제거
            filtered = [n for n in nouns if len(n) >= 2 and n not in STOPWORDS]
            results.append(" ".join(filtered) if filtered else "")
        except Exception as e:
            results.append("")

    log(f"형태소 분석 완료: {total:,}건")
    return results


def preprocess(df):
    """전체 전처리 파이프라인."""
    import pandas as pd

    log("=" * 55)
    log("STEP 3: 전처리")
    log("=" * 55)

    # 본문 결측치 제거
    before = len(df)
    df = df.dropna(subset=["본문"]).copy()
    df = df[df["본문"].str.strip() != ""].copy()
    log(f"본문 결측치 제거: {before:,} → {len(df):,}건 ({before - len(df):,}건 제거)")

    # 분석제외 여부 컬럼 처리
    if "분석제외 여부" in df.columns:
        before2 = len(df)
        df = df[df["분석제외 여부"].isna() | (df["분석제외 여부"] == "")].copy()
        log(f"분석제외 기사 제거: {before2:,} → {len(df):,}건")

    df = df.reset_index(drop=True)

    # HTML 태그 제거
    log("HTML 태그 제거 중...")
    df["본문_정제"] = df["본문"].apply(clean_html)

    # 키워드 컬럼 보조 활용 (있으면 본문에 추가)
    if "키워드" in df.columns:
        df["키워드"] = df["키워드"].fillna("").apply(clean_html)
        df["분석텍스트"] = df["본문_정제"] + " " + df["키워드"]
        log("키워드 컬럼을 본문에 추가 반영")
    else:
        df["분석텍스트"] = df["본문_정제"]

    # 명사 추출
    texts = df["분석텍스트"].tolist()
    df["명사추출"] = extract_nouns(texts)

    # 빈 텍스트 제거
    before3 = len(df)
    df = df[df["명사추출"].str.strip() != ""].copy().reset_index(drop=True)
    log(f"명사 추출 후 빈 문서 제거: {before3:,} → {len(df):,}건")

    log(f"전처리 완료: 최종 {len(df):,}건")
    return df


# ─────────────────────────────────────────────
# 4. BERTopic 토픽 모델링
# ─────────────────────────────────────────────
def run_bertopic(df):
    """BERTopic으로 토픽 모델링 수행."""
    from bertopic import BERTopic
    from sentence_transformers import SentenceTransformer
    from sklearn.feature_extraction.text import CountVectorizer
    from umap import UMAP
    from hdbscan import HDBSCAN

    log("=" * 55)
    log("STEP 4: BERTopic 토픽 모델링")
    log("=" * 55)

    docs = df["명사추출"].tolist()
    log(f"입력 문서 수: {len(docs):,}건")

    # 임베딩 모델 (한국어 지원)
    model_name = "snunlp/KR-ELECTRA-discriminator"
    fallback_model = "paraphrase-multilingual-MiniLM-L12-v2"

    log(f"임베딩 모델 로딩: {model_name}")
    try:
        embedding_model = SentenceTransformer(model_name)
        log("KR-ELECTRA 모델 로딩 완료")
    except Exception as e:
        log(f"KR-ELECTRA 로딩 실패: {e}", "WARN")
        log(f"폴백 모델 사용: {fallback_model}", "WARN")
        embedding_model = SentenceTransformer(fallback_model)
        log("폴백 모델 로딩 완료")

    # 임베딩 생성
    log("문서 임베딩 생성 중... (시간 소요)")
    embeddings = embedding_model.encode(
        docs,
        show_progress_bar=True,
        batch_size=128,
    )
    log(f"임베딩 완료: shape={embeddings.shape}")

    # UMAP 차원 축소
    umap_model = UMAP(
        n_neighbors=15,
        n_components=5,
        min_dist=0.0,
        metric="cosine",
        random_state=42,
    )

    # HDBSCAN 클러스터링
    hdbscan_model = HDBSCAN(
        min_cluster_size=30,
        metric="euclidean",
        cluster_selection_method="eom",
        prediction_data=True,
    )

    # CountVectorizer (한국어 공백 기반 토크나이저)
    vectorizer = CountVectorizer(
        tokenizer=lambda x: x.split(),
        token_pattern=None,
        min_df=5,
        max_df=0.95,
    )

    # BERTopic 모델 생성
    topic_model = BERTopic(
        embedding_model=embedding_model,
        umap_model=umap_model,
        hdbscan_model=hdbscan_model,
        vectorizer_model=vectorizer,
        top_n_words=10,
        verbose=True,
    )

    log("BERTopic 학습 중...")
    try:
        topics, probs = topic_model.fit_transform(docs, embeddings=embeddings)
    except Exception as e:
        log(f"BERTopic 학습 오류: {e}", "ERROR")
        traceback.print_exc()
        sys.exit(1)

    # 결과 요약
    topic_info = topic_model.get_topic_info()
    n_topics = len(topic_info[topic_info["Topic"] != -1])
    n_outlier = sum(1 for t in topics if t == -1)
    log(f"토픽 수: {n_topics}개 (아웃라이어: {n_outlier:,}건)")

    df = df.copy()
    df["topic_id"] = topics
    df["topic_prob"] = probs if not isinstance(probs, list) else [max(p) if hasattr(p, '__iter__') else p for p in probs]

    return df, topic_model, topic_info


# ─────────────────────────────────────────────
# 5. 결과 저장
# ─────────────────────────────────────────────
def save_keywords(topic_model, topic_info):
    """토픽별 상위 키워드를 CSV로 저장."""
    import pandas as pd

    rows = []
    for _, row in topic_info.iterrows():
        tid = row["Topic"]
        if tid == -1:
            continue
        words = topic_model.get_topic(tid)
        if not words:
            continue
        for rank, (word, score) in enumerate(words[:10], 1):
            rows.append({
                "topic_id": tid,
                "topic_count": row["Count"],
                "rank": rank,
                "keyword": word,
                "score": round(score, 4),
            })

    df_kw = pd.DataFrame(rows)
    df_kw.to_csv(OUT_KEYWORDS, index=False, encoding="utf-8-sig")
    log(f"토픽 키워드 저장: {OUT_KEYWORDS} ({len(topic_info)-1}개 토픽)")
    return df_kw


def save_articles(df):
    """기사별 토픽 분류 결과를 저장."""
    cols = ["뉴스 식별자", "일자", "언론사", "제목", "topic_id", "topic_prob", "URL"]
    save_cols = [c for c in cols if c in df.columns]
    df[save_cols].to_csv(OUT_ARTICLES, index=False, encoding="utf-8-sig")
    log(f"기사별 토픽 저장: {OUT_ARTICLES} ({len(df):,}건)")


# ─────────────────────────────────────────────
# 6. DTM (Dynamic Topic Modeling) — 월별 트렌드
# ─────────────────────────────────────────────
def run_dtm(df, topic_model):
    """월별 토픽 비중 변화를 계산하고 시각화한다."""
    import pandas as pd
    import matplotlib.pyplot as plt
    import matplotlib.font_manager as fm
    import seaborn as sns

    log("=" * 55)
    log("STEP 5: DTM — 월별 토픽 트렌드")
    log("=" * 55)

    # ── 한글 폰트 설정 ──
    _set_korean_font(plt, fm)

    if "일자" not in df.columns:
        log("'일자' 컬럼 없음 — DTM 건너뜀", "WARN")
        return

    # 일자 → 월 컬럼 생성 (YYYYMMDD → YYYY-MM)
    df = df.copy()
    df["월"] = df["일자"].astype(str).str[:6].apply(
        lambda x: f"{x[:4]}-{x[4:6]}" if len(x) >= 6 else "unknown"
    )
    df = df[df["월"] != "unknown"]

    # 아웃라이어(-1) 제외
    df_valid = df[df["topic_id"] != -1].copy()

    if len(df_valid) == 0:
        log("유효한 토픽 기사 없음 — DTM 건너뜀", "WARN")
        return

    # 월별 × 토픽 기사 수 피벗
    pivot = df_valid.groupby(["월", "topic_id"]).size().unstack(fill_value=0)

    # 월별 비중(%) 계산
    pivot_pct = pivot.div(pivot.sum(axis=1), axis=0) * 100

    # 상위 10개 토픽만 시각화 (전체 기사 수 기준)
    top_topics = df_valid["topic_id"].value_counts().head(10).index.tolist()
    pivot_top = pivot_pct[[c for c in top_topics if c in pivot_pct.columns]]

    # 토픽별 대표 키워드 (레이블용)
    topic_labels = {}
    for tid in top_topics:
        words = topic_model.get_topic(tid)
        if words:
            label = ", ".join([w for w, _ in words[:3]])
            topic_labels[tid] = f"T{tid}: {label}"
        else:
            topic_labels[tid] = f"T{tid}"

    pivot_top = pivot_top.rename(columns=topic_labels)

    # ── 시각화 ──
    fig, axes = plt.subplots(2, 1, figsize=(14, 12))

    # (1) 월별 토픽 비중 라인 차트
    ax1 = axes[0]
    pivot_top.plot(ax=ax1, marker="o", linewidth=2)
    ax1.set_title("월별 상위 10개 토픽 비중 변화 (%)", fontsize=14, pad=10)
    ax1.set_xlabel("월")
    ax1.set_ylabel("비중 (%)")
    ax1.legend(loc="upper right", fontsize=7, ncol=2)
    ax1.grid(True, alpha=0.3)

    # (2) 히트맵
    ax2 = axes[1]
    sns.heatmap(
        pivot_top.T,
        ax=ax2,
        cmap="YlOrRd",
        linewidths=0.5,
        annot=True,
        fmt=".1f",
        annot_kws={"size": 7},
    )
    ax2.set_title("토픽별 월별 비중 히트맵 (%)", fontsize=14, pad=10)
    ax2.set_xlabel("월")
    ax2.set_ylabel("토픽")

    plt.tight_layout(pad=3)
    plt.savefig(OUT_CHART, dpi=150, bbox_inches="tight")
    plt.close()
    log(f"시각화 저장: {OUT_CHART}")

    # CSV 저장
    pivot_pct.to_csv(OUT_TREND, encoding="utf-8-sig")
    log(f"월별 트렌드 저장: {OUT_TREND}")


def _set_korean_font(plt, fm):
    """Matplotlib 한글 폰트 설정 (윈도우/맥/리눅스 자동 감지)."""
    font_candidates = [
        "Malgun Gothic",    # 윈도우
        "AppleGothic",      # 맥
        "NanumGothic",      # 리눅스
        "NanumBarunGothic",
        "DejaVu Sans",      # 폴백
    ]
    available = {f.name for f in fm.fontManager.ttflist}
    for font in font_candidates:
        if font in available:
            plt.rcParams["font.family"] = font
            plt.rcParams["axes.unicode_minus"] = False
            log(f"한글 폰트 설정: {font}")
            return
    log("한글 폰트 미발견 — 기본 폰트 사용 (한글 깨질 수 있음)", "WARN")


# ─────────────────────────────────────────────
# 7. 토픽 요약 출력
# ─────────────────────────────────────────────
def print_topic_summary(topic_model, topic_info):
    """주요 토픽과 키워드를 콘솔에 출력한다."""
    log("=" * 55)
    log("토픽 요약 (상위 20개)")
    log("=" * 55)

    top = topic_info[topic_info["Topic"] != -1].head(20)
    for _, row in top.iterrows():
        tid = row["Topic"]
        cnt = row["Count"]
        words = topic_model.get_topic(tid)
        if not words:
            continue
        kw = ", ".join([w for w, _ in words[:7]])
        log(f"  T{tid:03d} ({cnt:,}건): {kw}")


# ─────────────────────────────────────────────
# 메인 실행
# ─────────────────────────────────────────────
def main():
    start = datetime.now()
    log("=" * 55)
    log("빅카인즈 뉴스 토픽모델링 파이프라인 시작")
    log(f"시작 시각: {start.strftime('%Y-%m-%d %H:%M:%S')}")
    log("=" * 55)

    try:
        # 1. 라이브러리 확인
        check_and_import()

        # 2. 데이터 로딩
        df = load_data()

        # 3. 전처리
        df = preprocess(df)

        # 4. BERTopic
        df, topic_model, topic_info = run_bertopic(df)

        # 5. 결과 저장
        log("=" * 55)
        log("STEP 6: 결과 저장")
        log("=" * 55)
        save_keywords(topic_model, topic_info)
        save_articles(df)

        # 6. DTM
        run_dtm(df, topic_model)

        # 7. 토픽 요약 출력
        print_topic_summary(topic_model, topic_info)

        # 완료
        elapsed = (datetime.now() - start).seconds
        log("=" * 55)
        log(f"전체 파이프라인 완료! 소요 시간: {elapsed // 60}분 {elapsed % 60}초")
        log(f"결과 폴더: {OUTPUT_DIR}")
        log("=" * 55)

    except KeyboardInterrupt:
        log("사용자 중단 (Ctrl+C)", "WARN")
    except Exception as e:
        log(f"예기치 않은 오류: {e}", "ERROR")
        traceback.print_exc()
        log("오류 대처 방법:", "ERROR")
        log("  1. pip install --upgrade bertopic sentence-transformers", "ERROR")
        log("  2. Java 설치 확인 (KoNLPy 필요): java -version", "ERROR")
        log("  3. 메모리 부족 시: preprocess() 내 sample_size 인자 활용", "ERROR")
    finally:
        save_log()
        log(f"로그 저장: {OUT_LOG}")


if __name__ == "__main__":
    main()
