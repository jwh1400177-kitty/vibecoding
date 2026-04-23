/**
 * ================================================================
 *  섬유패션 키워드 뉴스 자동 수집 시스템
 *  KeywordCollector.gs
 *  버전: v1.0.1g  |  작성일: 2026-03-26  |  최종수정: 2026-03-26
 * ================================================================
 * [변경 이력]
 * v1.0.0  - 최초 생성 (네이버+다음+구글 3개 매체)
 * v1.0.1a - 다음 URL 교체, Date 비교 버그 수정, runNow 재설계, clearAllSheets 추가
 * v1.0.1b - 버전 정보 체계 도입
 * v1.0.1c - 구글뉴스 제거, 다음 3단계 폴백, 이메일 용량 최적화, 중복제거 강화
 * v1.0.1d - 다음 URL 교체, 403 자동갱신, 이모지 제거, 발행일 형식 수정
 * v1.0.1f - 이메일 수신자 2명, 다음 3단계 크롤링, 카카오 상세 로그, 키워드별 수집 로그
 * v1.0.1g - 다음 RSS 4단계 우회수집, 카카오 메시지 1000자 개선, 카카오 토큰 5시간 자동갱신
 *
 * [PropertiesService 등록 항목]
 *   NAVER_CLIENT_ID     : 네이버 Client ID
 *   NAVER_CLIENT_SECRET : 네이버 Client Secret
 *   KAKAO_TOKEN         : 카카오 access_token (메시지 전송용)
 *   KAKAO_REFRESH_TOKEN : 카카오 refresh_token (자동 갱신용)
 *   KAKAO_REST_API_KEY  : 카카오 REST API 키 (토큰 갱신 요청용)
 *   KAKAO_CLIENT_SECRET : 카카오 Client Secret (선택, 없으면 빈값으로 요청)
 *   SPREADSHEET_ID      : 구글시트 ID (URL의 /d/ 뒤 값)
 *   ADMIN_EMAIL         : 이메일 수신자1 (필수)
 *   ADMIN_EMAIL2        : 이메일 수신자2 (선택, 없으면 skip)
 *
 * [실행 순서]
 *   1. setupTriggers()     - 트리거 등록 (최초 1회)
 *                            collectAndSave(07:30), runKeywordWorkflow(08:00),
 *                            refreshKakaoToken(5시간마다)
 *   2. clearAllSheets()    - 기존 데이터 초기화 (테스트 전)
 *   3. runNow()            - 전체 워크플로 수동 테스트
 *   4. refreshKakaoToken() - 카카오 토큰 수동 갱신 테스트
 * ================================================================
 */


// ================================================================
// 전역 설정
// ================================================================
const PROPS        = PropertiesService.getScriptProperties();
const ADMIN_EMAIL  = PROPS.getProperty('ADMIN_EMAIL');
const NAVER_ID     = PROPS.getProperty('NAVER_CLIENT_ID');
const NAVER_SECRET = PROPS.getProperty('NAVER_CLIENT_SECRET');
const SHEET_ID     = PROPS.getProperty('SPREADSHEET_ID');


// ================================================================
// 검색 키워드 설정 - 4개 카테고리
// sheetName : 시트 탭 이름
// label     : 이메일/카카오 표시명
// ================================================================
const CATEGORIES = {
  '섬유패션일반': {
    sheetName: '🔍섬유패션일반',
    label:     '[섬유패션일반]',
    keywords: [
      '섬유', '패션', '의류', '봉제', '염색', '화섬', '섬유기계',
      '신발', '골프웨어', '이너웨어', '군복', '교복',
      '직물', '한복', '아웃도어', '애슬레저'
    ]
  },
  '주요인물': {
    sheetName: '🔍주요인물',
    label:     '[주요인물]',
    keywords: [
      '최병오', '성기학', '성래은', '김웅기', '강태선', '서순희', '최준호'
    ]
  },
  '주요기업': {
    sheetName: '🔍주요기업',
    label:     '[주요기업]',
    keywords: [
      '섬유산업연합회', '섬산련', '패션협회', '섬유개발연구원',
      '산업부', '형지', '영원무역', '노스페이스',
      '블랙야크', '던필드그룹', '효성', '코오롱', '무신사'
    ]
  },
  '산업시장동향': {
    sheetName: '🔍산업시장동향',
    label:     '[산업시장동향]',
    keywords: [
      '성장률', '유가', '산업용 전기요금', '환율', '근로시간',
      '최저임금', '개성공단', 'SPA', 'FTA',
      '섬유전시회', '패션전시회', '프리뷰', 'PIS', 'PID'
    ]
  }
};

const SUMMARY_SHEET_NAME     = '🔍키워드종합';
const EMAIL_MAX_PER_CATEGORY = 10;

// 다음 섹션 RSS 목록 (키워드 필터링용)
const DAUM_SECTION_RSS = [
  'https://news.daum.net/rss/society',
  'https://news.daum.net/rss/economic',
  'https://news.daum.net/rss/foreign'
];

// 다음 우회 수집 공통 User-Agent (모바일)
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) ' +
                  'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';


// ================================================================
// 메인 실행 함수 - 전송 트리거 등록용 (평일 8:00)
// ================================================================
function runKeywordWorkflow() {
  var today     = new Date();
  var dayOfWeek = today.getDay();

  if (dayOfWeek === 0 || dayOfWeek === 6) {
    Logger.log('주말은 발송하지 않습니다. 종료.');
    return;
  }

  Logger.log('=== 섬유패션 뉴스 발송 시작 (' + fmtDate(today) + ') ===');

  try {
    var allArticles = readFromSheets();
    var totalCount  = 0;
    Object.keys(allArticles).forEach(function(k) { totalCount += allArticles[k].length; });

    if (totalCount === 0) {
      Logger.log('발송할 기사가 없습니다. 종료.');
      return;
    }
    Logger.log('발송 대상: ' + totalCount + '건');

    var emailLink = sendEmailReport(allArticles, today);
    Logger.log('이메일 완료: ' + emailLink);

    sendKakaoMessage(allArticles, today, emailLink);
    Logger.log('카카오 완료');

    Logger.log('=== 발송 완료 ===');
  } catch (e) {
    Logger.log('runKeywordWorkflow 오류: ' + e.message);
    Logger.log(e.stack);
  }
}


