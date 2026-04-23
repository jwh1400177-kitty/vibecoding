/**
 * ================================================================
 *  VCA 미디어 모니터링 시스템
 *  파일명: collector_portals.gs
 *  버전: v0.1d  |  최초작성: 2026-03-27  |  최종수정: 2026-03-28
 * ================================================================
 * [변경 이력]
 * v0.1a - 최초 생성 (Naver API/HTML + Daum 4단계폴백 + Google/Bing RSS)
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
// ■ RSS XML 공통 파서
// ═══════════════════════════════════════════════════

/**
 * RSS XML 문자열에서 기사 목록 파싱
 * @param {string} xml
 * @param {string} source
 * @param {string} [afterDate] - YYYY-MM-DD
 * @returns {Object[]}
 */
function parseRSSFeed(xml, source, afterDate) {
  const articles = [];
  if (!xml) return articles;

  const itemRe    = /<item>([\s\S]*?)<\/item>/g;
  const titleRe   = /<title>(?:<!\[CDATA\[)?([^\]<]+?)(?:\]\]>)?<\/title>/;
  const linkRe    = /<link>([^<]+)<\/link>/;
  const pubDateRe = /<pubDate>([^<]+)<\/pubDate>/;
  let m;

  while ((m = itemRe.exec(xml)) !== null) {
    const c     = m[1];
    const tM    = titleRe.exec(c);
    const lM    = linkRe.exec(c);
    const dM    = pubDateRe.exec(c);
    if (!tM || !lM) continue;

    const title   = tM[1].trim();
    const url     = lM[1].trim();
    const pubDate = dM ? formatDate(new Date(dM[1])) : '';
    if (afterDate && pubDate && pubDate < afterDate) continue;

    const brandInfo = detectBrand(title);
    if (!brandInfo) continue;

    articles.push({
      title, url, publishDate: pubDate,
      brand: brandInfo.brand, brandTab: brandInfo.brandTab, category: brandInfo.category,
      source, mediaType: detectMediaType(source), remarks: source + ' RSS'
    });
  }
  return articles;
}

// ═══════════════════════════════════════════════════
// ■ Google News RSS
// ═══════════════════════════════════════════════════

/**
 * Google News RSS에서 단일 키워드 검색
 * @param {string} keyword
 * @param {string} afterDate - YYYY-MM-DD
 * @returns {Object[]}
 */
function searchGoogleNewsRSS(keyword, afterDate) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}+after:${afterDate}&hl=ko&gl=KR&ceid=KR:ko`;
  try {
    Utilities.sleep(randomInt(800, 2000));
    const res = UrlFetchApp.fetch(url, {
      headers: getDefaultHeaders(), followRedirects: true, muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) return [];
    return parseRSSFeed(res.getContentText(), 'Google News', afterDate);
  } catch (e) {
    Logger.log(`Google News RSS 오류 (${keyword}): ${e.message}`);
    return [];
  }
}

// ═══════════════════════════════════════════════════
// ■ Bing News RSS
// ═══════════════════════════════════════════════════

/**
 * Bing News RSS에서 단일 키워드 검색
 * @param {string} keyword
 * @param {string} afterDate - YYYY-MM-DD
 * @returns {Object[]}
 */
function searchBingNewsRSS(keyword, afterDate) {
  const url = `https://www.bing.com/news/search?q=${encodeURIComponent(keyword)}&format=rss`;
  try {
    Utilities.sleep(randomInt(800, 2000));
    const res = UrlFetchApp.fetch(url, {
      headers: getDefaultHeaders(), followRedirects: true, muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) return [];
    return parseRSSFeed(res.getContentText(), 'Bing News', afterDate);
  } catch (e) {
    Logger.log(`Bing News RSS 오류 (${keyword}): ${e.message}`);
    return [];
  }
}

// ═══════════════════════════════════════════════════
// ■ Naver (3단계 폴백: API → HTML → Google RSS)
// ═══════════════════════════════════════════════════

/**
 * 네이버 검색 API로 뉴스 수집 (1순위)
 * NAVER_CLIENT_ID 있을 때만 동작
 * @param {string} keyword
 * @param {string} afterDate - YYYY-MM-DD
 * @returns {Object[]|null} null = API 키 없음, [] = 결과 없음/실패
 */
