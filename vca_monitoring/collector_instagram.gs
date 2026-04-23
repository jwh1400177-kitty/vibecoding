/**
 * ================================================================
 *  VCA 미디어 모니터링 시스템
 *  파일명: collector_instagram.gs
 *  버전: v0.1d  |  최초작성: 2026-03-27  |  최종수정: 2026-03-28
 * ================================================================
 * [변경 이력]
 * v0.1a - 최초 생성 (JSON API → HTML → Google RSS 3단계 폴백)
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
// ■ Instagram 소스 목록 (62개)
// ═══════════════════════════════════════════════════

const INSTAGRAM_SOURCES = [
  { name: "Klocca",           handle: "klocca_magazine"      },
  { name: "Chicment",         handle: "chicmentmag"          },
  { name: "The Edit",         handle: "the_edit.co.kr"       },
  { name: "Daily Fashion",    handle: "dailyfashion_news"    },
  { name: "W Korea",          handle: "wkorea"               },
  { name: "Cosmopolitan KR",  handle: "cosmopolitankorea"    },
  { name: "Hip KR",           handle: "hipkr_"               },
  { name: "Harper's Bazaar",  handle: "harpersbazaarkorea"   },
  { name: "GQ Korea",         handle: "gq_korea"             },
  { name: "Elle Decor KR",    handle: "elledecorkorea"       },
  { name: "Elle Korea",       handle: "ellekorea"            },
  { name: "Marie Claire KR",  handle: "marieclairekorea"     },
  { name: "Fast Paper",       handle: "fastpapermag"         },
  { name: "Maison Korea",     handle: "maisonkorea"          },
  { name: "Singles Magazine", handle: "singlesmagazine"      },
  { name: "Hypebeast KR",     handle: "hypebeastkr"          },
  { name: "Esquire Korea",    handle: "esquire.korea"        },
  { name: "Fashion Biz",      handle: "fashionbizkr"         },
  { name: "Eyes Mag",         handle: "eyesmag"              },
  { name: "Y Magazine",       handle: "ymagazine_official"   },
  { name: "Men Noblesse",     handle: "mennoblesse_official" },
  { name: "Noblesse Korea",   handle: "noblessekorea"        },
  { name: "Dazed Korea",      handle: "dazedkorea"           },
  { name: "Arena Korea",      handle: "arenakorea"           },
  { name: "WWD Korea",        handle: "wwdkorea"             },
  { name: "Living Sense",     handle: "livingsense"          },
  { name: "Luxury Editors",   handle: "luxuryeditors"        },
  { name: "The Den",          handle: "den_magazine"         },
  { name: "Dreams Magazine",  handle: "dreamsmagazinekr"     },
  { name: "Wedding21",        handle: "wedding21_mag"        },
  { name: "Styler Mag",       handle: "styler_mag"           },
  { name: "Perple KOR",       handle: "perple_kor"           },
  { name: "Wedding H",        handle: "weddingh_magazine"    },
  { name: "Only Shinsegae",   handle: "only_shinsegae"       },
  { name: "Monthly Design",   handle: "monthlydesign"        },
  { name: "Shinsegae Mag",    handle: "magazine_shinsegae"   },
  { name: "Style H",          handle: "stylehmag"            },
  { name: "Allure Korea",     handle: "allurekorea"          },
  { name: "Galleria",         handle: "galleriadept"         },
  { name: "Woman Donga",      handle: "womandonga"           },
  { name: "Art Now",          handle: "artnow_official"      },
  { name: "W Korea Man",      handle: "wkorea_man"           },
  { name: "Vogue Korea",      handle: "voguekorea"           },
  { name: "Fortune KOR",      handle: "fortune_kor"          },
  { name: "Forbes Korea",     handle: "forbes__korea"        },
  { name: "iWomansense",      handle: "iwomansense"          },
  { name: "B&O Korea",        handle: "bangolufsenkorea"     },
  { name: "Style Chosun",     handle: "stylechosun"          },
  { name: "Style Hankyung",   handle: "style_hankyung"       },
  { name: "Noblesse Wedding", handle: "noblesse_weddings"    },
  { name: "Chronos Korea",    handle: "chronoskorea"         },
  { name: "EEE Pick",         handle: "eee.pick"             },
  { name: "Golf Digest KR",   handle: "golfdigest_korea"     },
  { name: "Neighbor Mag",     handle: "neighbor.magazine"    },
  { name: "L'Officiel KR",    handle: "lofficielkorea"       },
  { name: "High Cut",         handle: "highcutmag"           },
  { name: "Hweek",            handle: "hweekmag"             },
  { name: "Time Forum",       handle: "timeforum.co.kr"      },
  { name: "Timetrove",        handle: "timetrove_wj"         },
  { name: "Montres Korea",    handle: "montres_korea"        },
  { name: "GMT Korea",        handle: "gmtmagazine_kor"      },
  { name: "Lady GMT",         handle: "lady_gmt"             }
];

// ═══════════════════════════════════════════════════
// ■ Instagram 수집 전략 (3단계 폴백)
// ═══════════════════════════════════════════════════

/**
 * [1단계] 모바일 JSON API 엔드포인트 시도
 * @param {string} handle
 * @returns {{caption:string, url:string, date:string}[]|null}
 */
