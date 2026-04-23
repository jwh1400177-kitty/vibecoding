/**
 * ================================================================
 *  VCA 미디어 모니터링 시스템
 *  파일명: collector_web.gs
 *  버전: v0.1d  |  최초작성: 2026-03-27  |  최종수정: 2026-03-28
 * ================================================================
 * [변경 이력]
 * v0.1a - 최초 생성 (4단계 차단우회: 직접→GoogleCache→GoogleRSS→BingRSS)
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
 * v0.1d - 주말 수집 정상 실행, 이메일 발송만 주말 제외로 수정
 * ================================================================
 */

// ═══════════════════════════════════════════════════
// ■ 웹 소스 목록 (56개)
// ═══════════════════════════════════════════════════

const WEB_SOURCES = [
  { name: "Vogue Korea",        url: "https://www.vogue.co.kr/" },
  { name: "Harper's Bazaar",    url: "https://www.harpersbazaar.co.kr/" },
  { name: "Marie Claire",       url: "https://www.marieclairekorea.com/" },
  { name: "Cosmopolitan",       url: "https://www.cosmopolitan.co.kr/" },
  { name: "W Korea",            url: "https://www.wkorea.com/" },
  { name: "Allure Korea",       url: "https://www.allurekorea.com/" },
  { name: "The Singles",        url: "https://m.thesingle.co.kr/" },
  { name: "Dazed Korea",        url: "http://www.dazedkorea.com/" },
  { name: "GQ Korea",           url: "https://www.gqkorea.co.kr/" },
  { name: "Esquire Korea",      url: "https://www.esquirekorea.co.kr/" },
  { name: "Arena Korea",        url: "https://www.arenakorea.com/" },
  { name: "Noblesse",           url: "https://www.noblesse.com/home/main.php" },
  { name: "Men Noblesse",       url: "https://mennoblesse.com/" },
  { name: "Y Noblesse",         url: "https://ynoblesse.com/" },
  { name: "Luxury",             url: "http://luxury.designhouse.co.kr/" },
  { name: "The Neighbor",       url: "https://www.theneighbor.co.kr/" },
  { name: "Galleria Style",     url: "https://dept.galleria.co.kr/story/style" },
  { name: "Style Chosun",       url: "http://www.stylechosun.co.kr/online/" },
  { name: "Happy",              url: "http://happy.designhouse.co.kr/" },
  { name: "Maison Korea",       url: "https://www.maisonkorea.com/" },
  { name: "Casa",               url: "https://www.casa.co.kr/" },
  { name: "Living Sense",       url: "https://www.living-sense.co.kr/" },
  { name: "M Design",           url: "https://mdesign.designhouse.co.kr/" },
  { name: "Wedding21",          url: "https://www.wedding21.co.kr/" },
  { name: "Wedding H",          url: "https://www.weddingh.co.kr/" },
  { name: "Woman Sense",        url: "https://www.womansense.co.kr/woman" },
  { name: "Queen",              url: "http://www.queen.co.kr/" },
  { name: "Woman Chosun",       url: "https://woman.chosun.com/" },
  { name: "Woman Donga",        url: "https://woman.donga.com/" },
  { name: "Fortune Korea",      url: "https://www.fortunekorea.co.kr/" },
  { name: "CEO Partners",       url: "https://www.ceopartners.co.kr/" },
  { name: "Hankyung Money",     url: "https://magazine.hankyung.com/money/" },
  { name: "Hotel Restaurant",   url: "http://www.hotelrestaurant.co.kr/" },
  { name: "The Edit",           url: "https://the-edit.co.kr/" },
  { name: "Hypebeast KR",       url: "https://hypebeast.kr/" },
  { name: "Eyes Mag",           url: "https://www.eyesmag.com/" },
  { name: "WWD Korea",          url: "https://www.wwdkorea.com/" },
  { name: "The Den",            url: "https://www.theden.co.kr/" },
  { name: "Magazine B",         url: "https://magazine-b.com/" },
  { name: "Chronos Korea",      url: "http://www.chronos.co.kr/" },
  { name: "Time Forum",         url: "https://www.timeforum.co.kr/" },
  { name: "Montres Korea",      url: "https://www.montreskorea.com/" },
  { name: "GMT Korea",          url: "https://www.gmtkoreaseoul.com/" },
  { name: "Dreams Magazine",    url: "https://www.dreamsmagazine.co.kr/" },
  { name: "Fashion Biz",        url: "https://www.fashionbiz.co.kr/" },
  { name: "WWD Naver Premium",  url: "https://contents.premium.naver.com/wwd/korea" },
  { name: "Shinsegae Magazine", url: "https://www.shinsegae.com/magazine/list.do" },
  { name: "1percent Club",      url: "https://1percentclub.kr/" },
  { name: "Watch Manual",       url: "https://watch-manual.com/" },
  { name: "Dafanew",            url: "https://dafanew.com/" },
  { name: "Lotte Magazine",     url: "https://www.lotteshopping.com/magazine/magazineMain" },
  { name: "Hyundai Magazine",   url: "https://www.ehyundai.com/newPortal/ST/ST007001_M.do" },
  { name: "Elle Korea",         url: "https://www.elle.co.kr/" },
  { name: "Klocca",             url: "https://www.klocca.com/" },
  { name: "Timeforum VCA",      url: "https://www.timeforum.co.kr/?mid=NEWSNINFORMATION&search_keyword=%EB%B0%98%ED%81%B4%EB%A6%AC%ED%94%84" },
  { name: "L'Officiel Korea",   url: "https://www.lofficielkorea.com/" }
];