// ================================================================
// 수집 및 저장 함수 - 수집 트리거 등록용 (매일 7:30)
// ================================================================
function collectAndSave() {
  Logger.log('=== 섬유패션 뉴스 수집 시작 ===');
  try {
    var dateRange   = getDateRange();
    Logger.log('수집 날짜 범위: ' + fmtDate(dateRange.start) + ' ~ ' + fmtDate(dateRange.end));

    var allArticles = collectAllKeywords(dateRange);

    var grand = 0;
    Object.keys(allArticles).forEach(function(cat) {
      Logger.log('[' + cat + '] ' + allArticles[cat].length + '건');
      grand += allArticles[cat].length;
    });
    Logger.log('총 수집: ' + grand + '건');

    saveToSheets(allArticles);
    Logger.log('=== 수집 및 저장 완료 ===');
  } catch (e) {
    Logger.log('collectAndSave 오류: ' + e.message);
    Logger.log(e.stack);
  }
}


// ================================================================
// 날짜 범위 계산
// 월요일: 금(3일전)~일(어제) / 그 외: 어제 하루
// ================================================================
function getDateRange() {
  var today     = new Date();
  today.setHours(0, 0, 0, 0);
  var dayOfWeek = today.getDay();

  var startDate, endDate;

  if (dayOfWeek === 1) {
    startDate = new Date(today);
    startDate.setDate(today.getDate() - 3);
    endDate   = new Date(today);
    endDate.setDate(today.getDate() - 1);
  } else {
    startDate = new Date(today);
    startDate.setDate(today.getDate() - 1);
    endDate   = new Date(today);
    endDate.setDate(today.getDate() - 1);
  }

  var days = [];
  var cur  = new Date(startDate);
  while (cur <= endDate) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }

  return { start: startDate, end: endDate, days: days };
}


// ================================================================
// 전체 키워드 수집 메인 (네이버 + 다음)
// 키워드별 건수 + 카테고리 소계 로그
// ================================================================
function collectAllKeywords(dateRange) {
  var result = {};

  Object.keys(CATEGORIES).forEach(function(categoryName) {
    var config      = CATEGORIES[categoryName];
    Logger.log('▶ 카테고리: ' + categoryName);
    var rawArticles = [];

    config.keywords.forEach(function(keyword) {
      try {
        var naverItems = searchNaver(keyword, dateRange);
        naverItems.forEach(function(a) { rawArticles.push(a); });
        Logger.log('  [네이버] ' + keyword + ': ' + naverItems.length + '건');

        var daumItems = searchDaum(keyword, dateRange);
        daumItems.forEach(function(a) { rawArticles.push(a); });
        Logger.log('  [다음]   ' + keyword + ': ' + daumItems.length + '건');

        Utilities.sleep(300);
      } catch (keywordErr) {
        Logger.log('  [오류] [' + keyword + ']: ' + keywordErr.message);
      }
    });

    // 카테고리 소계 (중복제거 전/후)
    var rawCount = rawArticles.length;
    var deduped  = deduplicateArticles(rawArticles);
    result[categoryName] = deduped;
    Logger.log('카테고리 [' + categoryName + '] 소계: ' + rawCount + '건 (중복제거 후: ' + deduped.length + '건)');
  });

  return result;
}


// ================================================================
// 네이버 뉴스 검색 API
// 키워드당 최대 10건, sort=date (최신순)
// ================================================================
function searchNaver(keyword, dateRange) {
  var articles = [];

  if (!NAVER_ID || !NAVER_SECRET) {
    Logger.log('네이버 API 키 미설정');
    return articles;
  }

  try {
    var url = 'https://openapi.naver.com/v1/search/news.json' +
              '?query=' + encodeURIComponent(keyword) +
              '&display=10&sort=date';

    var response = UrlFetchApp.fetch(url, {
      method:  'get',
      headers: {
        'X-Naver-Client-Id':     NAVER_ID,
        'X-Naver-Client-Secret': NAVER_SECRET
      },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      Logger.log('네이버 오류 (' + keyword + '): HTTP ' + response.getResponseCode());
      return articles;
    }

    var json = JSON.parse(response.getContentText());
    if (!json.items || !json.items.length) return articles;

    json.items.forEach(function(item) {
      var pubDate = new Date(item.pubDate);
      if (!isInDateRange(pubDate, dateRange)) return;

      var articleUrl = (item.originallink && item.originallink.trim())
                     ? item.originallink : item.link;

      articles.push({
        collectedDate: new Date(),
        publishDate:   pubDate,
        keyword:       keyword,
        source:        '네이버',
        title:         stripHtml(item.title),
        url:           articleUrl,
        note:          ''
      });
    });

  } catch (e) {
    Logger.log('searchNaver 오류 (' + keyword + '): ' + e.message);
  }

  return articles;
}


// ================================================================
// 다음 뉴스 우회 수집 - 4단계 시도 [수정 1]
// GAS IP 차단 우회: RSS 기반 키워드 필터링 방식
//
// 시도1: 다음 모바일 뉴스 플래시 RSS → 키워드 필터링
// 시도2: 다음 뉴스 섹션별 RSS (사회/경제/해외) → 키워드 필터링
// 시도3: 구글 뉴스 RSS (site:daum.net 검색)
// 시도4: 빙 뉴스 RSS
// 전부 실패 시 빈 배열 반환 → 네이버만으로 계속 진행
// ================================================================
function searchDaum(keyword, dateRange) {

  // 시도 1: 다음 모바일 뉴스 플래시 RSS
  try {
    var a1 = searchDaumMobileRss(keyword, dateRange);
    if (a1.length > 0) {
      Logger.log('    [다음-시도1/모바일RSS] 성공: ' + a1.length + '건');
      return a1;
    }
    Logger.log('    [다음-시도1/모바일RSS] 0건, 시도2로 전환');
  } catch (e1) {
    Logger.log('    [다음-시도1/모바일RSS] 오류: ' + e1.message.substring(0, 80));
  }

  // 시도 2: 다음 섹션별 RSS (사회/경제/해외)
  try {
    var a2 = searchDaumSectionRss(keyword, dateRange);
    if (a2.length > 0) {
      Logger.log('    [다음-시도2/섹션RSS] 성공: ' + a2.length + '건');
      return a2;
    }
    Logger.log('    [다음-시도2/섹션RSS] 0건, 시도3으로 전환');
  } catch (e2) {
    Logger.log('    [다음-시도2/섹션RSS] 오류: ' + e2.message.substring(0, 80));
  }

  // 시도 3: 구글 뉴스 RSS (site:daum.net)
  try {
    var a3 = searchGoogleNewsRss(keyword, dateRange);
    if (a3.length > 0) {
      Logger.log('    [다음-시도3/구글RSS] 성공: ' + a3.length + '건');
      return a3;
    }
    Logger.log('    [다음-시도3/구글RSS] 0건, 시도4로 전환');
  } catch (e3) {
    Logger.log('    [다음-시도3/구글RSS] 오류: ' + e3.message.substring(0, 80));
  }

  // 시도 4: 빙 뉴스 RSS
  try {
    var a4 = searchBingNewsRss(keyword, dateRange);
    if (a4.length > 0) {
      Logger.log('    [다음-시도4/빙RSS] 성공: ' + a4.length + '건');
    } else {
      Logger.log('    [다음-시도4/빙RSS] 0건, 전부 실패 - 네이버만으로 진행');
    }
    return a4;
  } catch (e4) {
    Logger.log('    [다음-시도4/빙RSS] 오류: ' + e4.message.substring(0, 80));
    return [];
  }
}


// ================================================================
// [다음 시도1] 다음 모바일 뉴스 플래시 RSS → 키워드 필터링
// URL: https://m.media.daum.net/m/media/newsflash/rss.xml
// ================================================================
function searchDaumMobileRss(keyword, dateRange) {
  var url = 'https://m.media.daum.net/m/media/newsflash/rss.xml';

  var response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects:    true,
    headers: { 'User-Agent': MOBILE_UA }
  });

  Logger.log('    [다음-시도1] HTTP ' + response.getResponseCode());
  if (response.getResponseCode() !== 200) return [];

  return parseRssAndFilter(response.getContentText('UTF-8'), keyword, dateRange, '다음');
}