function fetchInstagramJSON(handle) {
  const url = `https://www.instagram.com/${handle}/?__a=1&__d=dis`;
  try {
    const res = UrlFetchApp.fetch(url, {
      headers: {
        "User-Agent":      UA_POOL[2],
        "Accept":          "application/json",
        "Accept-Language": "ko-KR,ko;q=0.9",
        "Referer":         "https://www.instagram.com/"
      },
      followRedirects: true,
      muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) return null;

    const json  = JSON.parse(res.getContentText());
    const edges = json?.graphql?.user?.edge_owner_to_timeline_media?.edges;
    if (!edges || !edges.length) return null;

    return edges.map(e => ({
      caption: e.node?.edge_media_to_caption?.edges?.[0]?.node?.text || '',
      url:     `https://www.instagram.com/p/${e.node?.shortcode}/`,
      date:    e.node?.taken_at_timestamp
               ? formatDate(new Date(e.node.taken_at_timestamp * 1000))
               : formatDate(new Date())
    })).filter(p => p.caption && p.url.includes('/p/'));
  } catch (_) { return null; }
}

/**
 * [2단계] HTML 파싱 (LD+JSON 또는 _sharedData)
 * @param {string} handle
 * @returns {{caption:string, url:string, date:string}[]|null}
 */
function fetchInstagramHTML(handle) {
  const profileUrl = `https://www.instagram.com/${handle}/`;
  try {
    const res = UrlFetchApp.fetch(profileUrl, {
      headers: { ...getDefaultHeaders(), "User-Agent": UA_POOL[2] },
      followRedirects: true, muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) return null;

    const html  = res.getContentText('UTF-8');
    const posts = [];

    // LD+JSON 블록 파싱
    const ldRe = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
    let ldM;
    while ((ldM = ldRe.exec(html)) !== null) {
      try {
        const items = [].concat(JSON.parse(ldM[1]));
        for (const item of items) {
          const caption = item.caption || item.articleBody || '';
          if (caption) posts.push({ caption, url: item.url || profileUrl, date: formatDate(new Date()) });
        }
      } catch (_) {}
    }
    if (posts.length) return posts;

    // _sharedData 파싱
    const sdM = html.match(/window\._sharedData\s*=\s*(\{[\s\S]+?\});\s*<\/script>/);
    if (sdM) {
      try {
        const edges = JSON.parse(sdM[1])
          ?.entry_data?.ProfilePage?.[0]?.graphql?.user
          ?.edge_owner_to_timeline_media?.edges || [];
        for (const e of edges) {
          const caption = e.node?.edge_media_to_caption?.edges?.[0]?.node?.text || '';
          const sc      = e.node?.shortcode || '';
          if (caption && sc) {
            posts.push({ caption, url: `https://www.instagram.com/p/${sc}/`, date: formatDate(new Date()) });
          }
        }
        if (posts.length) return posts;
      } catch (_) {}
    }
    return null;
  } catch (_) { return null; }
}

/**
 * [3단계] Google News RSS로 계정 키워드 간접 검색
 * @param {string} handle
 * @returns {{caption:string, url:string, date:string}[]}
 */
function fetchInstagramViaGoogleRSS(handle) {
  const posts = [];
  const url   = `https://news.google.com/rss/search?q=site:instagram.com/${handle}+${encodeURIComponent(VCA_KEYWORDS[0])}&hl=ko`;
  try {
    const res = UrlFetchApp.fetch(url, {
      headers: getDefaultHeaders(), muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) return posts;

    const xml    = res.getContentText();
    const itemRe = /<item>([\s\S]*?)<\/item>/g;
    let item;
    while ((item = itemRe.exec(xml)) !== null) {
      const c  = item[1];
      const tM = c.match(/<title>(?:<!\[CDATA\[)?([^\]<]+?)(?:\]\]>)?<\/title>/);
      const lM = c.match(/<link>([^<]+)<\/link>/);
      if (tM && lM) {
        posts.push({ caption: tM[1].trim(), url: lM[1].trim(), date: formatDate(new Date()) });
      }
    }
  } catch (e) {
    Logger.log(`Instagram Google RSS 실패 (@${handle}): ${e.message}`);
  }
  return posts;
}

/**
 * 핸들에 대한 Instagram 게시물 수집 (3단계 폴백)
 * @param {string} handle
 * @returns {{caption:string, url:string, date:string}[]}
 */
function fetchInstagramPosts(handle) {
  let posts = fetchInstagramJSON(handle);
  if (posts && posts.length) return posts;
  Utilities.sleep(randomInt(1000, 2000));
  posts = fetchInstagramHTML(handle);
  if (posts && posts.length) return posts;
  Utilities.sleep(randomInt(1000, 2000));
  return fetchInstagramViaGoogleRSS(handle);
}

/**
 * 게시물 캡션에서 브랜드 키워드 감지
 * @param {string} caption
 * @returns {{brand:string, brandTab:string, category:string}|null}
 */
function matchKeyword(caption) {
  return detectBrand(caption);
}

// ═══════════════════════════════════════════════════
// ■ 배치 수집
// ═══════════════════════════════════════════════════

/**
 * INSTAGRAM_SOURCES 배열의 startIdx~endIdx 범위 수집
 * @param {number} startIdx
 * @param {number} endIdx
 * @returns {number} 저장된 기사 수
 */
function collectInstagramBatch(startIdx, endIdx) {
  // 주말에도 수집 실행 (null → 어제 기준)
  const range = getDateRange() || { start: subtractDays(new Date(), 1), end: subtractDays(new Date(), 1) };

  const startTime = new Date();
  const batch     = INSTAGRAM_SOURCES.slice(startIdx, endIdx);
  const all       = [];

  Logger.log(`▶ Instagram 배치: ${startIdx+1}~${Math.min(endIdx, INSTAGRAM_SOURCES.length)}번 (${batch.length}개 계정)`);

  for (const source of batch) {
    if (isApproachingTimeout(startTime)) {
      Logger.log('타임아웃 임박 — Instagram 배치 조기 종료');
      break;
    }
    Logger.log(`  수집 중: @${source.handle}`);
    Utilities.sleep(randomInt(2000, 5000));

    const posts   = fetchInstagramPosts(source.handle);
    let matched   = 0;

    for (const post of posts) {
      const brandInfo = matchKeyword(post.caption);
      if (!brandInfo) continue;
      const caption = post.caption.slice(0, 150) + (post.caption.length > 150 ? '...' : '');
      all.push({
        title:       caption,
        url:         post.url,
        publishDate: post.date || formatDate(new Date()),
        brand:       brandInfo.brand,
        brandTab:    brandInfo.brandTab,
        category:    brandInfo.category,
        source:      `Instagram-${source.handle}`,
        mediaType:   'SNS',
        remarks:     'Instagram'
      });
      matched++;
    }
    Logger.log(`  → @${source.handle}: ${matched}건 키워드 매칭`);
  }

  const saved = saveArticles(all);
  Logger.log(`=== Instagram 배치(${startIdx+1}~${endIdx}) 완료: ${saved}건 저장 ===`);
  return saved;
}

/** Instagram 소스 1-30 (배치 5 → 07:40) */
function collectInstagramBatch1() { collectInstagramBatch(0, 30); }

/** Instagram 소스 31-62 (배치 6 → 07:50) */
function collectInstagramBatch2() { collectInstagramBatch(30, INSTAGRAM_SOURCES.length); }
