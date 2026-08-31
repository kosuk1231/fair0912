'use client';

import { useEffect, useRef, useState } from 'react';

/* 판넬 9종 문구 — 오렌지 강조(em), 틸 강조(span.t)는 판넬 원안 그대로 */
const SLOGANS = [
  {
    h: (
      <>
        <span className="t">지속 가능한 일자리</span>, <em>서울복지의 미래</em>입니다
      </>
    ),
    p: '안정된 일자리, 존중받는 가치, 함께 만드는 복지 사회',
    tags: '#지속가능한일자리 #서울복지',
  },
  {
    h: (
      <>
        <span className="t">청년 사회복지사</span>가 <em>머무를 수</em> 있는 현장이 필요합니다
      </>
    ),
    p: '청년 사회복지사가 머무는 현장이 곧, 더 나은 복지의 시작입니다',
    tags: '#청년사회복지사 #복지현장',
  },
  {
    h: (
      <>
        <span className="t">시설 위탁</span>이 종사자의 고용불안으로 이어져서는 <em>안 됩니다</em>
      </>
    ),
    p: '사회복지 서비스의 지속성과 질은 종사자의 안정된 고용에서 시작됩니다',
    tags: '#시설위탁 #고용안정',
  },
  {
    h: (
      <>
        고용이 안정되어야 <em>복지서비스</em>도 안정됩니다
      </>
    ),
    p: '사회복지사의 안정이 시민의 삶을 지키는 힘입니다',
    tags: '#안정된고용 #복지서비스',
  },
  {
    h: (
      <>
        <span className="t">서울시가 위탁한</span> 복지업무에는 <em>책임</em>도 함께 따라야 합니다
      </>
    ),
    p: '책임 있는 위탁이 시민의 권리 보호로 이어집니다',
    tags: '#책임있는위탁 #시민의권리',
  },
  {
    h: (
      <>
        <span className="t">경력은 온전히</span>, 복리후생은 <em>차별 없이</em>
      </>
    ),
    p: '동일 업무, 동일 가치라면 누려야 할 권리도 같습니다',
    tags: '#경력은온전히 #복리후생차별없이',
  },
  {
    h: (
      <>
        동일한 복지업무, 동일한 <em>경력인정</em>
      </>
    ),
    p: '동일한 노력, 동일한 가치, 동일한 인정 — 공정한 경력인정이 전문성 강화로 이어집니다',
    tags: '#동일한복지업무 #동일한경력인정',
  },
  {
    h: (
      <>
        조례시설이라는 이름으로 경력을 <em>낮게 인정</em>해서는 <em>안 됩니다</em>
      </>
    ),
    p: '동일한 업무, 동일한 경력, 동일한 가치 — 공정한 인정이 정의입니다',
    tags: '#조례시설 #경력인정',
  },
  {
    h: (
      <>
        안정된 처우 보장은 균등한 서비스 제공의 <em>첫걸음</em>입니다
      </>
    ),
    p: '사회복지사의 안정된 처우는 모두에게 균등한 복지 서비스를 실현합니다',
    tags: '#안정된처우 #균등한복지서비스',
  },
];

/* 업로드 전 브라우저에서 리사이즈·압축.
   Vercel 서버리스는 요청 본문 4.5MB가 상한이라 원본 그대로 보내면 거부된다. */
const MAX_EDGE = 1600;
const TARGET_BYTES = 900 * 1024;

async function compressImage(file) {
  if (!file.type.startsWith('image/')) return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  let blob = null;
  for (const q of [0.82, 0.7, 0.6, 0.5]) {
    blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', q));
    if (!blob) break;
    if (blob.size <= TARGET_BYTES) break;
  }
  if (!blob || blob.size >= file.size) return file;

  const base = file.name.replace(/\.[^.]+$/, '');
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
}

function VoiceSlider() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setI((v) => (v + 1) % SLOGANS.length), 5000);
    return () => clearInterval(t);
  }, [paused]);

  function go(n) {
    setPaused(true);
    setI((n + SLOGANS.length) % SLOGANS.length);
  }

  const s = SLOGANS[i];
  return (
    <div className="voice">
      <article className="voice-card" aria-live="polite">
        <h3>{s.h}</h3>
        <p>{s.p}</p>
        <div className="tags">{s.tags} #공정위원회</div>
      </article>
      <div className="voice-nav">
        <button type="button" onClick={() => go(i - 1)} aria-label="이전 메시지">‹</button>
        <span className="dots">
          {SLOGANS.map((_, n) => (
            <i
              key={n}
              className={n === i ? 'on' : ''}
              onClick={() => go(n)}
              role="button"
              tabIndex={0}
              aria-label={`${n + 1}번째 메시지 보기`}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && go(n)}
            />
          ))}
        </span>
        <button type="button" onClick={() => go(i + 1)} aria-label="다음 메시지">›</button>
      </div>
      <p className="voice-count" style={{ textAlign: 'center', marginTop: '10px' }}>
        {i + 1} / {SLOGANS.length}
      </p>
    </div>
  );
}