// ================================================================
// [다음 시도2] 다음 뉴스 섹션별 RSS → 키워드 필터링
// 사회/경제/해외 순서로 시도, 첫 결과 반환
// ================================================================
function searchDaumSectionRss(keyword, dateRange) {
  for (var i = 0; i < DAUM_SECTION_RSS.length; i++) {
    var sectionUrl = DAUM_SECTION_RSS[i];
    try {
      var response = UrlFetchApp.fetch(sectionUrl, {
        muteHttpExceptions: true,
        followRedirects:    true,
        headers: { 'User-Agent': MOBILE_UA }
      });

      Logger.log('    [다음-시도2] ' + sectionUrl.split('/').pop() + ' HTTP ' + response.getResponseCode());
      if (response.getResponseCode() !== 200) continue;

      var items = parseRssAndFilter(response.getContentText('UTF-8'), keyword, dateRange, '다음');
      if (items.length > 0) return items;
    } catch (sErr) {
      Logger.log('    [다음-시도2] 섹션 오류: ' + sErr.message.substring(0, 60));
    }
    Utilities.sleep(200);
  }
  return [];
}


// ================================================================
// [다음 시도3] 구글 뉴스 RSS (site:daum.net 간접 수집)
// URL: https://news.google.com/rss/search?q=키워드+site:daum.net&hl=ko&gl=KR&ceid=KR:ko
// ================================================================
function searchGoogleNewsRss(keyword, dateRange) {
  var url = 'https://news.google.com/rss/search?q=' +
            encodeURIComponent(keyword + ' site:daum.net') +
            '&hl=ko&gl=KR&ceid=KR:ko';

  var response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects:    true,
    headers: { 'User-Agent': MOBILE_UA }
  });

  Logger.log('    [다음-시도3] HTTP ' + response.getResponseCode());
  if (response.getResponseCode() !== 200) return [];

  // 구글 뉴스는 키워드로 이미 필터된 상태 → 날짜만 체크
  return parseRssItems(response.getContentText('UTF-8'), keyword, dateRange, '다음', false);
}


// ================================================================
// [다음 시도4] 빙 뉴스 RSS (마이크로소프트 서버, 카카오 IP 차단 없음)
// URL: https://www.bing.com/news/search?q=키워드&format=rss
// ================================================================
function searchBingNewsRss(keyword, dateRange) {
  var url = 'https://www.bing.com/news/search?q=' +
            encodeURIComponent(keyword) +
            '&format=rss';

  var response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects:    true,
    headers: { 'User-Agent': MOBILE_UA }
  });

  Logger.log('    [다음-시도4] HTTP ' + response.getResponseCode());
  if (response.getResponseCode() !== 200) return [];

  // 빙은 키워드로 이미 필터된 상태 → 날짜만 체크
  return parseRssItems(response.getContentText('UTF-8'), keyword, dateRange, '다음', false);
}


// ================================================================
// RSS 파싱 공통 유틸 - 키워드 필터링 포함
// needsKeywordFilter: true면 제목+설명에 키워드 포함 여부 체크
// ================================================================
function parseRssAndFilter(content, keyword, dateRange, source) {
  return parseRssItems(content, keyword, dateRange, source, true);
}

function parseRssItems(content, keyword, dateRange, source, needsKeywordFilter) {
  var articles = [];
  if (!content || content.indexOf('<item') === -1) return articles;

  // 1차: XML 파싱
  try {
    var doc   = XmlService.parse(content);
    var root  = doc.getRootElement();
    var ns    = root.getNamespace();
    var chan  = root.getChild('channel') || root.getChild('channel', ns);

    if (chan) {
      var items = chan.getChildren('item');
      for (var i = 0; i < items.length; i++) {
        try {
          var title   = stripHtml(items[i].getChildText('title')   || '');
          var link    = (items[i].getChildText('link')    || '').trim();
          var desc    = stripHtml(items[i].getChildText('description') || '');
          var pubDate = new Date(items[i].getChildText('pubDate')  || '');

          if (!link) continue;
          if (needsKeywordFilter && (title + desc).indexOf(keyword) === -1) continue;
          if (!isInDateRange(pubDate, dateRange)) continue;

          articles.push({
            collectedDate: new Date(),
            publishDate:   pubDate,
            keyword:       keyword,
            source:        source,
            title:         title,
            url:           link,
            note:          ''
          });
        } catch (ie) { /* 개별 item 파싱 실패 스킵 */ }
      }
      if (articles.length > 0) return articles;
    }
  } catch (xmlErr) {
    // XML 파싱 실패 시 정규식 폴백
  }

  // 2차: 정규식 폴백
  var itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  var m;
  while ((m = itemRegex.exec(content)) !== null) {
    try {
      var block      = m[1];
      var titleMatch = /<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i.exec(block);
      var linkMatch  = /<(?:link|guid)[^>]*>(?:<!\[CDATA\[)?(https?[^\s<\]]+)(?:\]\]>)?<\/(?:link|guid)>/i.exec(block);
      var dateMatch  = /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i.exec(block);
      var descMatch  = /<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i.exec(block);

      if (!titleMatch || !linkMatch) continue;

      var rTitle   = stripHtml(titleMatch[1].trim());
      var rLink    = linkMatch[1].trim();
      var rDesc    = descMatch ? stripHtml(descMatch[1].trim()) : '';
      var rPubDate = dateMatch ? new Date(dateMatch[1].trim()) : dateRange.end;

      if (!rLink) continue;
      if (needsKeywordFilter && (rTitle + rDesc).indexOf(keyword) === -1) continue;
      if (!isInDateRange(rPubDate, dateRange)) continue;

      articles.push({
        collectedDate: new Date(),
        publishDate:   rPubDate,
        keyword:       keyword,
        source:        source,
        title:         rTitle,
        url:           rLink,
        note:          ''
      });
    } catch (re) { /* 개별 매치 파싱 실패 스킵 */ }
  }

  return articles;
}


