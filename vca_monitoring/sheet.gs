/**
 * ================================================================
 *  VCA 미디어 모니터링 시스템
 *  파일명: sheet.gs
 *  버전: v0.1d  |  최초작성: 2026-03-27  |  최종수정: 2026-03-28
 * ================================================================
 * [변경 이력]
 * v0.1a - 최초 생성 (PropertiesService 기반, 브랜드 탭 분리 구조)
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
 * v0.1d - getArticlesByCollectionDate() 날짜 배열 지원 (월요일 금/토/일 통합 발송)
 * ================================================================
 */

// ═══════════════════════════════════════════════════
// ■ 상수
// ═══════════════════════════════════════════════════

/** 브랜드 탭 공통 헤더 (A~I) */
const BRAND_HEADERS = ['수집날짜','발행날짜','브랜드명','카테고리','기사제목','링크','출처','미디어타입','비고2'];

/** Duplicate_Check 탭 헤더 */
const DEDUP_HEADERS = ['URL Hash','수집일자','브랜드명','기사제목'];

/** Error_Log 탭 헤더 (v0.1b: 7컬럼) */
const ERROR_HEADERS = ['타임스탬프','소스명','시도한URL','HTTP상태코드','오류메시지','시도단계','최종결과'];

// ═══════════════════════════════════════════════════
// ■ 스프레드시트 접근 (절대 신규 생성 금지)
// ═══════════════════════════════════════════════════

/**
 * PropertiesService의 SPREADSHEET_ID로 기존 스프레드시트 반환
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function getSpreadsheet() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id || !id.trim()) {
    throw new Error('SPREADSHEET_ID가 PropertiesService에 등록되지 않았습니다. setup() 실행 전 등록 필요.');
  }
  return SpreadsheetApp.openById(id.trim());
}

/**
 * 브랜드 탭을 가져오거나 없으면 생성 (헤더 포함)
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {string} tabName
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getOrCreateBrandTab(ss, tabName) {
  let sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
    sheet.appendRow(BRAND_HEADERS);
    sheet.getRange(1, 1, 1, BRAND_HEADERS.length)
         .setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    Logger.log(`탭 생성: ${tabName}`);
  }
  return sheet;
}

/**
 * 관리 탭을 가져오거나 없으면 생성
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {string} tabName
 * @param {string[]} headers
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getOrCreateAdminTab(ss, tabName, headers) {
  let sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
         .setFontWeight('bold').setBackground('#374151').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * 없는 탭만 생성 (기존 탭·데이터 절대 유지)
 * 12개 브랜드 탭 + Duplicate_Check + Error_Log + Config
 */
function initSheets() {
  const ss = getSpreadsheet();
  ALL_BRAND_TABS.forEach(tab => getOrCreateBrandTab(ss, tab));
  getOrCreateAdminTab(ss, 'Duplicate_Check', DEDUP_HEADERS);
  getOrCreateAdminTab(ss, 'Error_Log',        ERROR_HEADERS);
  updateConfigDisplay(ss);
  Logger.log('시트 초기화 완료 (기존 데이터 유지)');
}

/**
 * Config 탭에 PropertiesService 값 표시
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} [ss]
 */
function updateConfigDisplay(ss) {
  ss = ss || getSpreadsheet();
  let sheet = ss.getSheetByName('Config');
  if (!sheet) sheet = ss.insertSheet('Config');
  sheet.clearContents();
  const props = PropertiesService.getScriptProperties().getProperties();
  const display = [
    ['설정 항목', '값', '비고'],
    ['SPREADSHEET_ID',      props.SPREADSHEET_ID      || '(미설정)', '필수'],
    ['ADMIN_EMAIL',         props.ADMIN_EMAIL          || '(미설정)', '필수'],
    ['ADMIN_EMAIL2',        props.ADMIN_EMAIL2         || '(미설정)', '선택'],
    ['NAVER_CLIENT_ID',     props.NAVER_CLIENT_ID      || '(미설정)', '선택'],
    ['NAVER_CLIENT_SECRET', props.NAVER_CLIENT_SECRET  || '(미설정)', '선택'],
    ['BATCH_CURSOR',        props.BATCH_CURSOR         || '0',        '자동관리'],
    ['LAST_RUN',            props.LAST_RUN             || '',         '자동관리'],
    ['', '', ''],
    ['※ 값 변경은 GAS 에디터 → 프로젝트 설정 → 스크립트 속성에서 진행하세요.', '', '']
  ];
  sheet.getRange(1, 1, display.length, 3).setValues(display);
  sheet.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#fff');
}

