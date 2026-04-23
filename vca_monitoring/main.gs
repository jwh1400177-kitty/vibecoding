/**
 * ================================================================
 *  VCA 미디어 모니터링 시스템
 *  파일명: main.gs
 *  버전: v0.1d  |  최초작성: 2026-03-27  |  최종수정: 2026-03-28
 * ================================================================
 * [변경 이력]
 * v0.1a - 최초 생성 (배치 7개 + setup() + runNow() 수동실행)
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
 * v0.1d - 주말 수집 정상 실행, 이메일 발송만 주말 제외,
 *         runFinalReport() 요일별 분기 (월=금/토/일, 화~금=어제, 토/일=건너뜀)
 * ================================================================
 *
 * ┌──────────────────────────────────────────────────────────┐
 * │  트리거 스케줄 (KST 기준, 타임존=Asia/Seoul 필수 설정)   │
 * │  07:00  runBatch1_Portals     포털 수집                  │
 * │  07:10  runBatch2_Web1        웹 01~20                   │
 * │  07:20  runBatch3_Web2        웹 21~40                   │
 * │  07:30  runBatch4_Web3        웹 41~56                   │
 * │  07:40  runBatch5_Instagram1  IG 01~30                   │
 * │  07:50  runBatch6_Instagram2  IG 31~62                   │
 * │  08:00  runFinalReport        이메일 발송                │
 * └──────────────────────────────────────────────────────────┘
 */

// ═══════════════════════════════════════════════════
// ■ 배치 진입점
// ═══════════════════════════════════════════════════

/** 배치 1: 포털 수집 (07:00 KST) */
function runBatch1_Portals() {
  _urlHashCache = null;
  _titleData    = null;
  PropertiesService.getScriptProperties().setProperty('BATCH_CURSOR', '1');
  Logger.log('=== 배치 1/7 시작: 포털 수집 ===');
  collectFromPortals();
  Logger.log('=== 배치 1 완료 ===');
}

/** 배치 2: 웹 소스 01~20 (07:10 KST) */
function runBatch2_Web1() {
  PropertiesService.getScriptProperties().setProperty('BATCH_CURSOR', '2');
  Logger.log('=== 배치 2/7 시작: 웹 01~20 ===');
  collectWebBatch1();
  Logger.log('=== 배치 2 완료 ===');
}

/** 배치 3: 웹 소스 21~40 (07:20 KST) */
function runBatch3_Web2() {
  PropertiesService.getScriptProperties().setProperty('BATCH_CURSOR', '3');
  Logger.log('=== 배치 3/7 시작: 웹 21~40 ===');
  collectWebBatch2();
  Logger.log('=== 배치 3 완료 ===');
}

/** 배치 4: 웹 소스 41~56 (07:30 KST) */
function runBatch4_Web3() {
  PropertiesService.getScriptProperties().setProperty('BATCH_CURSOR', '4');
  Logger.log('=== 배치 4/7 시작: 웹 41~56 ===');
  collectWebBatch3();
  Logger.log('=== 배치 4 완료 ===');
}

/** 배치 5: Instagram 01~30 (07:40 KST) */
function runBatch5_Instagram1() {
  PropertiesService.getScriptProperties().setProperty('BATCH_CURSOR', '5');
  Logger.log('=== 배치 5/7 시작: Instagram 01~30 ===');
  collectInstagramBatch1();
  Logger.log('=== 배치 5 완료 ===');
}

/** 배치 6: Instagram 31~62 (07:50 KST) */
function runBatch6_Instagram2() {
  PropertiesService.getScriptProperties().setProperty('BATCH_CURSOR', '6');
  Logger.log('=== 배치 6/7 시작: Instagram 31~62 ===');
  collectInstagramBatch2();
  Logger.log('=== 배치 6 완료 ===');
}

/** 배치 7: 이메일 발송 (08:00 KST) */
function runFinalReport() {
  PropertiesService.getScriptProperties().setProperty('BATCH_CURSOR', '7');
  Logger.log('=== 배치 7/7 시작: 리포트 발송 ===');

  const today = new Date();
  const dow   = today.getDay(); // 0=일, 1=월, ..., 6=토

  // 토/일: 이메일 발송 건너뜀 (수집은 정상 실행됨)
  if (dow === 0 || dow === 6) {
    Logger.log('주말 — 이메일 발송 건너뜀 (수집은 정상 실행)');
    PropertiesService.getScriptProperties().setProperty('BATCH_CURSOR', '0');
    return;
  }

  let collectionDates;
  if (dow === 1) {
    // 월요일: 금/토/일 수집분 통합 발송
    collectionDates = [
      formatDate(subtractDays(today, 3)), // 금요일
      formatDate(subtractDays(today, 2)), // 토요일
      formatDate(subtractDays(today, 1))  // 일요일
    ];
    Logger.log(`월요일 통합 발송: ${collectionDates.join(', ')}`);
  } else {
    // 화~금: 어제 수집분
    collectionDates = [formatDate(subtractDays(today, 1))];
    Logger.log(`일반 발송: ${collectionDates[0]}`);
  }

  PropertiesService.getScriptProperties().setProperty('LAST_RUN', formatDate(today));
  updateConfigDisplay();
  sendDailyReport(collectionDates, false);
  PropertiesService.getScriptProperties().setProperty('BATCH_CURSOR', '0');
  Logger.log('=== 일일 모니터링 완료 ===');
}