// ================================================================
// URL 정규화 - 중복 비교용
// http->https, www 제거, 쿼리스트링/해시/끝 슬래시 제거
// ================================================================
function normalizeUrl(url) {
  if (!url) return '';
  var n = url.trim();
  n = n.replace(/^http:\/\//i, 'https://');
  n = n.replace(/^https:\/\/www\./i, 'https://');
  try {
    var obj = new URL(n);
    n = obj.protocol + '//' + obj.hostname.toLowerCase() + obj.pathname;
    n = n.replace(/\/$/, '');
  } catch (e) {
    n = n.split('?')[0].split('#')[0].replace(/\/$/, '').toLowerCase();
  }
  return n;
}


// ================================================================
// 제목 유사도 계산 (2-gram Jaccard)
// 반환값: 0.0 ~ 1.0 (1.0 = 동일)
// ================================================================
function titleSimilarity(titleA, titleB) {
  function norm(s) { return s.toLowerCase().replace(/[^가-힣a-z0-9]/g, ''); }
  var a = norm(titleA);
  var b = norm(titleB);
  if (!a || !b) return 0;
  if (a === b)  return 1;

  var shorter = a.length <= b.length ? a : b;
  var longer  = a.length <= b.length ? b : a;
  if (longer.indexOf(shorter) !== -1 && shorter.length / longer.length >= 0.75) return 1;

  function bigrams(s) {
    var set = {};
    for (var i = 0; i < s.length - 1; i++) { set[s.slice(i, i + 2)] = true; }
    return set;
  }
  var ba     = bigrams(a);
  var bb     = bigrams(b);
  var baKeys = Object.keys(ba);
  var bbKeys = Object.keys(bb);
  if (!baKeys.length || !bbKeys.length) return 0;

  var intersect = 0;
  baKeys.forEach(function(bg) { if (bb[bg]) intersect++; });
  var union = baKeys.length + bbKeys.length - intersect;
  return union === 0 ? 0 : intersect / union;
}


// ================================================================
// 3단계 중복 제거
// 1단계: 같은 키워드 내 URL 중복
// 2단계: 카테고리 내 URL 중복 + 제목 유사도 90% 이상
// 3단계: 매체 간 중복 → 비고에 "중복(네이버+다음)" 표시
// ================================================================
function deduplicateArticles(articles) {
  var SIMILARITY_THRESHOLD = 0.90;

  var urlSourceMap = {};
  articles.forEach(function(article) {
    var nUrl = normalizeUrl(article.url);
    if (!urlSourceMap[nUrl]) urlSourceMap[nUrl] = {};
    urlSourceMap[nUrl][article.source] = true;
  });

  var keywordGroups = {};
  articles.forEach(function(article) {
    if (!keywordGroups[article.keyword]) keywordGroups[article.keyword] = [];
    keywordGroups[article.keyword].push(article);
  });

  var stage1 = [];
  Object.keys(keywordGroups).forEach(function(kw) {
    var seen  = {};
    keywordGroups[kw].forEach(function(article) {
      var nUrl = normalizeUrl(article.url);
      if (!seen[nUrl]) {
        seen[nUrl] = true;
        var copy   = {};
        Object.keys(article).forEach(function(k) { copy[k] = article[k]; });
        copy._nUrl = nUrl;
        stage1.push(copy);
      }
    });
  });

  var stage2   = [];
  var usedUrls = {};

  stage1.forEach(function(article) {
    var nUrl = article._nUrl;

    if (usedUrls[nUrl]) {
      var orig = null;
      for (var i = 0; i < stage2.length; i++) {
        if (stage2[i]._nUrl === nUrl) { orig = stage2[i]; break; }
      }
      if (orig && orig.note.indexOf('중복키워드') === -1) {
        orig.note = '중복키워드(' + orig.keyword + '+' + article.keyword + ')';
      }
      return;
    }

    var isTitleDup = false;
    for (var j = 0; j < stage2.length; j++) {
      var sim = titleSimilarity(article.title, stage2[j].title);
      if (sim >= SIMILARITY_THRESHOLD) {
        if (stage2[j].note.indexOf('유사제목') === -1) {
          var prev = stage2[j].note ? stage2[j].note + ' / ' : '';
          stage2[j].note = prev + '유사제목(' + Math.round(sim * 100) + '%)';
        }
        isTitleDup = true;
        break;
      }
    }
    if (isTitleDup) return;

    usedUrls[nUrl] = article.keyword;
    stage2.push(article);
  });

  stage2.forEach(function(article) {
    var sources = urlSourceMap[article._nUrl];
    if (sources && Object.keys(sources).length > 1) {
      var srcStr    = Object.keys(sources).join('+');
      var multiNote = '중복(' + srcStr + ')';
      article.note  = article.note ? article.note + ' / ' + multiNote : multiNote;
    }
  });

  return stage2.map(function(a) {
    var copy = {};
    Object.keys(a).forEach(function(k) { if (k !== '_nUrl') copy[k] = a[k]; });
    return copy;
  });
}


// ================================================================
// 구글시트에 저장
// ================================================================
function saveToSheets(allArticles) {
  var ss       = SpreadsheetApp.openById(SHEET_ID);
  var todayStr = fmtDate(new Date());
  var summaryRows = [];

  Object.keys(allArticles).forEach(function(categoryName) {
    var articles = allArticles[categoryName];
    var config   = CATEGORIES[categoryName];
    var sheet    = getOrCreateSheet(ss, config.sheetName);

    ensureSheetHeader(sheet);
    clearTodayRows(sheet, todayStr);

    var rows = articles.map(function(a) {
      return [
        fmtDate(a.collectedDate),
        fmtDate(a.publishDate),
        a.keyword,
        a.source,
        a.title,
        a.url,
        a.note
      ];
    });

    if (rows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 7).setValues(rows);
    }
    Logger.log('시트 [' + config.sheetName + '] 저장: ' + rows.length + '건');

    articles.forEach(function(a) {
      summaryRows.push([
        fmtDate(a.collectedDate),
        fmtDate(a.publishDate),
        '[' + categoryName + '] ' + a.keyword,
        a.source,
        a.title,
        a.url,
        a.note
      ]);
    });
  });

  var sumSheet = getOrCreateSheet(ss, SUMMARY_SHEET_NAME);
  ensureSheetHeader(sumSheet);
  clearTodayRows(sumSheet, todayStr);

  if (summaryRows.length > 0) {
    sumSheet.getRange(sumSheet.getLastRow() + 1, 1, summaryRows.length, 7)
            .setValues(summaryRows);
  }
  Logger.log('종합 시트 저장: ' + summaryRows.length + '건');
}


