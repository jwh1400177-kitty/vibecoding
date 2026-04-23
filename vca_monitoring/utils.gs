/**
 * ================================================================
 *  VCA 미디어 모니터링 시스템
 *  파일명: utils.gs
 *  버전: v0.1c  |  최초작성: 2026-03-27  |  최종수정: 2026-03-28
 * ================================================================
 * [변경 이력]
 * v0.1a - 최초 생성 (v2 명세 기반 전면 재작성)
 * v0.1b - 날짜 기준 수정(수집날짜 기준 이메일), 이모지 제거,
 *         PDF 스타일 테이블 이메일, 전체 기사 발송,
 *         중복처리 변경(유사기사N건 비고2 표시),
 *         clearTodayData/clearAndRecollect 추가,
 *         runNow 파라미터 추가, Error_Log 강화
 * v0.1c - 네이버 API 우선 수집, 다음 직접접속/캐시 제거로 속도개선,
 *         날짜필터(어제 발행 기사만), 수집날짜 기준 이메일 발송,
 *         시트 자동정렬, 이모지 제거 + PDF 스타일 이메일,
 *         전체 기사 발송, 중복처리(유사기사N건),
 *         clearTodayData/clearAndRecollect 추가,
 *         runNow 구조변경, Error_Log 확장,
 *         화이트리스트 키워드 필터링 추가
 * ================================================================
 */

// ═══════════════════════════════════════════════════
// ■ 브랜드 키워드
// ═══════════════════════════════════════════════════

/** VCA 브랜드 키워드 목록 */
const VCA_KEYWORDS = [
  "Van Cleef & Arpels",
  "반클리프 아펠",
  "반클리프아펠",
  "반클리프",
  "방클리프"
];

/** 경쟁사 브랜드별 키워드 맵 */
const COMPETITOR_KEYWORDS = {
  "Cartier":               ["Cartier", "까르띠에"],
  "Piaget":                ["Piaget", "피아제"],
  "Chaumet":               ["Chaumet", "쇼메"],
  "Chopard":               ["Chopard", "쇼파드"],
  "Tiffany":               ["Tiffany", "티파니"],
  "Bvlgari":               ["Bvlgari", "Bulgari", "불가리"],
  "Graff":                 ["Graff", "그라프"],
  "Chanel Jewelry":        ["Chanel Jewelry", "샤넬 주얼리", "샤넬 파인 주얼리"],
  "Boucheron":             ["Boucheron", "부쉐론"],
  "Dior Jewelry":          ["Dior Jewelry", "디올 주얼리", "디올 파인 주얼리"],
  "Louis Vuitton Jewelry": ["Louis Vuitton Jewelry", "루이비통 주얼리"]
};

/** 브랜드 표시명 → 시트 탭 이름 */
const BRAND_TAB_MAP = {
  "Van Cleef & Arpels":    "VCA",
  "Cartier":               "Cartier",
  "Piaget":                "Piaget",
  "Chaumet":               "Chaumet",
  "Chopard":               "Chopard",
  "Tiffany":               "Tiffany",
  "Bvlgari":               "Bvlgari",
  "Graff":                 "Graff",
  "Chanel Jewelry":        "Chanel_Jewelry",
  "Boucheron":             "Boucheron",
  "Dior Jewelry":          "Dior_Jewelry",
  "Louis Vuitton Jewelry": "LV_Jewelry"
};

/** 브랜드 탭 전체 목록 (순서 유지) */
const ALL_BRAND_TABS = [
  "VCA","Cartier","Piaget","Chaumet","Chopard","Tiffany",
  "Bvlgari","Graff","Chanel_Jewelry","Boucheron","Dior_Jewelry","LV_Jewelry"
];

/** 미디어타입 키워드 → 코드 매핑 */
const MEDIA_TYPE_MAP = {
  MM:  ["Vogue","Harper","Marie Claire","Cosmopolitan","W Korea","Allure",
        "Singles","Dazed","GQ","Esquire","Arena","Noblesse","Elle","Officiel",
        "Maison","Dreams","WWD","Fashion Biz","Klocca","Chronos","GMT",
        "Montres","Timetrove","Time Forum","Timeforum","Bazaar","Luxury",
        "Wedding H","Wedding21","Woman Chosun","Style Chosun"],
  O:   ["Newsian","Chicment","Hypebeast","Eyes Mag","The Edit","Dafanew",
        "Watch Manual","1%","The Den"],
  SNS: ["Instagram"],
  TGD: ["Naver","Daum","Google","Bing"],
  BD:  ["Fortune","Hankyung","CEO Partners"],
  WM:  ["Woman Sense","Woman Donga","Queen","Happy"]
};