// ═══════════════════════════════════════════════════
// ■ 수동 실행 (v0.1c: 포털만 수집 후 이메일 발송)
// ═══════════════════════════════════════════════════

/**
 * 포털 수집 + 이메일 발송 수동 실행
 * v0.1c: 포털(배치1)만 수집. 웹/인스타는 runBatch2~6 별도 실행.
 *        6분 초과 방지를 위해 의도적으로 포털만 포함.
 *
 * @param {string} [targetDate] - YYYY-MM-DD (발행날짜 오버라이드, 없으면 어제 자동)
 *
 * 웹/인스타 추가 수집이 필요할 경우:
 *   → runBatch2_Web1(), runBatch3_Web2(), runBatch4_Web3()
 *   → runBatch5_Instagram1(), runBatch6_Instagram2()
 *   → 배치별 개별 실행 후 runFinalReport() 또는 sendDailyReport() 호출
 */
function runNow(targetDate) {
  Logger.log('===== VCA 모니터링 수동 실행 (포털 수집) =====');
  const collectionDate = formatDate(new Date());

  // targetDate 오버라이드 설정
  if (targetDate) {
    const target = new Date(targetDate);
    PropertiesService.getScriptProperties().setProperty('DATE_RANGE_OVERRIDE', JSON.stringify({
      start: formatDate(target),
      end:   formatDate(target)
    }));
    Logger.log(`발행날짜 오버라이드: ${formatDate(target)}`);
  }

  // 1. 오늘 수집분 초기화
  clearTodayData();

  // 2. 포털 수집 (배치 1)
  _urlHashCache = null;
  _titleData    = null;
  runBatch1_Portals();

  // DATE_RANGE_OVERRIDE 정리
  PropertiesService.getScriptProperties().deleteProperty('DATE_RANGE_OVERRIDE');

  // 3. 이메일 발송
  PropertiesService.getScriptProperties().setProperty('LAST_RUN', collectionDate);
  sendDailyReport(collectionDate, false);

  // 최종 로그
  const byBrand   = getArticlesByCollectionDate(collectionDate);
  const vcaCount  = (byBrand['VCA'] || []).length;
  const compCount = ALL_BRAND_TABS.slice(1).reduce((s, t) => s + (byBrand[t] || []).length, 0);
  const skipCount = getSkipCount(collectionDate);

  Logger.log(`runNow 완료: VCA ${vcaCount}건 / 경쟁사 ${compCount}건 / 중복제외 ${skipCount}건`);
  Logger.log('웹/인스타 수집은 runBatch2~6을 순서대로 별도 실행하세요.');
}

// ═══════════════════════════════════════════════════
// ■ 수집 초기화 및 재수집
// ═══════════════════════════════════════════════════

/**
 * 오늘 수집날짜(A열)로 저장된 행을 전체 브랜드 탭 + Duplicate_Check에서 삭제
 * 완료 로그: "초기화 완료: 브랜드탭 N행 삭제, Duplicate_Check N행 삭제"
 */
function clearTodayData() {
  Logger.log('=== 오늘 수집 데이터 초기화 시작 ===');
  const ss    = getSpreadsheet();
  const today = formatDate(new Date());
  let   brandRowsDeleted = 0;
  let   dedupRowsDeleted = 0;

  // 브랜드 탭 12개 — 역순 삭제로 인덱스 오차 방지
  for (const tab of ALL_BRAND_TABS) {
    const sheet = ss.getSheetByName(tab);
    if (!sheet || sheet.getLastRow() <= 1) continue;
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    for (let i = data.length - 1; i >= 0; i--) {
      const cellDate = data[i][0] instanceof Date ? formatDate(data[i][0]) : String(data[i][0]);
      if (cellDate === today) {
        sheet.deleteRow(i + 2);
        brandRowsDeleted++;
      }
    }
  }

  // Duplicate_Check — B열(수집일자) 기준 삭제
  const dedupSheet = ss.getSheetByName('Duplicate_Check');
  if (dedupSheet && dedupSheet.getLastRow() > 1) {
    const data = dedupSheet.getRange(2, 1, dedupSheet.getLastRow() - 1, 2).getValues();
    for (let i = data.length - 1; i >= 0; i--) {
      const cellDate = data[i][1] instanceof Date ? formatDate(data[i][1]) : String(data[i][1]);
      if (cellDate === today) {
        dedupSheet.deleteRow(i + 2);
        dedupRowsDeleted++;
      }
    }
  }

  // 캐시 및 카운터 초기화
  _urlHashCache = null;
  _titleData    = null;
  PropertiesService.getScriptProperties().deleteProperty(`SKIP_COUNT_${today}`);

  Logger.log(`초기화 완료: 브랜드탭 ${brandRowsDeleted}행 삭제, Duplicate_Check ${dedupRowsDeleted}행 삭제`);
}

