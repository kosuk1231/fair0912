/**
 * 사전 점검: 서비스 계정이 시트에 쓰고 드라이브에 올릴 수 있는지 확인
 * 실행:  node scripts/check-google.mjs
 * (.env.local 값이 필요하면 미리 export 하거나 dotenv 사용)
 */
import { google } from 'googleapis';
import { Readable } from 'stream';

const SHEET_ID = process.env.SHEET_ID || '1mVZfJWcm5kfNxeAwqGoYp24Ok0Q9skZM3qxJL8p-pSw';
const SHEET_TAB = process.env.SHEET_TAB || '제출목록';
const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID || '1U8Da_CIJcLsFFmiaa66nIkCHyU3G1tdA';

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
  ],
});

const sheets = google.sheets({ version: 'v4', auth });
const drive = google.drive({ version: 'v3', auth });

let ok = true;

try {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const tabs = meta.data.sheets.map((s) => s.properties.title);
  console.log('✅ 시트 접근 성공 —', meta.data.properties.title);
  console.log('   탭 목록:', tabs.join(', '));
  if (!tabs.includes(SHEET_TAB)) {
    console.log(`ℹ️  '${SHEET_TAB}' 탭이 아직 없습니다 — 첫 제출 때 헤더와 함께 자동 생성됩니다.`);
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_TAB}!A1`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [['[점검]', '테스트', '삭제해도 됨', '', '', '', '']] },
    });
    console.log('✅ 시트 쓰기 성공 — 마지막 행에 [점검] 행이 추가됐습니다 (지우세요)');
  }
} catch (e) {
  console.log('❌ 시트 실패:', e.message);
  console.log('   → 시트를 서비스 계정 이메일에 "편집자"로 공유했는지 확인하세요.');
  ok = false;
}

try {
  const folder = await drive.files.get({
    fileId: DRIVE_FOLDER_ID,
    fields: 'id, name, driveId',
    supportsAllDrives: true,
  });
  console.log('✅ 드라이브 폴더 접근 성공 —', folder.data.name);
  console.log(folder.data.driveId ? '   공유 드라이브 폴더 (권장)' : '   개인 내 드라이브 폴더 (업로드 실패 가능)');

  const res = await drive.files.create({
    requestBody: { name: '_점검_삭제해도됨.txt', parents: [DRIVE_FOLDER_ID] },
    media: { mimeType: 'text/plain', body: Readable.from(Buffer.from('check')) },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  });
  console.log('✅ 드라이브 업로드 성공 —', res.data.webViewLink);
  await drive.files.delete({ fileId: res.data.id, supportsAllDrives: true });
  console.log('   점검 파일은 자동 삭제했습니다');
} catch (e) {
  console.log('❌ 드라이브 실패:', e.message);
  if (/storage quota|storageQuotaExceeded/i.test(e.message)) {
    console.log('   → 서비스 계정은 자체 저장용량이 없습니다. 폴더를 공유 드라이브로 옮기세요.');
  } else {
    console.log('   → 폴더를 서비스 계정 이메일에 "편집자"로 공유했는지 확인하세요.');
  }
  ok = false;
}

console.log(ok ? '\n모든 점검 통과 — 배포해도 됩니다.' : '\n일부 점검 실패 — 위 안내를 확인하세요.');