// ================================================================
// 이메일 발송
// ADMIN_EMAIL + ADMIN_EMAIL2 다중 수신자 지원
// 통계표 + 카테고리별 상위 10건 + 구글시트 링크
// ================================================================
function sendEmailReport(allArticles, today) {
  // 수신자 목록 구성 (ADMIN_EMAIL2 미설정 시 skip)
  var email1     = PROPS.getProperty('ADMIN_EMAIL')  || '';
  var email2     = PROPS.getProperty('ADMIN_EMAIL2') || '';
  var recipients = [email1, email2]
    .filter(function(e) { return e && e.trim() !== ''; })
    .join(',');

  if (!recipients) {
    Logger.log('ADMIN_EMAIL 미설정');
    return '';
  }
  Logger.log('이메일 수신자: ' + recipients);

  var dateRange = getDateRange();
  var dateLabel = (dateRange.days.length > 1)
                ? fmtDate(dateRange.start) + ' ~ ' + fmtDate(dateRange.end)
                : fmtDate(dateRange.start);

  var naverTotal = 0;
  var daumTotal  = 0;
  var totalCount = 0;
  Object.keys(allArticles).forEach(function(k) {
    allArticles[k].forEach(function(a) {
      if (a.source === '네이버') naverTotal++;
      else if (a.source === '다음') daumTotal++;
    });
    totalCount += allArticles[k].length;
  });

  var sheetUrl = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID;
  var subject  = '[섬유패션] ' + fmtDate(today) + ' 키워드 뉴스 (' + totalCount + '건)';

  var statRows = '';
  Object.keys(allArticles).forEach(function(catName) {
    var config = CATEGORIES[catName];
    statRows += '<tr>' +
      '<td style="padding:5px 12px;font-size:13px;color:#333;">' + config.label + '</td>' +
      '<td style="padding:5px 12px;font-size:13px;text-align:right;color:#333;">' + allArticles[catName].length + '건</td>' +
      '</tr>';
  });

  var statTable =
    '<table style="border-collapse:collapse;width:320px;border:1px solid #ddd;margin-bottom:20px;">' +
    '<tr style="background:#f0f0f0;"><td style="padding:6px 12px;font-size:12px;color:#555;">수집 기간</td>' +
    '<td style="padding:6px 12px;font-size:12px;color:#333;text-align:right;">' + dateLabel + '</td></tr>' +
    '<tr><td style="padding:6px 12px;font-size:12px;color:#555;">총 수집</td>' +
    '<td style="padding:6px 12px;font-size:12px;font-weight:bold;color:#333;text-align:right;">' + totalCount + '건</td></tr>' +
    '<tr style="background:#f9f9f9;"><td style="padding:6px 12px;font-size:12px;color:#555;">네이버</td>' +
    '<td style="padding:6px 12px;font-size:12px;color:#333;text-align:right;">' + naverTotal + '건</td></tr>' +
    '<tr><td style="padding:6px 12px;font-size:12px;color:#555;">다음</td>' +
    '<td style="padding:6px 12px;font-size:12px;color:#333;text-align:right;">' + daumTotal + '건</td></tr>' +
    '<tr style="background:#f9f9f9;border-top:1px solid #ddd;">' +
    '<td colspan="2" style="padding:4px 12px;font-size:11px;color:#999;">카테고리별</td></tr>' +
    statRows +
    '<tr style="background:#f0f0f0;border-top:1px solid #ddd;">' +
    '<td style="padding:6px 12px;font-size:12px;font-weight:bold;color:#333;">합계</td>' +
    '<td style="padding:6px 12px;font-size:12px;font-weight:bold;color:#333;text-align:right;">' + totalCount + '건</td></tr>' +
    '</table>';

  var categorySections = '';
  Object.keys(allArticles).forEach(function(catName) {
    var articles = allArticles[catName];
    var config   = CATEGORIES[catName];
    var top10    = articles.slice(0, EMAIL_MAX_PER_CATEGORY);
    var remains  = articles.length - top10.length;

    var tableRows = '';
    top10.forEach(function(a, idx) {
      var bg       = (idx % 2 === 0) ? '#fff' : '#fafafa';
      var srcColor = (a.source === '네이버') ? '#007700' : '#cc5500';
      tableRows +=
        '<tr style="background:' + bg + ';border-bottom:1px solid #eee;">' +
        '<td style="padding:5px 8px;font-size:11px;color:#666;">' + fmtDate(a.publishDate) + '</td>' +
        '<td style="padding:5px 8px;font-size:11px;color:#333;">' + escapeHtml(a.keyword) + '</td>' +
        '<td style="padding:5px 8px;font-size:11px;color:' + srcColor + ';font-weight:bold;">' + a.source + '</td>' +
        '<td style="padding:5px 8px;font-size:12px;">' +
        '<a href="' + a.url + '" style="color:#1a1a8c;text-decoration:none;">' + escapeHtml(a.title) + '</a>' +
        '</td>' +
        '<td style="padding:5px 8px;font-size:10px;color:#888;">' + escapeHtml(a.note) + '</td>' +
        '</tr>';
    });

    var moreRow = (remains > 0)
      ? '<p style="margin:0;padding:5px 12px;background:#f9f9f9;border:1px solid #ddd;border-top:none;font-size:11px;color:#666;">나머지 ' + remains + '건은 구글시트에서 확인하세요.</p>'
      : '';

    var emptyMsg = (top10.length === 0)
      ? '<p style="padding:10px 12px;color:#999;border:1px solid #ddd;border-top:none;margin:0;font-size:12px;">수집된 기사 없음</p>'
      : '';

    var tableHtml = (top10.length > 0)
      ? '<table style="width:100%;border-collapse:collapse;border:1px solid #ddd;border-top:none;">' +
        '<thead><tr style="background:#f5f5f5;border-bottom:1px solid #ddd;">' +
        '<th style="padding:5px 8px;font-size:11px;width:80px;text-align:left;font-weight:normal;color:#555;">발행일</th>' +
        '<th style="padding:5px 8px;font-size:11px;width:100px;text-align:left;font-weight:normal;color:#555;">키워드</th>' +
        '<th style="padding:5px 8px;font-size:11px;width:55px;text-align:left;font-weight:normal;color:#555;">매체</th>' +
        '<th style="padding:5px 8px;font-size:11px;text-align:left;font-weight:normal;color:#555;">기사제목</th>' +
        '<th style="padding:5px 8px;font-size:11px;width:110px;text-align:left;font-weight:normal;color:#555;">비고</th>' +
        '</tr></thead><tbody>' + tableRows + '</tbody></table>'
      : '';

    categorySections +=
      '<div style="margin-bottom:24px;">' +
      '<div style="background:#333;color:#fff;padding:8px 12px;font-size:13px;font-weight:bold;">' +
      config.label + ' (전체 ' + articles.length + '건 / 상위 ' + top10.length + '건 표시)' +
      '</div>' +
      emptyMsg + tableHtml + moreRow +
      '</div>';
  });

  var html =
    '<html><body style="font-family:\'Malgun Gothic\',Arial,sans-serif;max-width:820px;margin:0 auto;padding:20px;color:#222;">' +
    '<h2 style="font-size:16px;margin-bottom:4px;border-bottom:2px solid #333;padding-bottom:8px;">섬유패션 키워드 뉴스 리포트</h2>' +
    statTable + categorySections +
    '<div style="margin-top:16px;padding:10px 14px;background:#f5f5f5;border:1px solid #ddd;">' +
    '<span style="font-size:13px;">전체 ' + totalCount + '건 보기 : </span>' +
    '<a href="' + sheetUrl + '" style="font-size:13px;color:#1a1a8c;">구글시트 열기</a>' +
    '</div>' +
    '<p style="font-size:10px;color:#aaa;margin-top:12px;">섬유패션 키워드 뉴스 자동 수집 시스템 v1.0.1g</p>' +
    '</body></html>';

  MailApp.sendEmail({
    to:       recipients,
    subject:  subject,
    body:     'HTML 형식 이메일입니다.',
    htmlBody: html,
    name:     '섬유패션 뉴스봇'
  });
  Logger.log('이메일 발송: ' + subject);

  Utilities.sleep(2000);
  var emailLink = 'https://mail.google.com';
  try {
    var sent = GmailApp.search('subject:("' + subject + '") in:sent', 0, 1);
    if (sent && sent.length > 0) {
      emailLink = 'https://mail.google.com/mail/u/0/#sent/' + sent[0].getId();
    }
  } catch (e) {
    Logger.log('이메일 링크 추출 실패: ' + e.message);
  }
  return emailLink;
}


