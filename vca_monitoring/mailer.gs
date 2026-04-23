/**
 * ================================================================
 *  VCA 미디어 모니터링 시스템
 *  파일명: mailer.gs
 *  버전: v0.1d  |  최초작성: 2026-03-27  |  최종수정: 2026-03-28
 * ================================================================
 * [변경 이력]
 * v0.1a - 최초 생성 (이중수신자, 브랜드별 요약테이블, 오버플로우 처리)
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
 * v0.1d - buildEmailHTML/sendDailyReport 날짜 배열 지원,
 *         월요일 제목에 "금/토/일 수집분" 표시
 * ================================================================
 */

// ═══════════════════════════════════════════════════
// ■ PDF 리포트 스타일 이메일 HTML 빌드
// ═══════════════════════════════════════════════════

/**
 * 이메일 공통 CSS 반환 (v0.1b: 이모지 없는 심플 테이블 스타일)
 * @returns {string}
 */
function getEmailStyles() {
  return `<style>
body,table,td,th{font-family:'Malgun Gothic',Arial,sans-serif;font-size:12px;color:#333333}
body{background:#ffffff;margin:0;padding:0}
.wrap{max-width:900px;margin:0 auto;padding:20px 0}
.report-header{background:#ffffff;padding:16px 0 10px;border-bottom:2px solid #222222}
.report-title{font-size:16px;font-weight:bold;color:#222222;letter-spacing:1px}
.report-meta{font-size:11px;color:#666666;margin-top:4px}
.summary-box{background:#f8f8f8;border:1px solid #dddddd;padding:10px 16px;margin:12px 0;font-size:12px}
table.main-table{width:100%;border-collapse:collapse;border:1px solid #dddddd}
table.main-table th{background:#222222;color:#ffffff;font-weight:bold;font-size:11px;padding:7px 10px;text-align:left;white-space:nowrap;border:1px solid #444444}
table.main-table td{padding:6px 10px;border:1px solid #dddddd;vertical-align:top}
table.main-table tr.even td{background:#f9f9f9}
table.main-table tr.odd td{background:#ffffff}
table.main-table tr.section-vca td{background:#f0f0f0;font-weight:bold;font-size:12px;color:#1a1a2e;padding:8px 10px}
table.main-table tr.section-comp td{background:#f0f0f0;font-weight:bold;font-size:12px;color:#333333;padding:8px 10px}
table.main-table a{color:#1a1a2e;text-decoration:none}
table.main-table a:hover{text-decoration:underline}
.footer-legend{font-size:11px;color:#777777;margin-top:10px;padding-top:8px;border-top:1px solid #eeeeee}
.sheet-link{font-size:12px;margin-top:10px}
.sheet-link a{color:#1a1a2e;font-weight:bold}
</style>`;
}

/**
 * 기사 행 HTML 생성 (테이블 <tbody> 내부)
 * @param {Object[]} articles
 * @param {number}   startNum  - 순번 시작값
 * @returns {string}
 */
function buildArticleRows(articles, startNum) {
  if (!articles || !articles.length) return '';
  let html = '';
  articles.forEach((a, i) => {
    const rowClass = (startNum + i) % 2 === 0 ? 'even' : 'odd';
    const title    = escapeHtml(truncTitle(a.title || ''));
    const url      = escapeHtml(a.url || '#');
    const pubDate  = a.publishDate instanceof Date ? formatDate(a.publishDate) : String(a.publishDate || '-');
    html += `<tr class="${rowClass}">
      <td style="text-align:center;width:32px;white-space:nowrap">${startNum + i}</td>
      <td style="white-space:nowrap;width:88px">${escapeHtml(pubDate)}</td>
      <td style="width:110px">${escapeHtml(a.brand || '-')}</td>
      <td><a href="${url}" target="_blank">${title}</a></td>
      <td style="width:110px;word-break:break-all">${escapeHtml(a.source || '-')}</td>
      <td style="text-align:center;width:40px;white-space:nowrap">${escapeHtml(a.mediaType || '-')}</td>
      <td style="width:80px;font-size:11px;color:#888888">${escapeHtml(String(a.remarks || ''))}</td>
    </tr>`;
  });
  return html;
}