// ═══════════════════════════════════════════════════
// ■ 중복 체크 (2단계: URL 해시 + 제목 유사도)
// ═══════════════════════════════════════════════════

/** URL 해시 캐시 */
let _urlHashCache = null;
/**
 * 제목·탭·행 캐시
 * 각 항목: { title: string, tab: string, rowIndex: number }
 */
let _titleData = null;

/**
 * Duplicate_Check + 오늘 브랜드 탭에서 캐시 로드 (최초 1회)
 */
function loadDedupCache() {
  if (_urlHashCache !== null) return;
  _urlHashCache = new Set();
  _titleData    = [];

  const ss    = getSpreadsheet();
  const today = formatDate(new Date());

  // URL 해시 로드
  try {
    const dedupSheet = ss.getSheetByName('Duplicate_Check');
    if (dedupSheet && dedupSheet.getLastRow() > 1) {
      const data = dedupSheet.getRange(2, 1, dedupSheet.getLastRow() - 1, 1).getValues();
      for (const row of data) {
        if (row[0]) _urlHashCache.add(String(row[0]));
      }
    }
  } catch (e) {
    Logger.log('URL 캐시 로드 오류: ' + e.message);
    _urlHashCache = new Set();
  }

  // 오늘 제목 로드 (크로스배치 중복 방지)
  for (const tab of ALL_BRAND_TABS) {
    try {
      const sheet = ss.getSheetByName(tab);
      if (!sheet || sheet.getLastRow() <= 1) continue;
      const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
      for (let i = 0; i < data.length; i++) {
        const row      = data[i];
        const cellDate = row[0] instanceof Date ? formatDate(row[0]) : String(row[0]);
        if (cellDate === today && row[4]) {
          _titleData.push({ title: String(row[4]), tab, rowIndex: i + 2 });
        }
      }
    } catch (_) {}
  }
}

/**
 * URL 해시 기반 중복 확인
 * @param {string} url
 * @returns {boolean}
 */
function isDuplicateUrl(url) {
  loadDedupCache();
  return _urlHashCache.has(hashUrl(normalizeUrl(url)));
}

/**
 * 제목 유사도 기반 중복 원본 검색 (Jaccard >= 0.9)
 * @param {string} title
 * @returns {{title:string, tab:string, rowIndex:number}|null}
 */
function findSimilarTitle(title) {
  if (!title || !_titleData) return null;
  for (const entry of _titleData) {
    if (titleSimilarity(title, entry.title) >= 0.9) return entry;
  }
  return null;
}

/**
 * 원본 기사의 I열(비고2)에 "유사기사 N건" 누적 표시
 * @param {string} tab
 * @param {number} rowIndex
 */
function updateSimilarCount(tab, rowIndex) {
  try {
    const ss    = getSpreadsheet();
    const sheet = ss.getSheetByName(tab);
    if (!sheet) return;
    const cell    = sheet.getRange(rowIndex, 9);
    const current = String(cell.getValue() || '');
    const m       = current.match(/유사기사 (\d+)건/);
    const n       = m ? parseInt(m[1]) + 1 : 1;
    cell.setValue(`유사기사 ${n}건`);
  } catch (e) {
    Logger.log('유사기사 카운트 업데이트 오류: ' + e.message);
  }
}

/**
 * URL을 Duplicate_Check 시트 및 캐시에 등록
 * @param {string} url
 * @param {string} brand
 * @param {string} title
 */
function registerUrl(url, brand, title) {
  loadDedupCache();
  const hash = hashUrl(normalizeUrl(url));
  _urlHashCache.add(hash);
  try {
    const ss    = getSpreadsheet();
    const sheet = getOrCreateAdminTab(ss, 'Duplicate_Check', DEDUP_HEADERS);
    sheet.appendRow([hash, formatDate(new Date()), brand || '', title || '']);
  } catch (e) {
    Logger.log('URL 등록 오류: ' + e.message);
  }
}

// ═══════════════════════════════════════════════════
// ■ 기사 저장
// ═══════════════════════════════════════════════════

