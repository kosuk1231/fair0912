import './globals.css';

export const metadata = {
  title: '이슈온 ISSUE ON — 2026 서울사회복지사 등반대회',
  description:
    '서울특별시사회복지사협회 공정위원회 현안대응 캠페인. 조례시설 종사자의 동일한 업무에 동일한 처우를. 판넬 인증사진을 제출해 주세요.',
  openGraph: {
    title: '이슈온 ISSUE ON — 인증사진 제출',
    description: '동일한 복지업무, 동일한 처우. 판넬 인증사진으로 함께해 주세요.',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