/**
 * 컬럼 헤더 행 HTML 생성
 * @returns {string}
 */
function buildColHeader() {
  return `<tr>
    <th style="width:32px">No</th>
    <th style="width:88px">발행일</th>
    <th style="width:110px">브랜드명</th>
    <th>기사제목</th>
    <th style="width:110px">미디어</th>
    <th style="width:40px">비고</th>
    <th style="width:80px">비고2</th>
  </tr>`;
}

/**
 * 일일 리포트 이메일 HTML 전체 생성 (v0.1d: 날짜 배열 지원)
 * @param {string|string[]} collectionDates - YYYY-MM-DD 또는 배열 (없으면 오늘)
 * @returns {string}
 */
function buildEmailHTML(collectionDates) {
  const dates     = Array.isArray(collectionDates) ? collectionDates : [collectionDates || formatDate(new Date())];
  const byBrand   = getArticlesByCollectionDate(dates);
  const ss        = getSpreadsheet();
  const sheetUrl  = ss.getUrl();
  const skipCount = dates.reduce((s, d) => s + getSkipCount(d), 0);

  // 건수 집계
  const vcaCount  = (byBrand['VCA'] || []).length;
  const compCount = ALL_BRAND_TABS.slice(1).reduce((s, t) => s + (byBrand[t] || []).length, 0);
  const total     = vcaCount + compCount;

  // 발행 기간 산출 (수집 기사의 B열 발행날짜 기준)
  const allArts   = Object.values(byBrand).flat();
  const pubDates  = allArts
    .map(a => (a.publishDate instanceof Date ? formatDate(a.publishDate) : String(a.publishDate || '')))
    .filter(Boolean)
    .sort();
  const collectStr = dates.length > 1
    ? `${dates[0]} ~ ${dates[dates.length - 1]}`
    : dates[0];
  const periodStr = pubDates.length > 0
    ? (pubDates[0] === pubDates[pubDates.length - 1]
        ? pubDates[0]
        : `${pubDates[0]} ~ ${pubDates[pubDates.length - 1]}`)
    : collectStr;

  // 헤더
  const headerHtml = `
  <div class="report-header">
    <div class="report-title">VCA Daily Monitoring Report</div>
    <div class="report-meta">수집일: ${collectStr}&nbsp;&nbsp;|&nbsp;&nbsp;발행기간: ${periodStr}</div>
  </div>`;

  // 요약
  const summaryHtml = `
  <div class="summary-box">
    [요약]&nbsp;&nbsp;
    VCA 기사: <strong>${vcaCount}건</strong>&nbsp;&nbsp;|&nbsp;&nbsp;
    경쟁사 기사: <strong>${compCount}건</strong>&nbsp;&nbsp;|&nbsp;&nbsp;
    총 <strong>${total}건</strong>&nbsp;&nbsp;|&nbsp;&nbsp;
    중복 제외: <strong>${skipCount}건</strong>
  </div>`;

  // VCA 테이블
  const vcaArts   = byBrand['VCA'] || [];
  const vcaRows   = buildArticleRows(vcaArts, 1);
  const vcaNoData = '<tr><td colspan="7" style="text-align:center;color:#aaaaaa;padding:12px">해당 기간 VCA 기사 없음</td></tr>';

  const vcaTableHtml = `
  <table class="main-table">
    <thead>
      <tr class="section-vca"><td colspan="7">Van Cleef &amp; Arpels&nbsp;&nbsp;(${vcaCount}건)</td></tr>
      ${buildColHeader()}
    </thead>
    <tbody>
      ${vcaRows || vcaNoData}
    </tbody>
  </table>`;

  // Competitors 테이블
  let compBodyHtml = '';
  let rowNum       = 1;
  for (const tab of ALL_BRAND_TABS.slice(1)) {
    const arts = byBrand[tab] || [];
    if (!arts.length) continue;
    compBodyHtml += buildArticleRows(arts, rowNum);
    rowNum += arts.length;
  }
  const compNoData = '<tr><td colspan="7" style="text-align:center;color:#aaaaaa;padding:12px">해당 기간 경쟁사 기사 없음</td></tr>';

  const compTableHtml = `
  <table class="main-table" style="margin-top:18px">
    <thead>
      <tr class="section-comp"><td colspan="7">Competitors News&nbsp;&nbsp;(${compCount}건)</td></tr>
      ${buildColHeader()}
    </thead>
    <tbody>
      ${compBodyHtml || compNoData}
    </tbody>
  </table>`;

  // 풋터
  const footerHtml = `
  <div class="footer-legend">
    * TGD=종합일간지, BD=경제지, O=온라인, MM=월간지, WM=주간지, SNS=인스타그램
  </div>
  <div class="sheet-link">
    구글 시트 바로가기: <a href="${escapeHtml(sheetUrl)}" target="_blank">${escapeHtml(sheetUrl)}</a>
  </div>`;

  return `<!DOCTYPE html><html lang="ko"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
${getEmailStyles()}
</head><body>
<div class="wrap">
  ${headerHtml}
  ${summaryHtml}
  ${vcaTableHtml}
  ${compTableHtml}
  ${footerHtml}
</div>
</body></html>`;
}

