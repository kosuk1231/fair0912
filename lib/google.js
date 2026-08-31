import { google } from 'googleapis';
import { Readable } from 'stream';

/* 이슈온 전용 기본값 — 환경변수가 있으면 그쪽이 우선 */
const SHEET_ID = process.env.SHEET_ID || '1mVZfJWcm5kfNxeAwqGoYp24Ok0Q9skZM3qxJL8p-pSw';
const SHEET_TAB = process.env.SHEET_TAB || '제출목록';
// 공유 드라이브 루트 ID (0A로 시작). 하위 폴더를 쓰려면 그 폴더 ID로 교체.
const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID || '0AOMa5m2h1GJuUk9PVA';

const HEADER = ['제출일시', '성함', '소속', '연락처', 'SNS링크', '사진URL', '드라이브링크'];
const COL_WIDTHS = [150, 90, 200, 130, 260, 320, 320];

/* 서명운동 — 별도 탭(기본) 또는 SIGN_SHEET_ID로 완전히 다른 문서에 기록 */
const SIGN_SHEET_ID = process.env.SIGN_SHEET_ID || SHEET_ID;
/* 서명 이미지 저장 폴더 — 미설정 시 사진과 같은 곳으로 떨어지므로 반드시 지정할 것 */
const SIGN_DRIVE_FOLDER_ID = process.env.SIGN_DRIVE_FOLDER_ID || DRIVE_FOLDER_ID;
const SIGN_TAB = process.env.SIGN_TAB || '서명부';
const SIGN_HEADER = ['서명일시', '성명', '자치구', '연락처', '소속', '서명이미지'];
const SIGN_COL_WIDTHS = [150, 100, 110, 130, 200, 320];

/** 환경변수에 어떤 형태로 들어와도 유효한 PEM으로 되돌린다.
 *  흔한 사고: 앞뒤 따옴표가 같이 저장됨 / 줄바꿈이 \n 문자열로 남음 /
 *  줄바꿈이 통째로 사라져 한 줄로 붙음 / CRLF 혼입 */
export function normalizePrivateKey(raw) {
  let k = (raw || '').trim();
  if (!k) return '';

  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1);
  }

  k = k.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const HEAD = '-----BEGIN PRIVATE KEY-----';
  const FOOT = '-----END PRIVATE KEY-----';

  if (!k.includes(HEAD)) {
    // 헤더 없이 base64 본문만 들어온 경우
    const body = k.replace(/\s+/g, '');
    return `${HEAD}\n${body.match(/.{1,64}/g).join('\n')}\n${FOOT}\n`;
  }

  // 줄바꿈이 사라져 한 줄로 붙은 경우 재구성
  const body = k
    .replace(HEAD, '')
    .replace(FOOT, '')
    .replace(/\s+/g, '');

  if (!body) return '';
  return `${HEAD}\n${body.match(/.{1,64}/g).join('\n')}\n${FOOT}\n`;
}

function auth() {
  const key = normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY);
  if (!key) throw new Error('GOOGLE_PRIVATE_KEY 환경변수가 비어 있습니다.');
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL 환경변수가 비어 있습니다.');
  }
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  });
}

let ready = false;        // 서버 인스턴스당 1회만 점검
let resolvedTab = null;   // 실제로 쓸 탭 이름

/** 탭과 헤더를 정리한다 (첫 제출 때 자동 실행)
 *  - SHEET_TAB 탭이 있으면 그걸 쓴다
 *  - 없지만 다른 탭에 이미 헤더(A1='제출일시')가 있으면 그 탭을 쓴다 ('시트1' 등)
 *  - 둘 다 없으면 SHEET_TAB 탭을 새로 만든다 */
async function ensureSheet(sheets) {
  if (ready) return;

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  let tab = meta.data.sheets.find((s) => s.properties.title === SHEET_TAB);

  if (!tab) {
    for (const cand of meta.data.sheets) {
      const title = cand.properties.title;
      try {
        const row = await sheets.spreadsheets.values.get({
          spreadsheetId: SHEET_ID,
          range: `'${title}'!A1:B1`,
        });
        const a1 = row.data.values?.[0]?.[0];
        if (a1 && String(a1).trim() === HEADER[0]) {
          tab = cand;
          resolvedTab = title;
          ready = true;
          return; // 헤더가 이미 있으므로 손대지 않는다
        }
      } catch {
        /* 다음 탭 확인 */
      }
    }
  }

  if (!tab) {
    const res = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: SHEET_TAB, gridProperties: { frozenRowCount: 1 } } } }],
      },
    });
    tab = { properties: res.data.replies[0].addSheet.properties };
  }

  resolvedTab = tab.properties.title;
  const sheetId = tab.properties.sheetId;

  const head = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${resolvedTab}'!A1:G1`,
  });

  if (!head.data.values || head.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `'${resolvedTab}'!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [HEADER] },
    });

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: HEADER.length },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.055, green: 0.431, blue: 0.431 },
                  textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                  horizontalAlignment: 'CENTER',
                  verticalAlignment: 'MIDDLE',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
            },
          },
          {
            updateSheetProperties: {
              properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
              fields: 'gridProperties.frozenRowCount',
            },
          },
          ...COL_WIDTHS.map((w, i) => ({
            updateDimensionProperties: {
              range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
              properties: { pixelSize: w },
              fields: 'pixelSize',
            },
          })),
        ],
      },
    });
  }

  ready = true;
}

/** 시트에 제출 1건을 행으로 추가 (append는 동시 호출에 안전) */
export async function appendToSheet(row) {
  const sheets = google.sheets({ version: 'v4', auth: auth() });
  await ensureSheet(sheets);
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `'${resolvedTab || SHEET_TAB}'!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}