// ================================================================
// 카카오톡 나에게 보내기 [수정 2]
// - 기사제목 + 링크 중심 구성
// - 카테고리별 3건 → 900자 초과 시 2건 → 그래도 초과 시 1건으로 자동 축소
// - 최종 메시지 1000자 이하 유지
// ================================================================
function sendKakaoMessage(allArticles, today, emailLink) {
  var token = PROPS.getProperty('KAKAO_TOKEN');
  if (!token) {
    Logger.log('KAKAO_TOKEN 미설정');
    return;
  }

  var dateRange  = getDateRange();
  var dateLabel  = (dateRange.days.length > 1)
                 ? fmtDate(dateRange.start) + '~' + fmtDate(dateRange.end)
                 : fmtDate(dateRange.start);

  var totalCount = 0;
  Object.keys(allArticles).forEach(function(k) { totalCount += allArticles[k].length; });

  // 글자수 체크 후 자동 축소 (3건 → 2건 → 1건)
  var msg = '';
  var perCat = 3;
  while (perCat >= 1) {
    msg = buildKakaoMessage(allArticles, dateLabel, totalCount, emailLink, perCat);
    if (msg.length <= 900) break;
    perCat--;
  }
  // 그래도 900자 초과하면 그냥 전송 (1건 기준)
  Logger.log('카카오 메시지 길이: ' + msg.length + '자 (카테고리당 ' + perCat + '건)');

  var sheetUrl   = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID;
  var kakaoUrl   = 'https://kapi.kakao.com/v2/api/talk/memo/default/send';
  var template   = {
    object_type:  'text',
    text:         msg,
    link: {
      web_url:        emailLink || sheetUrl,
      mobile_web_url: emailLink || sheetUrl
    },
    button_title: '전체 뉴스 보기'
  };

  // 요청 전 파라미터 확인 로그
  var restApiKey = PROPS.getProperty('KAKAO_REST_API_KEY') || '';
  Logger.log('카카오 요청 REST_API_KEY 앞6자: ' +
    (restApiKey.length > 6 ? restApiKey.substring(0, 6) + '...' : '미설정'));
  Logger.log('카카오 KAKAO_TOKEN 앞6자: ' +
    (token.length > 6 ? token.substring(0, 6) + '...' : token));

  var options = {
    method:  'post',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type':  'application/x-www-form-urlencoded'
    },
    payload:            { template_object: JSON.stringify(template) },
    muteHttpExceptions: true
  };

  try {
    var res        = UrlFetchApp.fetch(kakaoUrl, options);
    var statusCode = res.getResponseCode();

    if (statusCode === 200) {
      Logger.log('카카오 발송 성공');
    } else if (statusCode === 401 || statusCode === 403) {
      Logger.log('카카오 HTTP ' + statusCode + ' 에러: ' + res.getContentText());
      Logger.log('카카오 토큰 자동 갱신 시도...');

      var newToken = refreshKakaoToken();
      if (newToken) {
        options.headers['Authorization'] = 'Bearer ' + newToken;
        var retry = UrlFetchApp.fetch(kakaoUrl, options);
        if (retry.getResponseCode() === 200) {
          Logger.log('카카오 갱신 후 재발송 성공');
        } else {
          Logger.log('카카오 재발송 실패: HTTP ' + retry.getResponseCode());
          Logger.log('재발송 에러: ' + retry.getContentText());
          sendKakaoExpiredAlert();
        }
      } else {
        sendKakaoExpiredAlert();
      }
    } else {
      Logger.log('카카오 발송 실패: HTTP ' + statusCode);
      Logger.log('카카오 에러 상세: ' + res.getContentText());
    }
  } catch (e) {
    Logger.log('sendKakaoMessage 오류: ' + e.message);
  }
}


