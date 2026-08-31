'use client';

import { useEffect, useRef, useState } from 'react';

const DISTRICTS = [
  '강남구', '강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구',
  '노원구', '도봉구', '동대문구', '동작구', '마포구', '서대문구', '서초구', '성동구',
  '성북구', '송파구', '양천구', '영등포구', '용산구', '은평구', '종로구', '중구', '중랑구',
];

function SignaturePad({ onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#16324a';
  }, []);

  function pos(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e) {
    e.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function move(e) {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (empty) setEmpty(false);
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(empty ? '' : canvasRef.current.toDataURL('image/png'));
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
    onChange('');
  }

  return (
    <div className="sigpad">
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        style={{ touchAction: 'none' }}
      />
      {empty && <span className="sigpad-hint">이곳에 손가락으로 서명해 주세요</span>}
      <button type="button" className="sigpad-clear" onClick={clear}>다시 쓰기</button>
    </div>
  );
}

export default function Sign() {
  const [status, setStatus] = useState(null); // { count, goal }
  const [signature, setSignature] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/sign', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setStatus(j))
      .catch(() => {});
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setErr('');
    if (!signature) {
      setErr('서명란에 서명해 주세요.');
      return;
    }
    const fd = new FormData(e.currentTarget);
    setSending(true);
    try {
      const res = await fetch('/api/sign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: fd.get('name'),
          district: fd.get('district'),
          phone: fd.get('phone'),
          org: fd.get('org'),
          signature,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || '서명에 실패했어요.');
      setDone(true);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setSending(false);
    }
  }

  const pct = status && status.goal ? Math.min(100, Math.round((status.count / status.goal) * 100)) : 0;

  return (
    <>
      <div className="topbar">
        <div className="wrap">
          <span className="org">서울특별시사회복지사협회 공정위원회</span>
          <a href="/">사진 제출</a>
        </div>
      </div>

      <header className="hero" style={{ paddingBottom: 28 }}>
        <div className="wrap">
          <span className="event">
            <span className="dot" aria-hidden="true" />
            서울시의회 전달 서명운동
          </span>
          <h1 style={{ fontSize: 'clamp(32px, 8.6vw, 46px)' }}>
            조례시설 종사자에게
            <br />
            <span className="on">동일한 처우</span>를
          </h1>
          <p className="sub">
            같은 자격으로 같은 시민을 만나는데, 근거 조례가 다르다는 이유로 처우가 달라지고 있습니다.
            여기 모인 서명은 <strong>서울시의회에 전달되는 공식 자료</strong>로 쓰입니다.
          </p>

          {status && (
            <div className="sign-status">
              <div className="sign-num">
                <b>{status.count.toLocaleString()}</b>명이 함께했습니다
              </div>
              <div className="sign-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <i style={{ width: `${pct}%` }} />
              </div>
              <p className="sign-goal">목표 {status.goal.toLocaleString()}명 · {pct}% 달성</p>
            </div>
          )}
        </div>
      </header>

      <section className="submit-sec">
        <div className="wrap">
          <h2 className="sec-title">서명 <span className="t">참여하기</span></h2>
          <p className="sec-lead">서울시민이라면 누구나 참여할 수 있습니다. 한 분당 한 번입니다.</p>

          {done ? (
            <div className="form-card done">
              <div className="check" aria-hidden="true">✓</div>
              <h3>서명이 완료됐습니다</h3>
              <p>
                함께해 주셔서 고맙습니다.
                <br />
                모인 서명은 서울시의회에 전달해 조례 개정을 요구하는 근거로 쓰입니다.
              </p>
              <a className="btn btn-ghost" href="/">인증사진도 제출하기</a>
            </div>
          ) : (
            <form className="form-card" onSubmit={onSubmit}>
              <div className="field">
                <label htmlFor="name">성명</label>
                <input id="name" name="name" type="text" required maxLength={20} placeholder="홍길동" />
              </div>

              <div className="field">
                <label htmlFor="district">거주 자치구</label>
                <select id="district" name="district" required defaultValue="">
                  <option value="" disabled>선택해 주세요</option>
                  {DISTRICTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="phone">연락처</label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  required
                  maxLength={13}
                  placeholder="010-0000-0000"
                />
              </div>

              <div className="field">
                <label htmlFor="org">
                  소속 <span className="opt">(선택)</span>
                </label>
                <input id="org" name="org" type="text" maxLength={40} placeholder="○○종합사회복지관" />
              </div>

              <div className="field">
                <label>자필 서명</label>
                <SignaturePad onChange={setSignature} />
              </div>

              <div className="consent">
                <label className="agree">
                  <input type="checkbox" required />
                  <span>
                    <b>[필수] 개인정보 수집·이용 및 서명 제출에 동의합니다.</b>
                  </span>
                </label>
                <div className="consent-detail">
                  <p><b>수집 항목</b> 성명, 거주 자치구, 연락처, 소속(선택), 자필 서명</p>
                  <p><b>이용 목적</b> 서명 진위 확인, 중복 서명 방지, 서울시의회 제출용 서명부 작성</p>
                  <p><b>제3자 제공</b> 서울특별시의회 (성명·거주 자치구·자필 서명 / 청원·정책건의 자료)</p>
                  <p><b>보유 기간</b> 서명부 제출 및 관련 활동 종료 후 1년까지 (이후 지체 없이 파기)</p>
                  <p>
                    수집된 개인정보는 위 목적 외로 사용되지 않으며, 자필 서명 이미지는 외부에
                    공개되지 않습니다. 동의를 거부하실 수 있으나 거부 시 서명 참여가 제한됩니다.
                  </p>
                </div>
              </div>

              <button className="btn btn-primary" style={{ width: '100%' }} disabled={sending}>
                {sending ? '서명 중…' : '서명하기'}
              </button>
              {err && <p className="form-msg err">{err}</p>}
            </form>
          )}
        </div>
      </section>

      <footer>
        <div className="wrap">
          <b>서울특별시사회복지사협회 공정위원회</b>
          <br />
          2026 서울사회복지사 등반대회 · 현안대응 캠페인 ‘이슈온’
          <ul className="tags">
            <li>#서사협_공정위원회</li>
            <li>#동일한복지업무동일한경력인정</li>
            <li>#경력은온전히</li>
            <li>#복리후생은차별없이</li>
            <li>#지속가능한서울복지</li>
          </ul>
        </div>
      </footer>
    </>
  );
}
