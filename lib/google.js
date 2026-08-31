import { google } from 'googleapis';
import { Readable } from 'stream';

/* 이슈온 전용 기본값 — 환경변수가 있으면 그쪽이 우선 */
const SHEET_ID = process.env.SHEET_ID || '1mVZfJWcm5kfNxeAwqGoYp24Ok0Q9skZM3qxJL8p-pSw';
const SHEET_TAB = process.env.SHEET_TAB || '제출목록';
const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID || '1U8Da_CIJcLsFFmiaa66nIkCHyU3G1tdA';

const HEADER = ['제출일시', '성함', '소속', '연락처', 'SNS링크', '사진URL', '드라이브링크'];
const COL_WIDTHS = [150, 90, 200, 130, 260, 320, 320];

function auth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  });
}

let ready = false; // 서버 인스턴스당 1회만 점검

/** 탭과 헤더가 없으면 만들어 둔다 (첫 제출 때 자동 실행) */
async function ensureSheet(sheets) {
  if (ready) return;

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  let tab = meta.data.sheets.find((s) => s.properties.title === SHEET_TAB);

  if (!tab) {
    const res = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: SHEET_TAB, gridProperties: { frozenRowCount: 1 } } } }],
      },
    });
    tab = { properties: res.data.replies[0].addSheet.properties };
  }

  const sheetId = tab.properties.sheetId;

  const head = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_TAB}!A1:G1`,
  });

  if (!head.data.values || head.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_TAB}!A1`,
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
    range: `${SHEET_TAB}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}

/** 드라이브 폴더에 사진 업로드 (공유 드라이브 지원) */
export async function uploadToDrive({ name, mimeType, buffer }) {
  const drive = google.drive({ version: 'v3', auth: auth() });
  const res = await drive.files.create({
    requestBody: { name, parents: [DRIVE_FOLDER_ID] },
    media: { mimeType, body: Readable.from(buffer) },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  });
  return res.data;
}