// ================================================================
// 카카오 메시지 텍스트 구성 헬퍼
// perCat: 카테고리당 표시 건수 (1~3)
// ================================================================
function buildKakaoMessage(allArticles, dateLabel, totalCount, emailLink, perCat) {
  var TITLE_LIMIT = 25;
  var lines = [];

  lines.push('[' + dateLabel + '] 섬유패션 아침뉴스');
  lines.push('========================');

  Object.keys(allArticles).forEach(function(catName) {
    var articles = allArticles[catName];
    var config   = CATEGORIES[catName];
    lines.push('');
    lines.push(config.label + ' ' + articles.length + '건');

    var top = articles.slice(0, perCat);
    top.forEach(function(a) {
      var t = (a.title.length > TITLE_LIMIT) ? a.title.substring(0, TITLE_LIMIT) + '...' : a.title;
      lines.push('· ' + t);
      lines.push('  ' + a.url);
    });
  });

  lines.push('');
  lines.push('========================');
  lines.push('전체 ' + totalCount + '건 | 상세보기: 이메일 확인');
  if (emailLink && emailLink !== 'https://mail.google.com') {
    lines.push(emailLink);
  }

  return lines.join('\n');
}


// ================================================================
// 카카오 액세스 토큰 자동 갱신 [수정 3]
// - 5시간마다 트리거로 자동 실행 (setupTriggers에서 등록)
// - sendKakaoMessage 401/403 발생 시에도 호출
// - KAKAO_CLIENT_SECRET 없어도 동작 (optional)
//
// [트리거 수동 등록 방법]
//   GAS 편집기 > 트리거 > 함수: refreshKakaoToken
//   → 이벤트 유형: 시간 기반 > 시간 타이머 > 5시간마다
// ================================================================
function refreshKakaoToken() {
  var props         = PropertiesService.getScriptProperties();
  var refreshToken  = props.getProperty('KAKAO_REFRESH_TOKEN');
  var clientId      = props.getProperty('KAKAO_REST_API_KEY');
  var clientSecret  = props.getProperty('KAKAO_CLIENT_SECRET') || ''; // 선택값, 없으면 빈값

  if (!refreshToken || !clientId) {
    Logger.log('카카오 갱신 실패: KAKAO_REFRESH_TOKEN 또는 KAKAO_REST_API_KEY 미설정');
    return null;
  }

  // 갱신 요청 파라미터 로그
  Logger.log('카카오 토큰 갱신 요청:');
  Logger.log('  grant_type    = refresh_token');
  Logger.log('  client_id     = ' + (clientId.length > 6     ? clientId.substring(0, 6)     + '...' : clientId));
  Logger.log('  refresh_token = ' + (refreshToken.length > 6 ? refreshToken.substring(0, 6) + '...' : refreshToken));
  Logger.log('  client_secret = ' + (clientSecret ? '설정됨' : '미설정(빈값으로 요청)'));

  try {
    var response = UrlFetchApp.fetch('https://kauth.kakao.com/oauth/token', {
      method:  'post',
      payload: {
        grant_type:    'refresh_token',
        client_id:     clientId,
        refresh_token: refreshToken,
        client_secret: clientSecret
      },
      muteHttpExceptions: true
    });

    Logger.log('카카오 갱신 응답 HTTP: ' + response.getResponseCode());
    Logger.log('카카오 갱신 응답 내용: ' + response.getContentText().substring(0, 300));

    var json = JSON.parse(response.getContentText());

    if (json.access_token) {
      props.setProperty('KAKAO_TOKEN', json.access_token);
      if (json.refresh_token) {
        props.setProperty('KAKAO_REFRESH_TOKEN', json.refresh_token);
        Logger.log('카카오 refresh_token 도 갱신됨');
      }
      Logger.log('카카오 토큰 자동 갱신 완료');
      return json.access_token;
    }

    Logger.log('카카오 토큰 갱신 실패: ' + JSON.stringify(json));
  } catch (e) {
    Logger.log('refreshKakaoToken 오류: ' + e.message);
  }
  return null;
}


// ================================================================
// 카카오 토큰 만료 시 이메일 알림 발송
// ================================================================
function sendKakaoExpiredAlert() {
  if (!ADMIN_EMAIL) return;
  try {
    GmailApp.sendEmail(
      ADMIN_EMAIL,
      '[섬유패션 뉴스봇] 카카오 토큰 만료 알림',
      '카카오 액세스 토큰이 만료되었습니다.\n\n' +
      '조치 방법:\n' +
      '1. https://developers.kakao.com 접속\n' +
      '2. 새 access_token 발급\n' +
      '3. GAS 스크립트 속성 > KAKAO_TOKEN 값 갱신\n' +
      '4. KAKAO_REFRESH_TOKEN 도 함께 갱신 권장\n\n' +
      '자동 발송 - 섬유패션 뉴스봇 v1.0.1g',
      { name: '섬유패션 뉴스봇' }
    );
    Logger.log('카카오 만료 알림 이메일 발송 완료');
  } catch (e) {
    Logger.log('만료 알림 이메일 발송 실패: ' + e.message);
  }
}


// ================================================================
// 구글시트에서 오늘 수집 데이터 읽기 (runKeywordWorkflow 전송용)
// ================================================================
function readFromSheets() {
  var ss       = SpreadsheetApp.openById(SHEET_ID);
  var todayStr = fmtDate(new Date());
  var result   = {};

  Object.keys(CATEGORIES).forEach(function(categoryName) {
    var config = CATEGORIES[categoryName];
    var sheet  = ss.getSheetByName(config.sheetName);
    if (!sheet || sheet.getLastRow() <= 1) {
      result[categoryName] = [];
      return;
    }

    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues();
    result[categoryName] = data
      .filter(function(row) {
        if (!row[4]) return false;
        var v = row[0];
        var s = (v instanceof Date) ? fmtDate(v) : String(v).substring(0, 10);
        return s === todayStr;
      })
      .map(function(row) {
        return {
          collectedDate: (row[0] instanceof Date) ? fmtDate(row[0]) : row[0],
          publishDate:   (row[1] instanceof Date) ? fmtDate(row[1]) : String(row[1]).substring(0, 10),
          keyword:       row[2],
          source:        row[3],
          title:         row[4],
          url:           row[5],
          note:          row[6] || ''
        };
      });
  });

  return result;
}


// ================================================================
// 시트 가져오기 또는 생성
// ================================================================
function getOrCreateSheet(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    Logger.log('새 시트 생성: ' + sheetName);
  }
  return sheet;
}


