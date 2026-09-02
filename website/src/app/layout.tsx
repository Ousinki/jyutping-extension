import type { Metadata } from 'next';
import Script from 'next/script';
import { Cinzel, Inter } from 'next/font/google';
import './globals.css';

const cinzel = Cinzel({
  subsets: ['latin'],
  variable: '--font-cinzel',
  weight: ['600', '700', '800'],
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://jyut.hk'),
  title: 'JYUT.HK 粵語學習',
  description: '專業粵語查詞與發音學習門戶。權威收錄 Words.hk (粵典) 與 CC-Canto 詞庫，精選學習導航、九聲六調色彩分拆，支持真人粵語發音與實用拼音工具。',
  keywords: ['JYUT.HK', '粵語學習', 'jyut.hk', '粵語詞典', '粵拼', 'Jyutping', 'Words.hk', '粵典', '粵語發音', '廣東話學習', '學習導航', 'Yale Pinyin'],
  authors: [{ name: 'JYUT.HK Team' }],
  icons: {
    icon: '/logo-flower.svg',
    shortcut: '/logo-flower.svg',
    apple: '/logo-flower.svg',
  },
  openGraph: {
    title: 'JYUT.HK 粵語學習',
    description: '專業粵語查詞與發音學習門戶。權威收錄 Words.hk 粵典，精選學習導航與實用拼音工具。',
    images: ['/promo_marquee.png'],
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-HK" className={`${inter.variable} ${cinzel.variable} scroll-smooth`} suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <Script id="theme-init" strategy="beforeInteractive">
          {`
            try {
              var t = localStorage.getItem('jyutping_website_theme');
              if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark');
              } else {
                document.documentElement.classList.remove('dark');
              }
            } catch (e) {}
          `}
        </Script>
        {children}
      </body>
    </html>
  );
}