// ═══════════════════════════════════════════════════
// ■ 차단 우회 Fetch (4단계 폴백)
// ═══════════════════════════════════════════════════

/**
 * 직접 URL 페치 시도
 * @param {string} url
 * @returns {{body:string|null, statusCode:number}}
 */
function fetchDirect(url) {
  try {
    const res  = UrlFetchApp.fetch(url, {
      headers: getDefaultHeaders(), followRedirects: true, muteHttpExceptions: true
    });
    const code = res.getResponseCode();
    const body = res.getContentText('UTF-8');
    if (code === 200 && body.length > 500) return { body, statusCode: code };
    return { body: null, statusCode: code };
  } catch (e) {
    return { body: null, statusCode: 0 };
  }
}

/**
 * Google 웹 캐시 경유 페치
 * @param {string} originalUrl
 * @returns {string|null}
 */
function tryGoogleCache(originalUrl) {
  const cacheUrl = `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(originalUrl)}`;
  try {
    Utilities.sleep(randomInt(1500, 3000));
    const res = UrlFetchApp.fetch(cacheUrl, {
      headers: getDefaultHeaders(), followRedirects: true, muteHttpExceptions: true
    });
    if (res.getResponseCode() === 200) {
      const body = res.getContentText('UTF-8');
      if (body.length > 500) return body;
    }
  } catch (_) {}
  return null;
}

/**
 * Google News RSS로 해당 도메인 키워드 간접 수집 (3단계 폴백)
 * @param {string} keyword
 * @param {string} domain
 * @returns {Object[]}
 */
function tryGoogleNewsProxy(keyword, domain) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(keyword + ' site:' + domain)}&hl=ko&gl=KR&ceid=KR:ko`;
  try {
    Utilities.sleep(randomInt(1000, 2500));
    const res = UrlFetchApp.fetch(url, {
      headers: getDefaultHeaders(), followRedirects: true, muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) return [];
    return parseRSSFeed(res.getContentText(), domain, formatDate(subtractDays(new Date(), 7)));
  } catch (_) { return []; }
}

/**
 * Bing News RSS로 해당 도메인 키워드 간접 수집 (4단계 폴백)
 * @param {string} keyword
 * @param {string} domain
 * @returns {Object[]}
 */
function tryBingNewsProxy(keyword, domain) {
  const url = `https://www.bing.com/news/search?q=${encodeURIComponent(keyword + ' site:' + domain)}&format=rss`;
  try {
    Utilities.sleep(randomInt(1000, 2500));
    const res = UrlFetchApp.fetch(url, {
      headers: getDefaultHeaders(), followRedirects: true, muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) return [];
    return parseRSSFeed(res.getContentText(), domain, formatDate(subtractDays(new Date(), 7)));
  } catch (_) { return []; }
}

/**
 * 4단계 차단 우회 포함 URL 페치
 * 로그 형식 (v0.1b): [시도]/[실패]/[성공]/[최종실패]
 * @param {string} url
 * @param {string} sourceName
 * @returns {{html:string|null, rssArticles:Object[]}}
 */
function fetchWithBypass(url, sourceName) {
  let domain = '';
  try { domain = new URL(url).hostname; } catch (_) {}

  // 1단계: 직접 접속
  Logger.log(`[시도] ${sourceName} → 직접접속 중...`);
  const { body: directBody, statusCode: directCode } = fetchDirect(url);
  if (directBody) {
    Logger.log(`[성공] ${sourceName} → 직접접속 성공`);
    return { html: directBody, rssArticles: [] };
  }

  // 2단계: Google Cache
  Logger.log(`[실패] ${sourceName} → ${directCode}, 구글캐시 시도...`);
  logError(sourceName, url, directCode, `HTTP ${directCode}`, '직접접속', '실패');
  Utilities.sleep(randomInt(1000, 2000));
  const cached = tryGoogleCache(url);
  if (cached) {
    Logger.log(`[성공] ${sourceName} → 구글캐시 경유`);
    return { html: cached, rssArticles: [] };
  }

  // 3단계: Google News RSS
  Logger.log(`[실패] ${sourceName} → 구글캐시 실패, 구글RSS 시도...`);
  const gRss = tryGoogleNewsProxy(VCA_KEYWORDS[0], domain);
  if (gRss.length > 0) {
    Logger.log(`[성공] ${sourceName} → 구글RSS 경유 ${gRss.length}건 수집`);
    return { html: null, rssArticles: gRss };
  }

  // 4단계: Bing News RSS
  Logger.log(`[실패] ${sourceName} → 구글RSS 실패, 빙RSS 시도...`);
  const bRss = tryBingNewsProxy(VCA_KEYWORDS[0], domain);
  if (bRss.length > 0) {
    Logger.log(`[성공] ${sourceName} → 빙RSS 경유 ${bRss.length}건 수집`);
    return { html: null, rssArticles: bRss };
  }

  Logger.log(`[최종실패] ${sourceName} → 4단계 모두 실패 → 0건`);
  return { html: null, rssArticles: [] };
}