/** User-Agent 풀 */
const UA_POOL = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.3 Safari/605.1.15",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/112.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0"
];

// ═══════════════════════════════════════════════════
// ■ 화이트리스트 키워드 필터 (v0.1c 신규)
// ═══════════════════════════════════════════════════

/**
 * 기사 제목 화이트리스트 (하나라도 포함되면 저장, 없으면 건너뜀)
 * utils.gs 상수로 관리 → 단어 추가/제거 시 이 배열만 수정
 */
const WHITELIST_KEYWORDS = [
  // 주얼리 관련
  "주얼리", "쥬얼리", "jewelry", "jewellery",
  "반지", "목걸이", "팔찌", "귀걸이", "브로치", "펜던트",
  "다이아몬드", "루비", "에메랄드", "사파이어", "진주",
  "보석", "원석", "골드", "플래티넘",

  // 시계 관련
  "시계", "워치", "watch", "타임피스",

  // 패션/럭셔리 관련
  "컬렉션", "collection", "화보", "에디토리얼",
  "패션", "fashion", "럭셔리", "luxury",
  "하이주얼리", "파인주얼리", "fine jewelry",

  // 이벤트/마케팅 관련
  "팝업", "전시", "론칭", "출시", "신상",
  "앰배서더", "ambassador", "캠페인", "campaign",
  "매장", "부티크", "boutique",

  // 착용/스타일링 관련
  "착용", "스타일링", "코디", "룩",
  "레드카펫", "시상식", "행사"
];

/**
 * 기사 제목이 화이트리스트 조건을 충족하는지 확인
 * @param {string} title
 * @returns {boolean}
 */
function isWhitelisted(title) {
  if (!title) return false;
  const lower = title.toLowerCase();
  return WHITELIST_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
}

// ═══════════════════════════════════════════════════
// ■ 날짜 유틸리티
// ═══════════════════════════════════════════════════

/**
 * 날짜에서 n일을 뺀 Date 반환
 * @param {Date} date
 * @param {number} n
 * @returns {Date}
 */
function subtractDays(date, n) {
  const r = new Date(date);
  r.setDate(r.getDate() - n);
  return r;
}

/**
 * 날짜를 yyyy-MM-dd 문자열로 반환
 * @param {Date} date
 * @param {string} [fmt] 'YYYYMMDD' 또는 기본 'YYYY-MM-DD'
 * @returns {string}
 */
function formatDate(date, fmt) {
  if (!date) return '';
  const d  = new Date(date);
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return fmt === 'YYYYMMDD' ? `${y}${mo}${da}` : `${y}-${mo}-${da}`;
}

/**
 * 날짜를 한국어 형식으로 반환 (요일 포함)
 * @param {Date} date
 * @returns {string} 예: 2026년 3월 27일 (금)
 */
