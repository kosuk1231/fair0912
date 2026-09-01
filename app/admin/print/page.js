'use client';

import { useEffect, useState } from 'react';

const PER_PAGE = 10; // A4 한 장당 서명 수

export default function PrintRoster() {
  const [key, setKey] = useState('');
  const [rows, setRows] = useState(null);
  const [seoulSet, setSeoulSet] = useState(new Set());
  const [scope, setScope] = useState('seoul'); // seoul | all
  const [images, setImages] = useState({});
  const [loading, setLoading] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    const saved = sessionStorage.getItem('issueon-admin-key');
    if (saved) {
      setKey(saved);
      load(saved);
    }
  }, []);

  async function load(k) {
    setErr('');
    setLoading('명단을 불러오는 중…');
    try {
      const res = await fetch('/api/admin?kind=signatures', {
        headers: { 'x-admin-key': k },
        cache: 'no-store',
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || '불러오기 실패');
      setRows(json.rows);
      setSeoulSet(new Set(Object.keys(json.seoul)));
      sessionStorage.setItem('issueon-admin-key', k);
      await loadImages(json.rows, k);
    } catch (e) {
      setErr(e.message);
      setRows(null);
    } finally {
      setLoading('');
    }
  }

  /** 비공개 서명 이미지를 관리자 권한으로 받아 blob URL로 변환 */
  async function loadImages(list, k) {
    const targets = list.filter((r) => r.drive_link);
    const map = {};
    for (let i = 0; i < targets.length; i += 8) {
      setLoading(`서명 이미지 ${i} / ${targets.length}`);
      const batch = targets.slice(i, i + 8);
      await Promise.all(
        batch.map(async (r) => {
          const id = extractId(r.drive_link);
          if (!id) return;
          try {
            const res = await fetch(`/api/admin/signature?id=${id}`, {
              headers: { 'x-admin-key': k },
            });
            if (!res.ok) return;
            map[r.id] = URL.createObjectURL(await res.blob());
          } catch {
            /* 개별 실패는 건너뛴다 */
          }
        })
      );
    }
    setImages(map);
  }

  function extractId(link) {
    const m = String(link).match(/\/d\/([^/]+)/);
    return m ? m[1] : null;
  }

  if (!rows) {
    return (
      <section>
        <div className="wrap">
          <h2 className="sec-title">서명부 <span className="t">인쇄</span></h2>
          <form
            className="form-card"
            style={{ marginTop: 20 }}
            onSubmit={(e) => {
              e.preventDefault();
              load(key);
            }}
          >
            <div className="field">
              <label htmlFor="k">관리자 키</label>
              <input id="k" type="password" value={key} onChange={(e) => setKey(e.target.value)} required />
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }}>불러오기</button>
            {loading && <p className="form-msg">{loading}</p>}
            {err && <p className="form-msg err">{err}</p>}
          </form>
        </div>
      </section>
    );
  }

  const filtered = scope === 'seoul' ? rows.filter((r) => seoulSet.has(r.district)) : rows;
  const pages = [];
  for (let i = 0; i < filtered.length; i += PER_PAGE) {
    pages.push(filtered.slice(i, i + PER_PAGE));
  }

  return (
    <>
      <div className="print-toolbar">
        <div className="wrap">
          <div className="print-scope">
            <button type="button" className={scope === 'seoul' ? 'on' : ''} onClick={() => setScope('seoul')}>
              서울 거주자만 ({rows.filter((r) => seoulSet.has(r.district)).length})
            </button>
            <button type="button" className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>
              전체 ({rows.length})
            </button>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>
            인쇄 / PDF 저장
          </button>
        </div>
        {loading && <p className="print-loading">{loading}</p>}
      </div>

      <div className="roster">
        {pages.map((page, pi) => (
          <div className="sheet" key={pi}>
            <header className="sheet-head">
              <h1>조례시설 종사자 처우개선 촉구 서명부</h1>
              <p>
                서울특별시사회복지사협회 공정위원회 · 현안대응 캠페인 ‘이슈온’
                {scope === 'seoul' ? ' · 서울특별시 거주자' : ''}
              </p>
            </header>

            <table>
              <thead>
                <tr>
                  <th style={{ width: '8%' }}>연번</th>
                  <th style={{ width: '18%' }}>성명</th>
                  <th style={{ width: '20%' }}>거주 지역</th>
                  <th style={{ width: '30%' }}>서명</th>
                  <th style={{ width: '24%' }}>서명일</th>
                </tr>
              </thead>
              <tbody>
                {page.map((r, i) => (
                  <tr key={r.id}>
                    <td>{pi * PER_PAGE + i + 1}</td>
                    <td className="nm">{r.name}</td>
                    <td>{r.district}</td>
                    <td className="sig">
                      {images[r.id] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={images[r.id]} alt="" />
                      ) : (
                        <span className="nosig">—</span>
                      )}
                    </td>
                    <td>
                      {new Date(r.created_at).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <footer className="sheet-foot">
              <span>총 {filtered.length}명 중 {pi * PER_PAGE + 1}–{pi * PER_PAGE + page.length}</span>
              <span>{pi + 1} / {pages.length}</span>
            </footer>
          </div>
        ))}
        {filtered.length === 0 && <p className="empty">해당 조건의 서명이 없습니다.</p>}
      </div>
    </>
  );
}