/**
 * 브랜드 탭에 행 배열 추가 후 자동 정렬 (v0.1c)
 * 정렬 순서: A열 수집날짜 내림차순 → B열 발행날짜 내림차순 → G열 출처 오름차순
 * @param {string} brandTab
 * @param {any[][]} rows
 * @returns {number}
 */
function appendArticles(brandTab, rows) {
  if (!rows || !rows.length) return 0;
  const ss    = getSpreadsheet();
  const sheet = getOrCreateBrandTab(ss, brandTab);
  const start = sheet.getLastRow() + 1;
  sheet.getRange(start, 1, rows.length, BRAND_HEADERS.length).setValues(rows);

  // 자동 정렬 (헤더 행 제외)
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, BRAND_HEADERS.length)
         .sort([
           { column: 1, ascending: false }, // A열 수집날짜 내림차순
           { column: 2, ascending: false }, // B열 발행날짜 내림차순
           { column: 7, ascending: true  }  // G열 출처 오름차순
         ]);
  }
  return rows.length;
}

/**
 * 기사 객체 배열을 중복·화이트리스트·날짜 체크 후 각 브랜드 탭에 저장 (v0.1c)
 *
 * 필터 순서:
 *  0단계: 날짜 범위 (dateRange 벗어나면 건너뜀)
 *  1단계: 화이트리스트 (WHITELIST_KEYWORDS 미충족 시 건너뜀)
 *  2단계: URL 완전 일치 → 건너뜀
 *  3단계: 제목 유사도 >= 0.9 → 원본 I열 업데이트 후 건너뜀
 *  4단계: 신규 기사 → I열 빈칸으로 저장
 *
 * @param {Object[]} articles
 * @returns {number} 저장된 건수
 */
function saveArticles(articles) {
  if (!articles || !articles.length) return 0;
  loadDedupCache();

  const today          = formatDate(new Date());
  const range          = getDateRange();  // 날짜 필터용
  const byTab          = {};
  const similarUpdates = [];
  let   totalSaved     = 0;
  let   totalSkipped   = 0;
  let   filterExcluded = 0;

  for (const a of articles) {
    const tab = a.brandTab || 'VCA';
    if (!byTab[tab]) byTab[tab] = [];
    byTab[tab].push(a);
  }

  for (const [tab, arts] of Object.entries(byTab)) {
    const ss         = getSpreadsheet();
    const sheet      = getOrCreateBrandTab(ss, tab);
    const startRow   = sheet.getLastRow() + 1;
    const rows       = [];
    const titleOrder = [];

    for (const a of arts) {
      if (!a.url) continue;

      const cleanTitle = stripHtml(a.title) || '';

      // 0단계: 날짜 범위 필터
      if (!isInDateRange(a.publishDate, range)) {
        Logger.log(`[날짜제외] ${truncTitle(cleanTitle)} (${a.publishDate})`);
        filterExcluded++;
        continue;
      }

      // 1단계: 화이트리스트 필터
      if (!isWhitelisted(cleanTitle)) {
        Logger.log(`[필터제외] ${truncTitle(cleanTitle)} → 건너뜀`);
        filterExcluded++;
        continue;
      }
      Logger.log(`[필터통과] ${truncTitle(cleanTitle)} → 저장`);

      // 2단계: URL 완전 일치
      if (isDuplicateUrl(a.url)) {
        Logger.log(`URL 중복 건너뜀: ${truncTitle(cleanTitle)}`);
        totalSkipped++;
        continue;
      }

      // 3단계: 제목 유사도
      const similar = findSimilarTitle(cleanTitle);
      if (similar) {
        Logger.log(`유사 제목 건너뜀: ${truncTitle(cleanTitle)}`);
        similarUpdates.push({ tab: similar.tab, rowIndex: similar.rowIndex });
        totalSkipped++;
        continue;
      }

      // 4단계: 신규 저장
      rows.push([
        today,
        a.publishDate || today,
        a.brand       || '',
        a.category    || '',
        cleanTitle,
        a.url,
        a.source      || '',
        a.mediaType   || detectMediaType(a.source),
        ''
      ]);
      titleOrder.push(cleanTitle);
      registerUrl(a.url, a.brand, cleanTitle);
    }

    if (rows.length > 0) {
      appendArticles(tab, rows);
      for (let i = 0; i < titleOrder.length; i++) {
        _titleData.push({ title: titleOrder[i], tab, rowIndex: startRow + i });
      }
      totalSaved += rows.length;
    }
  }

  // 유사 기사 카운트 업데이트
  for (const u of similarUpdates) {
    updateSimilarCount(u.tab, u.rowIndex);
  }

  incrementSkipCount(totalSkipped);
  Logger.log(`총 ${totalSaved}건 저장 완료 | 중복/유사 ${totalSkipped}건 | 필터제외 ${filterExcluded}건`);
  return totalSaved;
}