function UploadForm() {
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const inputRef = useRef(null);

  async function addFiles(list) {
    setErr('');
    setBusy(true);
    try {
      const incoming = Array.from(list).slice(0, 3 - files.length);
      const shrunk = await Promise.all(incoming.map(compressImage));
      const next = [...files, ...shrunk].slice(0, 3);
      setFiles(next);
      setPreviews(next.map((f) => URL.createObjectURL(f)));
    } catch {
      setErr('사진을 불러오지 못했어요. 다시 선택해 주세요.');
    } finally {
      setBusy(false);
    }
  }
  function removeFile(i) {
    const next = files.filter((_, j) => j !== i);
    setFiles(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr('');
    if (files.length === 0) {
      setErr('인증사진을 1장 이상 첨부해 주세요.');
      return;
    }
    const fd = new FormData(e.currentTarget);
    fd.delete('photos');
    files.forEach((f) => fd.append('photos', f));

    const total = files.reduce((n, f) => n + f.size, 0);
    if (total > 4 * 1024 * 1024) {
      setErr('사진 용량이 커서 한 번에 보낼 수 없어요. 장수를 줄여서 나눠 제출해 주세요.');
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/submit', { method: 'POST', body: fd });
      const type = res.headers.get('content-type') || '';
      if (!type.includes('application/json')) {
        throw new Error(
          res.status === 413
            ? '사진 용량이 너무 커요. 장수를 줄여서 다시 시도해 주세요.'
            : '서버 응답을 받지 못했어요. 잠시 후 다시 시도해 주세요.'
        );
      }
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || '제출에 실패했어요.');
      setDone(true);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="form-card done">
        <div className="check" aria-hidden="true">✓</div>
        <h3>제출이 완료됐어요</h3>
        <p>
          함께해 주셔서 고맙습니다.
          <br />
          여러분의 한 장이 조례시설 종사자의 처우를 바꾸는 목소리가 됩니다.
        </p>
        <a className="btn btn-ghost" href="/gallery">참여 사진 보러 가기</a>
      </div>
    );
  }

  return (
    <form className="form-card" onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="name">성함</label>
        <input id="name" name="name" type="text" required maxLength={20} placeholder="홍길동" />
      </div>
      <div className="field">
        <label htmlFor="org">소속</label>
        <input id="org" name="org" type="text" required maxLength={40} placeholder="○○종합사회복지관" />
      </div>
      <div className="field">
        <label htmlFor="phone">
          연락처 <span className="opt">(선택 — 이벤트 안내용)</span>
        </label>
        <input id="phone" name="phone" type="tel" inputMode="numeric" maxLength={13} placeholder="010-0000-0000" />
      </div>
      <div className="field">
        <label htmlFor="snsUrl">
          SNS 게시물 링크 <span className="opt">(선택)</span>
        </label>
        <input id="snsUrl" name="snsUrl" type="url" placeholder="https://instagram.com/p/..." />
      </div>

      <div className="field">
        <label>인증사진 (최대 3장)</label>
        <div
          className="dropzone"
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        >
          <div className="icon" aria-hidden="true">📷</div>
          <b>{busy ? '사진 준비 중…' : '사진 선택하기'}</b>
          <span>판넬을 든 인증사진 · 업로드 전 자동으로 용량을 줄입니다</span>
        </div>
        <input
          ref={inputRef}
          type="file"
          name="photos"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => addFiles(e.target.files)}
        />
        {previews.length > 0 && (
          <div className="previews">
            {previews.map((src, i) => (
              <div className="ph" key={i}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`선택한 사진 ${i + 1}`} />
                <button type="button" onClick={() => removeFile(i)} aria-label="사진 삭제">×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <label className="agree">
        <input type="checkbox" required />
        <span>
          제출한 사진과 이름·소속은 캠페인 홍보(협회 SNS·홈페이지·정책자료)에 활용될 수 있으며, 이에
          동의합니다.
        </span>
      </label>

      <button className="btn btn-primary" style={{ width: '100%' }} disabled={sending || busy}>
        {sending ? '제출 중…' : busy ? '사진 준비 중…' : '인증사진 제출하기'}
      </button>
      {err && <p className="form-msg err">{err}</p>}
    </form>
  );
}

export default function Page() {
  return (
    <>
      <div className="topbar">
        <div className="wrap">
          <span className="org">서울특별시사회복지사협회 공정위원회</span>
          <a href="/gallery">참여 사진</a>
        </div>
      </div>

      <header className="hero">
        <div className="wrap">
          <span className="event">
            <span className="dot" aria-hidden="true" />
            2026 서울사회복지사 등반대회 · 현장 이벤트
          </span>
          <h1>
            이슈, 켜다
            <br />
            ISSUE <span className="on">ON</span>
          </h1>
          <p className="sub">
            공정위원회 현안대응 캠페인. 판넬을 들고, 찍고, 올리는 것만으로{' '}
            <strong>조례시설 종사자 처우개선</strong>에 힘이 보태집니다.
          </p>
          <div className="voice-block">
            <h2 className="voice-heading">
              아홉 가지 목소리, <span className="t">하나의 방향</span>
            </h2>
            <p className="voice-lead">현장에 준비된 판넬 9종의 메시지입니다. 어떤 목소리에 함께하시겠어요?</p>
            <VoiceSlider />
          </div>

          <div className="cta">
            <a className="btn btn-primary" href="#submit">인증사진 제출하기</a>
            <a className="btn btn-ghost" href="#why">캠페인 알아보기</a>
          </div>
        </div>
      </header>

      <section className="why" id="why">
        <div className="wrap">
          <h2 className="sec-title">
            왜 <span className="t">조례시설</span>인가요?
          </h2>
          <p className="body">
            서울시 조례에 따라 설치·운영되는 <strong>조례시설</strong>의 사회복지사들은 다른 복지시설과{' '}
            <strong>동일한 사회복지 업무</strong>를 수행하면서도, 처우·경력인정·복리후생에서 다른 기준을
            적용받고 있습니다. 같은 자격으로 같은 시민을 만나는데, 시설의 근거 조례가 다르다는 이유만으로
            대우가 달라져서는 안 됩니다.
          </p>
          <div className="stats">
            <div className="stat"><b>14개</b><span>직능 분야</span></div>
            <div className="stat"><b>155개</b><span>조례시설</span></div>
            <div className="stat"><b>2,365명</b><span>종사자</span></div>
          </div>
          <p className="motto">
            우리의 요구는 하나, <em>“동일 업무, 동일 처우”</em>
          </p>
        </div>
      </section>

      <section className="how">
        <div className="wrap">
          <h2 className="sec-title">
            참여 방법, <span className="t">3분</span>이면 충분해요
          </h2>
          <ol>
            <li>
              <span className="num">1</span>
              <div>
                <b>판넬 들고 촬영</b>
                <p>이벤트 부스에서 마음에 드는 메시지 판넬을 골라 인증사진을 찍어요.</p>
              </div>
            </li>
            <li>
              <span className="num">2</span>
              <div>
                <b>내 SNS에 업로드</b>
                <p>인스타그램·페이스북에 해시태그와 함께 올려 캠페인을 알려요.</p>
              </div>
            </li>
            <li>
              <span className="num">3</span>
              <div>
                <b>이 페이지에 사진 제출</b>
                <p>아래 제출하기에 사진을 올리면 참여 완료! 제출된 사진은 처우개선 활동 자료로 모입니다.</p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section className="submit-sec" id="submit">
        <div className="wrap">
          <h2 className="sec-title">
            인증사진 <span className="t">제출하기</span>
          </h2>
          <p className="sec-lead">제출된 사진은 협회의 처우개선 정책활동 근거자료로 소중히 쓰입니다.</p>
          <UploadForm />
        </div>
      </section>

      <footer>
        <div className="wrap">
          <b>서울특별시사회복지사협회 공정위원회</b>
          <br />
          2026 서울사회복지사 등반대회 · 현안대응 캠페인 ‘이슈온’
          <br />
          문의: 회원조직팀 02-786-2962
          <div className="tags">#서울복지 #공정위원회 #동일업무동일처우</div>
        </div>
      </footer>
    </>
  );
}