// ═══════════════════════════════════════════════════
// ■ HTML 파싱
// ═══════════════════════════════════════════════════

/**
 * 기사 주변 컨텍스트에서 발행일 추출
 * @param {string} context - 앵커 주변 HTML 조각
 * @returns {string} YYYY-MM-DD 또는 오늘 날짜
 */
function extractDateFromHTML(context) {
  const m = context.match(/(\d{4})[-./](\d{2})[-./](\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : formatDate(new Date());
}

/**
 * HTML에서 모니터링 키워드 포함 기사 목록 추출
 * @param {string} html
 * @param {string} baseUrl
 * @param {string} sourceName
 * @returns {Object[]}
 */
function parseArticlesFromHTML(html, baseUrl, sourceName) {
  if (!html) return [];
  const articles = [];
  const seen     = new Set();

  const anchorRe = /<a[^>]+href=["']([^"'#\s]{4,500})["'][^>]*>([\s\S]{5,400}?)<\/a>/gi;
  let m;

  while ((m = anchorRe.exec(html)) !== null) {
    let   href = m[1].trim();
    const text = stripHtml(m[2]);
    if (text.length < 8 || text.length > 250) continue;
    if (!detectBrand(text)) continue;

    // 상대경로 절대화
    if (href.startsWith('//')) href = 'https:' + href;
    else if (href.startsWith('/')) {
      try { href = new URL(baseUrl).origin + href; } catch (_) { continue; }
    }
    if (!href.startsWith('http')) continue;
    if (seen.has(href)) continue;
    seen.add(href);

    const ctx       = html.slice(Math.max(0, m.index - 600), m.index + 200);
    const brandInfo = detectBrand(text);
    if (!brandInfo) continue;

    articles.push({
      title: text, url: href,
      publishDate: extractDateFromHTML(ctx),
      brand: brandInfo.brand, brandTab: brandInfo.brandTab, category: brandInfo.category,
      source: sourceName, mediaType: detectMediaType(sourceName), remarks: ''
    });
  }
  return articles;
}

// ═══════════════════════════════════════════════════
// ■ 배치 수집
// ═══════════════════════════════════════════════════

/**
 * WEB_SOURCES 배열의 startIdx~endIdx 범위 수집
 * @param {number} startIdx
 * @param {number} endIdx
 * @returns {number} 저장된 기사 수
 */
function collectWebBatch(startIdx, endIdx) {
  // 주말에도 수집 실행 (null → 어제 기준)
  const range = getDateRange() || { start: subtractDays(new Date(), 1), end: subtractDays(new Date(), 1) };

  const startTime = new Date();
  const batch     = WEB_SOURCES.slice(startIdx, endIdx);
  const all       = [];

  Logger.log(`▶ 웹 배치 수집: ${startIdx+1}~${Math.min(endIdx, WEB_SOURCES.length)}번 (${batch.length}개 소스)`);

  for (const source of batch) {
    if (isApproachingTimeout(startTime)) {
      Logger.log('타임아웃 임박 — 웹 배치 조기 종료');
      break;
    }
    Utilities.sleep(randomInt(1500, 4000));

    const { html, rssArticles } = fetchWithBypass(source.url, source.name);

    if (rssArticles.length > 0) {
      const tagged = rssArticles.map(a => ({ ...a, source: source.name }));
      all.push(...tagged);
    } else if (html) {
      const articles = parseArticlesFromHTML(html, source.url, source.name);
      Logger.log(`[성공] ${source.name} → HTML ${articles.length}건 수집`);
      all.push(...articles);
    } else {
      logError(source.name, source.url, 0, '4단계 폴백 모두 실패', '4단계', '실패');
    }
  }

  const saved = saveArticles(all);
  Logger.log(`=== 웹 배치(${startIdx+1}~${endIdx}) 완료: ${saved}건 저장 ===`);
  return saved;
}

/** 웹 소스 1-20 (배치 2 → 07:10) */
function collectWebBatch1() { collectWebBatch(0, 20); }

/** 웹 소스 21-40 (배치 3 → 07:20) */
function collectWebBatch2() { collectWebBatch(20, 40); }

/** 웹 소스 41-56 (배치 4 → 07:30) */
function collectWebBatch3() { collectWebBatch(40, WEB_SOURCES.length); }