function searchNaverAPI(keyword, afterDate) {
  const props     = PropertiesService.getScriptProperties();
  const clientId  = props.getProperty('NAVER_CLIENT_ID');
  const clientSec = props.getProperty('NAVER_CLIENT_SECRET');
  if (!clientId || !clientSec) return null; // API 키 없음 → HTML 폴백 신호

  const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(keyword)}&display=20&sort=date`;
  try {
    const res  = UrlFetchApp.fetch(url, {
      headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSec },
      muteHttpExceptions: true
    });
    const code = res.getResponseCode();
    if (code !== 200) {
      logError('Naver API', url, code, `HTTP ${code}`, 'API', '실패');
      return [];
    }

    const json     = JSON.parse(res.getContentText());
    const articles = [];
    for (const item of (json.items || [])) {
      const pubDate   = formatDate(new Date(item.pubDate));
      if (afterDate && pubDate < afterDate) continue;
      const title     = stripHtml(item.title);
      const brandInfo = detectBrand(title + ' ' + (item.description || ''));
      if (!brandInfo) continue;
      articles.push({
        title, url: item.link, publishDate: pubDate,
        brand: brandInfo.brand, brandTab: brandInfo.brandTab, category: brandInfo.category,
        source: 'Naver', mediaType: 'TGD', remarks: '네이버 API'
      });
    }
    return articles;
  } catch (e) {
    Logger.log(`네이버 API 오류 (${keyword}): ${e.message}`);
    logError('Naver API', url, 0, e.message, 'API', '실패');
    return [];
  }
}

/**
 * 네이버 뉴스 HTML 크롤링 (2순위: API 실패 시)
 * @param {string} keyword
 * @param {string} startCompact - YYYYMMDD
 * @param {string} endCompact   - YYYYMMDD
 * @returns {Object[]}
 */
function searchNaverHTML(keyword, startCompact, endCompact) {
  const url = `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(keyword)}&sort=1&pd=3&ds=${startCompact}&de=${endCompact}`;
  try {
    Utilities.sleep(randomInt(1500, 3500));
    const { html } = fetchWithBypass(url, 'Naver HTML');
    if (!html) return [];

    const articles = [];
    const re = /class="news_tit"[^>]*href="([^"]+)"[^>]*title="([^"]+)"/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      const title     = m[2].trim();
      const brandInfo = detectBrand(title);
      if (!brandInfo) continue;
      articles.push({
        title, url: m[1], publishDate: formatDate(new Date()),
        brand: brandInfo.brand, brandTab: brandInfo.brandTab, category: brandInfo.category,
        source: 'Naver', mediaType: 'TGD', remarks: '네이버 HTML'
      });
    }
    return articles;
  } catch (e) {
    Logger.log(`네이버 HTML 오류 (${keyword}): ${e.message}`);
    logError('Naver HTML', url, 0, e.message, 'HTML크롤링', '실패');
    return [];
  }
}

/**
 * 네이버 키워드를 Google News RSS로 수집 (3순위: HTML도 실패 시)
 * @param {string} keyword
 * @param {string} afterDate
 * @returns {Object[]}
 */
function searchNaverViaGoogleRSS(keyword, afterDate) {
  return searchGoogleNewsRSS(`site:news.naver.com ${keyword}`, afterDate);
}

// ═══════════════════════════════════════════════════
// ■ Daum (Google RSS → Bing RSS, v0.1c: 직접접속/캐시 제거)
// ═══════════════════════════════════════════════════

/**
 * Daum 뉴스 키워드 검색 (v0.1c: RSS만 사용, 직접접속/캐시 제거)
 * 1순위: Google News RSS (site:daum.net)
 * 2순위: Bing News RSS  (site:daum.net)
 * 응답 대기 최대 3초
 * @param {string} keyword
 * @param {string} afterDate - YYYY-MM-DD
 * @returns {Object[]}
 */
function searchDaum(keyword, afterDate) {
  const domain = 'news.daum.net';

  // 1순위: Google News RSS (site:daum.net)
  try {
    const gUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(`site:${domain} ${keyword}`)}&hl=ko&gl=KR&ceid=KR:ko`;
    const gRes = UrlFetchApp.fetch(gUrl, {
      headers: getDefaultHeaders(), followRedirects: true, muteHttpExceptions: true,
      timeout: 3000
    });
    if (gRes.getResponseCode() === 200) {
      const gArticles = parseRSSFeed(gRes.getContentText(), 'Daum', afterDate);
      if (gArticles.length > 0) return gArticles;
    }
  } catch (_) {}

  Utilities.sleep(randomInt(500, 1000));

  // 2순위: Bing News RSS (site:daum.net)
  try {
    const bUrl = `https://www.bing.com/news/search?q=${encodeURIComponent(`site:${domain} ${keyword}`)}&format=rss`;
    const bRes = UrlFetchApp.fetch(bUrl, {
      headers: getDefaultHeaders(), followRedirects: true, muteHttpExceptions: true,
      timeout: 3000
    });
    if (bRes.getResponseCode() === 200) {
      return parseRSSFeed(bRes.getContentText(), 'Daum', afterDate);
    }
  } catch (_) {}

  return [];
}