/**
 * 오늘 수집 데이터를 완전히 지우고 포털 배치만 재수집
 * 완료 로그: "초기화 + 재수집 완료: VCA N건, 경쟁사 합계 N건"
 */
function clearAndRecollect() {
  Logger.log('===== 초기화 + 재수집 시작 =====');

  // 1. 오늘 데이터 삭제
  clearTodayData();

  // 2. 포털 재수집
  _urlHashCache = null;
  _titleData    = null;
  runBatch1_Portals();

  // 결과 로그
  const collectionDate = formatDate(new Date());
  const byBrand        = getArticlesByCollectionDate(collectionDate);
  const vcaCount       = (byBrand['VCA'] || []).length;
  const compCount      = ALL_BRAND_TABS.slice(1).reduce((s, t) => s + (byBrand[t] || []).length, 0);

  Logger.log(`초기화 + 재수집 완료: VCA ${vcaCount}건, 경쟁사 합계 ${compCount}건`);
}

// ═══════════════════════════════════════════════════
// ■ 트리거 등록
// ═══════════════════════════════════════════════════

/**
 * 기존 트리거 모두 삭제 후 7개 신규 등록
 * 사전 조건: 스크립트 설정 → 타임존 = Asia/Seoul
 */
function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  Logger.log('기존 트리거 모두 삭제');

  const schedule = [
    { fn: 'runBatch1_Portals',    hour: 7,  minute: 0  },
    { fn: 'runBatch2_Web1',       hour: 7,  minute: 10 },
    { fn: 'runBatch3_Web2',       hour: 7,  minute: 20 },
    { fn: 'runBatch4_Web3',       hour: 7,  minute: 30 },
    { fn: 'runBatch5_Instagram1', hour: 7,  minute: 40 },
    { fn: 'runBatch6_Instagram2', hour: 7,  minute: 50 },
    { fn: 'runFinalReport',       hour: 8,  minute: 0  }
  ];

  for (const s of schedule) {
    ScriptApp.newTrigger(s.fn)
      .timeBased()
      .atHour(s.hour)
      .nearMinute(s.minute)
      .everyDays(1)
      .create();
    Logger.log(`트리거 등록: ${s.fn} → KST ${s.hour}:${String(s.minute).padStart(2, '0')}`);
  }
  Logger.log(`트리거 ${schedule.length}개 등록 완료`);
}

// ═══════════════════════════════════════════════════
// ■ 최초 설정 함수 (1회만 실행)
// ═══════════════════════════════════════════════════

/**
 * 최초 설정 함수
 * 실행 전 PropertiesService에 SPREADSHEET_ID, ADMIN_EMAIL 등록 필수
 */
function setup() {
  Logger.log('===== VCA 모니터링 초기 설정 시작 =====');

  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id || !id.trim()) {
    const msg = 'SPREADSHEET_ID를 PropertiesService에 먼저 등록하세요.\n' +
                'GAS 에디터 → 프로젝트 설정 → 스크립트 속성 → SPREADSHEET_ID 추가';
    Logger.log('ERROR: ' + msg);
    try { SpreadsheetApp.getUi().alert('설정 필요', msg, SpreadsheetApp.getUi().ButtonSet.OK); } catch (_) {}
    return;
  }

  initSheets();
  setupTriggers();

  Logger.log('테스트 수집 중...');
  _urlHashCache = null;
  _titleData    = null;
  const after   = formatDate(subtractDays(new Date(), 3));
  const tests   = searchGoogleNewsRSS('반클리프 아펠', after);
  const saved   = saveArticles(tests.slice(0, 10));
  Logger.log(`테스트 수집 완료: ${saved}건`);

  sendDailyReport(null, true);

  const ss  = getSpreadsheet();
  const msg = [
    '초기 설정이 완료되었습니다!',
    '',
    '스프레드시트: ' + ss.getUrl(),
    '테스트 기사 수집: ' + saved + '건',
    '트리거: 매일 KST 07:00~08:00',
    '',
    '▶ 다음 단계:',
    '  1. PropertiesService → ADMIN_EMAIL2 추가 (선택)',
    '  2. NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 추가 (선택)',
    '  3. 내일 08:00에 첫 정식 리포트가 발송됩니다.',
    '  4. 토·일요일은 수집 없이 월요일에 금~일 기사를 한꺼번에 수집합니다.'
  ].join('\n');

  Logger.log(msg);
  try {
    SpreadsheetApp.getUi().alert('VCA 모니터링 설정 완료', msg, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (_) {}

  Logger.log('===== 초기 설정 완료 =====');
}