// ================================================================
// 시트 헤더 보장 (없을 때만 생성)
// ================================================================
function ensureSheetHeader(sheet) {
  var headers = ['수집일자', '발행일자', '검색키워드', '매체명', '기사제목', '링크주소', '비고'];
  if (sheet.getLastRow() === 0 || sheet.getRange(1, 1).getValue() !== '수집일자') {
    if (sheet.getLastRow() > 0) sheet.insertRowBefore(1);
    var r = sheet.getRange(1, 1, 1, 7);
    r.setValues([headers]);
    r.setBackground('#444444');
    r.setFontColor('#ffffff');
    r.setFontWeight('bold');
    r.setFontSize(11);
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 90);
    sheet.setColumnWidth(2, 90);
    sheet.setColumnWidth(3, 110);
    sheet.setColumnWidth(4, 65);
    sheet.setColumnWidth(5, 420);
    sheet.setColumnWidth(6, 320);
    sheet.setColumnWidth(7, 160);
  }
}


// ================================================================
// 오늘 수집일자 행 삭제 (재실행 시 중복 방지)
// ================================================================
function clearTodayRows(sheet, todayStr) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  var values       = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var rowsToDelete = [];

  for (var i = values.length - 1; i >= 0; i--) {
    var v = values[i][0];
    var s = (v instanceof Date) ? fmtDate(v) : String(v).substring(0, 10);
    if (s === todayStr) rowsToDelete.push(i + 2);
  }
  rowsToDelete.forEach(function(rowNum) { sheet.deleteRow(rowNum); });

  if (rowsToDelete.length > 0) {
    Logger.log(sheet.getName() + ' 기존 ' + rowsToDelete.length + '행 삭제');
  }
}


// ================================================================
// 날짜 범위 포함 여부 확인
// ================================================================
function isInDateRange(date, dateRange) {
  if (!date || isNaN(date.getTime())) return false;
  var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  var s = new Date(dateRange.start.getFullYear(), dateRange.start.getMonth(), dateRange.start.getDate());
  var e = new Date(dateRange.end.getFullYear(),   dateRange.end.getMonth(),   dateRange.end.getDate());
  return d >= s && d <= e;
}


// ================================================================
// 날짜 포맷 유틸 -> "yyyy-MM-dd"
// ================================================================
function fmtDate(date) {
  if (!date) return '';
  try {
    if (date instanceof Date && !isNaN(date.getTime())) {
      return Utilities.formatDate(date, 'GMT+9', 'yyyy-MM-dd');
    }
    var s = String(date);
    if (s.length >= 10 && s.indexOf('-') !== -1) return s.substring(0, 10);
    var d = new Date(date);
    if (!isNaN(d.getTime())) return Utilities.formatDate(d, 'GMT+9', 'yyyy-MM-dd');
  } catch (e) {
    Logger.log('fmtDate 오류: ' + e.message);
  }
  return String(date).substring(0, 10);
}


// ================================================================
// HTML 태그 및 엔티티 제거
// ================================================================
function stripHtml(str) {
  if (!str) return '';
  return str
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}


// ================================================================
// HTML 이스케이프 (이메일 본문 삽입용)
// ================================================================
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;');
}


// ================================================================
// [테스트용] 전체 워크플로 즉시 실행 (주말 체크 우회)
// 수집 -> 저장 -> 이메일 -> 카카오
// ================================================================
function runNow() {
  Logger.log('=== [수동 실행] 전체 워크플로 시작 ===');
  try {
    var dateRange   = getDateRange();
    Logger.log('날짜 범위: ' + fmtDate(dateRange.start) + ' ~ ' + fmtDate(dateRange.end));

    Logger.log('--- 수집 시작 ---');
    var allArticles = collectAllKeywords(dateRange);
    var total = 0;
    Object.keys(allArticles).forEach(function(k) { total += allArticles[k].length; });
    Logger.log('총 수집: ' + total + '건');

    if (total === 0) { Logger.log('수집 기사 없음. 종료.'); return; }

    Logger.log('--- 시트 저장 ---');
    saveToSheets(allArticles);

    Logger.log('--- 이메일 발송 ---');
    var today     = new Date();
    var emailLink = sendEmailReport(allArticles, today);
    Logger.log('이메일 완료: ' + emailLink);

    Logger.log('--- 카카오 발송 ---');
    sendKakaoMessage(allArticles, today, emailLink);
    Logger.log('카카오 완료');

    Logger.log('=== [수동 실행] 완료 ===');
  } catch (e) {
    Logger.log('runNow 오류: ' + e.message);
    Logger.log(e.stack);
  }
}


// ================================================================
// [테스트용] 전체 시트 데이터 초기화 (헤더 유지)
// ================================================================
function clearAllSheets() {
  Logger.log('=== 전체 시트 초기화 시작 ===');
  var ss      = SpreadsheetApp.openById(SHEET_ID);
  var targets = [];
  Object.keys(CATEGORIES).forEach(function(k) { targets.push(CATEGORIES[k].sheetName); });
  targets.push(SUMMARY_SHEET_NAME);

  targets.forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) { Logger.log('[스킵] 없음: ' + name); return; }
    var last = sheet.getLastRow();
    if (last <= 1) { Logger.log('[스킵] 데이터 없음: ' + name); return; }
    sheet.deleteRows(2, last - 1);
    Logger.log('초기화: ' + name + ' (' + (last - 1) + '행 삭제)');
  });
  Logger.log('=== 초기화 완료 ===');
}


// ================================================================
// 트리거 자동 설정 (최초 1회 수동 실행)
// - collectAndSave    : 매일 07:30 (수집)
// - runKeywordWorkflow: 매일 08:00 (발송, 평일만)
// - refreshKakaoToken : 5시간마다 (카카오 토큰 자동 갱신)
// ================================================================
function setupTriggers() {
  var existing = ScriptApp.getProjectTriggers();
  existing.forEach(function(t) { ScriptApp.deleteTrigger(t); });
  Logger.log('기존 트리거 ' + existing.length + '개 삭제');

  ScriptApp.newTrigger('collectAndSave')
    .timeBased().atHour(7).nearMinute(30).everyDays(1)
    .inTimezone('Asia/Seoul').create();

  ScriptApp.newTrigger('runKeywordWorkflow')
    .timeBased().atHour(8).nearMinute(0).everyDays(1)
    .inTimezone('Asia/Seoul').create();

  ScriptApp.newTrigger('refreshKakaoToken')
    .timeBased().everyHours(5).create();

  Logger.log('트리거 등록 완료:');
  Logger.log('  collectAndSave     → 매일 07:30');
  Logger.log('  runKeywordWorkflow → 매일 08:00');
  Logger.log('  refreshKakaoToken  → 5시간마다');
}