// ═══════════════════════════════════════════════════
// ■ 발송
// ═══════════════════════════════════════════════════

/**
 * 일일 리포트 이메일 발송 (v0.1d: 날짜 배열 지원, 월요일 제목 처리)
 * @param {string|string[]} [collectionDates] - YYYY-MM-DD 또는 배열, 없으면 오늘
 * @param {boolean}         [isTest=false]
 */
function sendDailyReport(collectionDates, isTest) {
  const dates   = Array.isArray(collectionDates) ? collectionDates : [collectionDates || formatDate(new Date())];
  const isMulti = dates.length > 1;

  const props   = PropertiesService.getScriptProperties();
  const email1  = props.getProperty('ADMIN_EMAIL') || Session.getEffectiveUser().getEmail();
  const email2  = props.getProperty('ADMIN_EMAIL2') || '';
  const recList = [email1, email2].filter(Boolean).join(',');

  // 건수 집계 (제목용)
  const byBrand = getArticlesByCollectionDate(dates);
  const total   = Object.values(byBrand).reduce((s, arr) => s + arr.length, 0);
  const todayKo = formatDateKorean(new Date());

  const prefix  = isTest ? '[테스트] ' : '';
  const label   = isMulti ? ' 금/토/일 수집분' : '';
  const subject = `${prefix}[VCA 미디어 모니터링] ${todayKo}${label} — 총 ${total}건`;
  const htmlBody = buildEmailHTML(dates);
  const plain    = 'HTML 지원 이메일 클라이언트에서 확인해주세요.';

  const doSend = () => GmailApp.sendEmail(recList, subject, plain, {
    htmlBody, name: 'VCA 미디어 모니터링'
  });

  try {
    doSend();
    Logger.log(`이메일 발송 완료 → ${recList} (${total}건)`);
  } catch (e) {
    Logger.log(`이메일 발송 실패: ${e.message} — 30초 후 재시도`);
    Utilities.sleep(30000);
    try {
      doSend();
      Logger.log('이메일 재발송 성공');
    } catch (e2) {
      Logger.log(`이메일 재발송 실패: ${e2.message}`);
      logError('GmailApp', '', 0, e2.message, 'sendDailyReport', '실패');
    }
  }
}
