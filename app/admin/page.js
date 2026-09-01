'use client';

import { useEffect, useState } from 'react';

export default function Admin() {
  const [key, setKey] = useState('');
  const [entered, setEntered] = useState(false);
  const [rows, setRows] = useState(null);
  const [tab, setTab] = useState('photos');
  const [sigs, setSigs] = useState(null);
  const [err, setErr] = useState('');

  async function load(k) {
    setErr('');
    const res = await fetch('/api/admin', { headers: { 'x-admin-key': k }, cache: 'no-store' });
    const json = await res.json();
    if (!json.ok) {
      setErr(json.error || '불러오기에 실패했어요.');
      setEntered(false);
      return;
    }
    setRows(json.rows);
    setEntered(true);
    sessionStorage.setItem('issueon-admin-key', k);
  }

  useEffect(() => {
    const saved = sessionStorage.getItem('issueon-admin-key');
    if (saved) {
      setKey(saved);
      load(saved);
    }
  }, []);

  async function loadSigs() {
    setErr('');
    const res = await fetch('/api/admin?kind=signatures', {
      headers: { 'x-admin-key': key },
      cache: 'no-store',
    });
    const json = await res.json();
    if (!json.ok) {
      setErr(json.error || '서명 목록을 불러오지 못했어요.');
      return;
    }
    setSigs(json);
  }

  function exportCsv() {
    if (!sigs) return;
    const seoulSet = new Set(Object.keys(sigs.seoul));
    const head = ['연번', '성명', '구분', '거주지역', '연락처', '소속', '서명일시', '서명이미지'];
    const lines = sigs.rows.map((r, i) => [
      i + 1, r.name, seoulSet.has(r.district) ? '서울' : '그 외',
      r.district, r.phone, r.org || '',
      new Date(r.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      r.drive_link || '',
    ]);
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = '\uFEFF' + [head, ...lines].map((r) => r.map(esc).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `이슈온_서명부_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function toggle(row) {
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-key': key },
      body: JSON.stringify({ id: row.id, hidden: !row.hidden }),
    });
    const json = await res.json();
    if (!json.ok) {
      setErr(json.error);
      return;
    }
    setRows(rows.map((r) => (r.id === row.id ? { ...r, hidden: !r.hidden } : r)));
  }

  if (!entered) {
    return (
      <>
        <div className="topbar">
          <div className="wrap">
            <span className="org">이슈온 관리</span>
            <a href="/">제출 페이지</a>
          </div>
        </div>
        <section>
          <div className="wrap">
            <h2 className="sec-title">관리자 <span className="t">확인</span></h2>
            <form
              className="form-card"
              style={{ marginTop: 20 }}
              onSubmit={(e) => {
                e.preventDefault();
                load(key);
              }}
            >
              <div className="field">
                <label htmlFor="key">관리자 키</label>
                <input
                  id="key"
                  type="password"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="ADMIN_KEY 값"
                  required
                />
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }}>들어가기</button>
              {err && <p className="form-msg err">{err}</p>}
            </form>
          </div>
        </section>
      </>
    );
  }

  const visible = rows.filter((r) => !r.hidden).length;

  return (
    <>
      <div className="topbar">
        <div className="wrap">
          <span className="org">이슈온 관리 · 표시 {visible} / 전체 {rows.length}</span>
          <a href="/gallery">갤러리 보기</a>
        </div>
      </div>
      <section>
        <div className="wrap">
          <div className="admin-tabs">
            <button
              type="button"
              className={tab === 'photos' ? 'on' : ''}
              onClick={() => setTab('photos')}
            >
              사진 제출
            </button>
            <button
              type="button"
              className={tab === 'signatures' ? 'on' : ''}
              onClick={() => {
                setTab('signatures');
                if (!sigs) loadSigs();
              }}
            >
              서명부
            </button>
          </div>

          {err && <p className="form-msg err">{err}</p>}

          {tab === 'signatures' ? (
            <>
              <h2 className="sec-title" style={{ marginTop: 18 }}>
                서명 <span className="t">현황</span>
              </h2>
              {sigs === null ? (
                <p className="empty">불러오는 중…</p>
              ) : (
                <>
                  <p className="sec-lead">
                    총 <b>{sigs.total.toLocaleString()}</b>명 (서울 {sigs.seoulTotal.toLocaleString()}명 ·
                    그 외 {sigs.otherTotal.toLocaleString()}명). 자치구별 집계는 시의회 지역구 설득
                    자료로 바로 쓸 수 있습니다.
                  </p>
                  <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-primary" onClick={exportCsv}>
                      CSV 내려받기
                    </button>
                    <a className="btn btn-ghost" href="/admin/print">
                      인쇄용 서명부 (자필 서명 포함)
                    </a>
                  </div>

                  <h3 className="tally-head">
                    서울특별시 <span>{sigs.seoulTotal.toLocaleString()}명</span>
                  </h3>
                  <div className="district-grid">
                    {Object.entries(sigs.seoul)
                      .sort((a, b) => b[1] - a[1])
                      .map(([d, n]) => (
                        <div className="district" key={d}>
                          <b>{n}</b>
                          <span>{d}</span>
                        </div>
                      ))}
                  </div>
                  {sigs.seoulTotal === 0 && <p className="empty">서울 지역 서명이 없습니다.</p>}

                  {sigs.otherTotal > 0 && (
                    <>
                      <h3 className="tally-head">
                        그 외 지역 <span>{sigs.otherTotal.toLocaleString()}명</span>
                      </h3>
                      <div className="district-grid">
                        {Object.entries(sigs.other)
                          .sort((a, b) => b[1] - a[1])
                          .map(([d, n]) => (
                            <div className="district other" key={d}>
                              <b>{n}</b>
                              <span>{d}</span>
                            </div>
                          ))}
                      </div>
                    </>
                  )}
                  {sigs.total === 0 && <p className="empty">아직 서명이 없습니다.</p>}
                </>
              )}
            </>
          ) : (
          <>
          <h2 className="sec-title" style={{ marginTop: 18 }}>제출 <span className="t">관리</span></h2>
          <p className="sec-lead">
            숨김 처리한 제출은 갤러리에서 즉시 사라집니다. 시트·드라이브 원본은 그대로 남습니다.
          </p>
          <div style={{ marginTop: 20, display: 'grid', gap: 12 }}>
            {rows.map((r) => (
              <div key={r.id} className="admin-row" data-hidden={r.hidden}>
                <div className="thumbs">
                  {(r.photo_urls || []).map((u, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={u} alt={`${r.name} 사진 ${i + 1}`} loading="lazy" />
                  ))}
                </div>
                <div className="meta">
                  <b>{r.name} · {r.org}</b>
                  <span>
                    {new Date(r.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
                    {r.phone ? ` · ${r.phone}` : ''}
                  </span>
                  {r.sns_url && (
                    <a href={r.sns_url} target="_blank" rel="noreferrer">SNS 게시물</a>
                  )}
                </div>
                <button
                  type="button"
                  className={`btn ${r.hidden ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => toggle(r)}
                >
                  {r.hidden ? '다시 표시' : '숨기기'}
                </button>
              </div>
            ))}
            {rows.length === 0 && <p className="empty">아직 제출이 없습니다.</p>}
          </div>
          </>
          )}
        </div>
      </section>
    </>
  );
}