// ═══════════════════════════════════════════════════
// ■ 포털 전체 수집 (배치 1 진입점)
// ═══════════════════════════════════════════════════

/**
 * 포털 3개(Naver+Daum+Google News)에서 모든 키워드 수집
 *
 * 네이버 수집 순서 (v0.1c):
 *  1순위: 네이버 API (NAVER_CLIENT_ID 있을 때)
 *  2순위: 네이버 HTML 크롤링 (API 실패/없을 때)
 *  3순위: Google News RSS site:news.naver.com (HTML도 실패 시)
 *
 * 다음 수집 (v0.1c): Google RSS → Bing RSS (직접접속/캐시 제거)
 *
 * @returns {number} 저장된 기사 수
 */
function collectFromPortals() {
  // 주말에도 수집 실행 (null → 어제 기준)
  const range = getDateRange() || { start: subtractDays(new Date(), 1), end: subtractDays(new Date(), 1) };

  const startTime    = new Date();
  const afterDate    = formatDate(range.start);
  const startCompact = formatDate(range.start, 'YYYYMMDD');
  const endCompact   = formatDate(range.end,   'YYYYMMDD');

  // VCA + 주요 경쟁사 키워드 (시간 절약)
  const priorityKws = [
    ...VCA_KEYWORDS,
    "까르띠에","Cartier","피아제","쇼메","티파니","Tiffany","불가리","Bvlgari",
    "쇼파드","부쉐론","그라프","샤넬 주얼리","디올 주얼리","루이비통 주얼리"
  ];

  const all = [];
  Logger.log(`▶ 포털 수집 시작 (키워드 ${priorityKws.length}개, 발행기간: ${afterDate} ~ ${formatDate(range.end)})`);

  for (const kw of priorityKws) {
    if (isApproachingTimeout(startTime)) {
      Logger.log('타임아웃 임박 — 포털 수집 조기 종료');
      break;
    }

    // ── Google News RSS (항상 수집) ──
    all.push(...searchGoogleNewsRSS(kw, afterDate));

    // ── 네이버 3단계 폴백 ──
    const apiResult = searchNaverAPI(kw, afterDate);
    if (apiResult === null) {
      // API 키 없음 → HTML 시도
      const htmlResult = searchNaverHTML(kw, startCompact, endCompact);
      if (htmlResult.length > 0) {
        all.push(...htmlResult);
      } else {
        // HTML도 실패 → Google RSS (site:news.naver.com)
        all.push(...searchNaverViaGoogleRSS(kw, afterDate));
      }
    } else if (apiResult.length > 0) {
      all.push(...apiResult);
    } else {
      // API 호출했지만 결과 없음 → HTML 시도
      const htmlResult = searchNaverHTML(kw, startCompact, endCompact);
      if (htmlResult.length > 0) {
        all.push(...htmlResult);
      } else {
        all.push(...searchNaverViaGoogleRSS(kw, afterDate));
      }
    }

    // ── 다음 (v0.1c: RSS만, 직접접속/캐시 없음) ──
    all.push(...searchDaum(kw, afterDate));

    Utilities.sleep(randomInt(300, 800));
  }

  const saved = saveArticles(all);
  Logger.log(`=== 포털 수집 완료: ${saved}건 저장 ===`);
  return saved;
}