/** 드라이브 폴더에 사진 업로드 (공유 드라이브 지원)
 *  링크가 있는 사람은 볼 수 있게 권한을 주고, 갤러리용 썸네일 URL을 함께 반환한다.
 *  썸네일은 드라이브가 직접 서빙하므로 Supabase 대역폭을 쓰지 않는다. */
export async function uploadToDrive({ name, mimeType, buffer, share = true, folderId }) {
  const drive = google.drive({ version: 'v3', auth: auth() });
  const res = await drive.files.create({
    requestBody: { name, parents: [folderId || DRIVE_FOLDER_ID] },
    media: { mimeType, body: Readable.from(buffer) },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  });

  const id = res.data.id;

  let shareError = null;
  if (share) {
    try {
      await drive.permissions.create({
        fileId: id,
        requestBody: { role: 'reader', type: 'anyone' },
        supportsAllDrives: true,
      });
    } catch (e) {
      shareError = e.message;
      console.error('Drive 공개 권한 설정 실패:', e.message);
    }
  }

  return {
    id,
    shareError,
    webViewLink: res.data.webViewLink,
    thumbnailUrl: `https://drive.google.com/thumbnail?id=${id}&sz=w800`,
  };
}


let signReady = false;

/** 서명부 탭이 없으면 만들고 헤더를 채운다 */
async function ensureSignSheet(sheets) {
  if (signReady) return;

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SIGN_SHEET_ID });
  let tab = meta.data.sheets.find((s) => s.properties.title === SIGN_TAB);

  if (!tab) {
    const res = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SIGN_SHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: SIGN_TAB, gridProperties: { frozenRowCount: 1 } } } }],
      },
    });
    tab = { properties: res.data.replies[0].addSheet.properties };
  }

  const sheetId = tab.properties.sheetId;
  const head = await sheets.spreadsheets.values.get({
    spreadsheetId: SIGN_SHEET_ID,
    range: `'${SIGN_TAB}'!A1:F1`,
  });

  if (!head.data.values || head.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SIGN_SHEET_ID,
      range: `'${SIGN_TAB}'!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [SIGN_HEADER] },
    });
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SIGN_SHEET_ID,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: SIGN_HEADER.length },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.086, green: 0.196, blue: 0.290 },
                  textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                  horizontalAlignment: 'CENTER',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
            },
          },
          {
            updateSheetProperties: {
              properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
              fields: 'gridProperties.frozenRowCount',
            },
          },
          ...SIGN_COL_WIDTHS.map((w, i) => ({
            updateDimensionProperties: {
              range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
              properties: { pixelSize: w },
              fields: 'pixelSize',
            },
          })),
        ],
      },
    });
  }

  signReady = true;
}

/** 서명 1건을 서명부에 추가 */
export async function appendToSignSheet(row) {
  const sheets = google.sheets({ version: 'v4', auth: auth() });
  await ensureSignSheet(sheets);
  await sheets.spreadsheets.values.append({
    spreadsheetId: SIGN_SHEET_ID,
    range: `'${SIGN_TAB}'!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}


/** 서명 이미지 업로드 — 별도 폴더, 공개 권한 없음 */
export async function uploadSignatureToDrive({ name, buffer }) {
  return uploadToDrive({
    name,
    mimeType: 'image/png',
    buffer,
    share: false,
    folderId: SIGN_DRIVE_FOLDER_ID,
  });
}

/** 설정 확인용 — 현재 어떤 저장소를 쓰는지 */
export function storageTargets() {
  return {
    사진_시트: SHEET_ID,
    사진_시트탭: SHEET_TAB,
    사진_드라이브: DRIVE_FOLDER_ID,
    서명_시트: SIGN_SHEET_ID,
    서명_시트탭: SIGN_TAB,
    서명_드라이브: SIGN_DRIVE_FOLDER_ID,
    분리됨: {
      시트: SIGN_SHEET_ID !== SHEET_ID,
      드라이브: SIGN_DRIVE_FOLDER_ID !== DRIVE_FOLDER_ID,
    },
  };
}