function formatDateKorean(date) {
  const DAYS = ['일','월','화','수','목','금','토'];
  const d = new Date(date);
  return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 (${DAYS[d.getDay()]})`;
}

/**
 * 수집 날짜 범위 계산
 * PropertiesService DATE_RANGE_OVERRIDE 우선 적용 (runNow targetDate 지원)
 * 토·일 → null (수집 건너뜀)
 * 월요일 → 금~일 3일치 / 화~금 → 어제 1일치
 * @returns {{start:Date, end:Date}|null}
 */
function getDateRange() {
  // 수동 오버라이드 확인 (runNow(targetDate) 호출 시 설정됨)
  const override = PropertiesService.getScriptProperties().getProperty('DATE_RANGE_OVERRIDE');
  if (override) {
    try {
      const o = JSON.parse(override);
      return { start: new Date(o.start), end: new Date(o.end) };
    } catch (_) {}
  }

  const today = new Date();
  const dow   = today.getDay(); // 0=일, 6=토
  if (dow === 0 || dow === 6) return null;
  if (dow === 1) return { start: subtractDays(today, 3), end: subtractDays(today, 1) };
  return { start: subtractDays(today, 1), end: subtractDays(today, 1) };
}

/**
 * 기사 발행날짜가 수집 범위 내인지 확인 (v0.1c)
 * @param {string|Date} publishDate
 * @param {{start:Date, end:Date}|null} range
 * @returns {boolean} 범위 내 또는 판단 불가 시 true
 */
function isInDateRange(publishDate, range) {
  if (!range) return true; // 주말 등 범위 없음 → 허용
  if (!publishDate) return true; // 날짜 불명 → 허용
  const dateStr = publishDate instanceof Date
    ? formatDate(publishDate)
    : String(publishDate).substring(0, 10);
  if (!dateStr || dateStr.length < 10) return true; // 날짜 파싱 불가 → 허용
  const rangeStart = formatDate(range.start);
  const rangeEnd   = formatDate(range.end);
  return dateStr >= rangeStart && dateStr <= rangeEnd;
}

// ═══════════════════════════════════════════════════
// ■ 문자열 유틸리티
// ═══════════════════════════════════════════════════

/**
 * 랜덤 정수 반환 [min, max]
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * HTML 태그 제거 후 순수 텍스트 반환
 * @param {string} str
 * @returns {string}
 */
function stripHtml(str) {
  if (!str) return '';
  return str.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * HTML 특수문자 이스케이프
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;')
            .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/**
 * URL을 MD5 해시 문자열로 변환
 * @param {string} url
 * @returns {string}
 */
function hashUrl(url) {
  if (!url) return '';
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, url);
  return bytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

/**
 * URL 정규화 (중복 비교용)
 * http→https, www 제거, 쿼리스트링·앵커·말미슬래시 제거
 * @param {string} url
 * @returns {string}
 */
function normalizeUrl(url) {
  if (!url) return '';
  return url.trim()
    .toLowerCase()
    .replace(/^http:\/\//, 'https://')
    .replace(/^https:\/\/www\./, 'https://')
    .replace(/[?#].*$/, '')
    .replace(/\/$/, '');
}

/**
 * 기사 제목을 최대 60자로 자름 (초과 시 "..." 처리)
 * @param {string} title
 * @returns {string}
 */
function truncTitle(title) {
  if (!title) return '';
  return title.length > 60 ? title.slice(0, 60) + '...' : title;
}

/**
 * 실행 시간이 5분 30초를 초과했는지 확인
 * @param {Date} startTime
 * @returns {boolean}
 */
function isApproachingTimeout(startTime) {
  return (new Date() - startTime) / 1000 > 330;
}

// ═══════════════════════════════════════════════════
// ■ 브랜드 / 미디어 탐지
// ═══════════════════════════════════════════════════

/**
 * 텍스트에서 브랜드 감지
 * @param {string} text
 * @returns {{brand:string, brandTab:string, category:string}|null}
 */
function detectBrand(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const kw of VCA_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) {
      return { brand: "Van Cleef & Arpels", brandTab: "VCA", category: "VCA" };
    }
  }
  for (const [brandName, keywords] of Object.entries(COMPETITOR_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) {
        return { brand: brandName, brandTab: BRAND_TAB_MAP[brandName], category: "Competitor" };
      }
    }
  }
  return null;
}

/**
 * 출처명으로 미디어 타입 코드 반환
 * @param {string} sourceName
 * @returns {string} MM | O | SNS | TGD | BD | WM
 */
function detectMediaType(sourceName) {
  if (!sourceName) return 'O';
  const lower = sourceName.toLowerCase();
  for (const [type, kws] of Object.entries(MEDIA_TYPE_MAP)) {
    if (kws.some(k => lower.includes(k.toLowerCase()))) return type;
  }
  return 'O';
}

/**
 * 기본 HTTP 요청 헤더 반환 (랜덤 UA 포함)
 * @returns {Object}
 */
function getDefaultHeaders() {
  return {
    "User-Agent":                UA_POOL[randomInt(0, UA_POOL.length - 1)],
    "Accept":                    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language":           "ko-KR,ko;q=0.9,en-US;q=0.8",
    "Accept-Encoding":           "gzip, deflate, br",
    "Connection":                "keep-alive",
    "Cache-Control":             "max-age=0",
    "Upgrade-Insecure-Requests": "1",
    "Referer":                   "https://www.google.com/"
  };
}

// ═══════════════════════════════════════════════════
// ■ 제목 유사도 (2-gram Jaccard)
// ═══════════════════════════════════════════════════

/**
 * 두 문자열의 2-gram Jaccard 유사도 계산 (0~1)
 * 0.9 이상이면 중복으로 처리
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function titleSimilarity(a, b) {
  if (!a || !b) return 0;
  const bigrams = s => {
    const n = s.replace(/\s+/g, '').toLowerCase();
    const set = new Set();
    for (let i = 0; i < n.length - 1; i++) set.add(n.slice(i, i + 2));
    return set;
  };
  const A = bigrams(a);
  const B = bigrams(b);
  if (!A.size || !B.size) return 0;
  let intersection = 0;
  for (const g of A) if (B.has(g)) intersection++;
  return intersection / (A.size + B.size - intersection);
}

/**
 * 모든 모니터링 키워드를 단일 배열로 반환
 * @returns {string[]}
 */
function getAllKeywords() {
  const all = [...VCA_KEYWORDS];
  for (const kws of Object.values(COMPETITOR_KEYWORDS)) all.push(...kws);
  return all;
}
