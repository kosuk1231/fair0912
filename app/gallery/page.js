'use client';

import { useCallback, useEffect, useState } from 'react';

export default function Gallery() {
  const [photos, setPhotos] = useState(null);
  const [open, setOpen] = useState(-1); // 확대 중인 사진 index (-1이면 닫힘)

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch('/api/photos', { cache: 'no-store' });
        const json = await res.json();
        if (alive) setPhotos(json.photos || []);
      } catch {
        if (alive) setPhotos([]);
      }
    }
    load();
    const t = setInterval(load, 30000); // 현장 스크린용 30초 자동 갱신
    return () => { alive = false; clearInterval(t); };
  }, []);

  const move = useCallback(
    (delta) => {
      if (!photos || photos.length === 0) return;
      setOpen((i) => (i < 0 ? i : (i + delta + photos.length) % photos.length));
    },
    [photos]
  );

  // 확대 중에는 배경 스크롤을 막고 키보드로 넘길 수 있게
  useEffect(() => {
    if (open < 0) return;
    function onKey(e) {
      if (e.key === 'Escape') setOpen(-1);
      if (e.key === 'ArrowRight') move(1);
      if (e.key === 'ArrowLeft') move(-1);
    }
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, move]);

  const cur = photos && open >= 0 ? photos[open] : null;

  return (
    <>
      <div className="topbar">
        <div className="wrap">
          <span className="org">이슈온 참여 사진</span>
          <a href="/">제출하러 가기</a>
        </div>
      </div>

      <section>
        <div className="wrap">
          <h2 className="sec-title">
            함께한 <span className="t">얼굴들</span>
          </h2>
          <p className="sec-lead">
            한 장 한 장이 조례시설 처우개선의 목소리입니다. 사진을 누르면 크게 볼 수 있어요.
          </p>

          {photos === null && <p className="empty">불러오는 중…</p>}
          {photos && photos.length === 0 && (
            <p className="empty">아직 제출된 사진이 없어요. 첫 번째 참여자가 되어 주세요!</p>
          )}
          {photos && photos.length > 0 && (
            <div className="gallery-grid">
              {photos.map((p, i) => (
                <figure className="g" key={p.id}>
                  <button
                    type="button"
                    className="g-btn"
                    onClick={() => setOpen(i)}
                    aria-label={`${p.name}님의 인증사진 크게 보기`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={`${p.name}님의 인증사진`} loading="lazy" />
                  </button>
                  <figcaption className="who">{p.name} · {p.org}</figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      </section>

      {cur && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="인증사진 크게 보기"
          onClick={() => setOpen(-1)}
        >
          <button type="button" className="lb-close" onClick={() => setOpen(-1)} aria-label="닫기">
            ×
          </button>

          {photos.length > 1 && (
            <button
              type="button"
              className="lb-nav lb-prev"
              onClick={(e) => { e.stopPropagation(); move(-1); }}
              aria-label="이전 사진"
            >
              ‹
            </button>
          )}

          <figure className="lb-body" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cur.url} alt={`${cur.name}님의 인증사진`} />
            <figcaption>
              <b>{cur.name} · {cur.org}</b>
              <span>{open + 1} / {photos.length}</span>
            </figcaption>
          </figure>

          {photos.length > 1 && (
            <button
              type="button"
              className="lb-nav lb-next"
              onClick={(e) => { e.stopPropagation(); move(1); }}
              aria-label="다음 사진"
            >
              ›
            </button>
          )}
        </div>
      )}
    </>
  );
}