// ═══════════════════════════════════════════════════
// ■ 건너뜀(중복) 카운터
// ═══════════════════════════════════════════════════

/**
 * 특정 날짜의 중복 건너뜀 건수 반환
 * @param {string} [date] YYYY-MM-DD
 * @returns {number}
 */
function getSkipCount(date) {
  const key = `SKIP_COUNT_${date || formatDate(new Date())}`;
  return parseInt(PropertiesService.getScriptProperties().getProperty(key) || '0');
}

/**
 * 오늘의 중복 건너뜀 건수 누적
 * @param {number} n
 */
function incrementSkipCount(n) {
  if (!n || n <= 0) return;
  const today = formatDate(new Date());
  const key   = `SKIP_COUNT_${today}`;
  const props = PropertiesService.getScriptProperties();
  const cur   = parseInt(props.getProperty(key) || '0');
  props.setProperty(key, String(cur + n));
}

// ═══════════════════════════════════════════════════
// ■ 오류 로그
// ═══════════════════════════════════════════════════

/**
 * Error_Log 탭에 오류 기록
 * @param {string} source     - 소스명
 * @param {string} url        - 시도한 URL
 * @param {number} statusCode - HTTP 상태코드
 * @param {string} errorMsg   - 오류 메시지
 * @param {string} stage      - 시도 단계
 * @param {string} result     - 최종 결과
 */
function logError(source, url, statusCode, errorMsg, stage, result) {
  try {
    const ss    = getSpreadsheet();
    const sheet = getOrCreateAdminTab(ss, 'Error_Log', ERROR_HEADERS);
    sheet.appendRow([
      new Date(),
      source     || '',
      url        || '',
      statusCode || 0,
      String(errorMsg || '').slice(0, 500),
      stage      || '',
      result     || '실패'
    ]);
  } catch (_) {}
}

// ═══════════════════════════════════════════════════
// ■ 통계 조회
// ═══════════════════════════════════════════════════

/**
 * 수집날짜(A열) 기준으로 각 브랜드 탭 기사 반환
 * @param {string} collectionDate - YYYY-MM-DD
 * @returns {Object.<string, Object[]>}
 */
function getArticlesByCollectionDate(collectionDates) {
  const ss    = getSpreadsheet();
  const dates = Array.isArray(collectionDates)
    ? collectionDates
    : [collectionDates || formatDate(new Date())];
  const result = {};

  for (const tab of ALL_BRAND_TABS) {
    result[tab] = [];
    const sheet = ss.getSheetByName(tab);
    if (!sheet || sheet.getLastRow() <= 1) continue;

    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).getValues();
    result[tab] = data
      .filter(row => {
        const cellDate = row[0] instanceof Date ? formatDate(row[0]) : String(row[0]);
        return dates.includes(cellDate);
      })
      .map(row => ({
        collectDate: row[0] instanceof Date ? formatDate(row[0]) : String(row[0]),
        publishDate: row[1] instanceof Date ? formatDate(row[1]) : String(row[1]),
        brand:       row[2],
        category:    row[3],
        title:       row[4],
        url:         row[5],
        source:      row[6],
        mediaType:   row[7],
        remarks:     row[8]
      }));
  }
  return result;
}

/**
 * 오늘 Error_Log에서 최종실패 건수 집계
 * @returns {{total:number, sources:string[]}}
 */
function getTodayErrorCount() {
  const today  = formatDate(new Date());
  const result = { total: 0, sources: [] };
  try {
    const ss    = getSpreadsheet();
    const sheet = ss.getSheetByName('Error_Log');
    if (!sheet || sheet.getLastRow() <= 1) return result;
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues();
    for (const row of data) {
      const ts = row[0] ? formatDate(new Date(row[0])) : '';
      if (ts === today && String(row[6]) === '실패') {
        result.total++;
        result.sources.push(String(row[1]));
      }
    }
  } catch (_) {}
  return result;
}
