'use client';

import { useEffect, useState } from 'react';

export default function Admin() {
  const [key, setKey] = useState('');
  const [entered, setEntered] = useState(false);
  const [rows, setRows] = useState(null);
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
          <h2 className="sec-title">제출 <span className="t">관리</span></h2>
          <p className="sec-lead">
            숨김 처리한 제출은 갤러리에서 즉시 사라집니다. 시트·드라이브 원본은 그대로 남습니다.
          </p>
          {err && <p className="form-msg err">{err}</p>}
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
        </div>
      </section>
    </>
  );
}
