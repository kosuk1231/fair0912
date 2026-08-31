'use client';

import { useEffect, useState } from 'react';

export default function Gallery() {
  const [photos, setPhotos] = useState(null);

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
          <p className="sec-lead">한 장 한 장이 조례시설 처우개선의 목소리입니다.</p>
          {photos === null && <p className="empty">불러오는 중…</p>}
          {photos && photos.length === 0 && (
            <p className="empty">아직 제출된 사진이 없어요. 첫 번째 참여자가 되어 주세요!</p>
          )}
          {photos && photos.length > 0 && (
            <div className="gallery-grid">
              {photos.map((p) => (
                <figure className="g" key={p.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={`${p.name}님의 인증사진`} loading="lazy" />
                  <figcaption className="who">{p.name} · {p.org}</figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
