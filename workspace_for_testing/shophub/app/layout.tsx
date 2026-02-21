import type { Metadata } from 'next';
import { Rubik, Nunito_Sans } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Providers } from './providers';

const rubik = Rubik({
  subsets: ['latin'],
  variable: '--font-heading',
  weight: ['300', '400', '500', '600', '700'],
});

const nunitoSans = Nunito_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['300', '400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'ShopHub - Your Premium E-Commerce Store',
  description: 'Shop premium products at amazing prices',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${rubik.variable} ${nunitoSans.variable} font-body antialiased`}>
        <Providers>
          <div className="min-h-screen bg-background">
            <Navbar />
            <main className="pt-24">{children}</main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
