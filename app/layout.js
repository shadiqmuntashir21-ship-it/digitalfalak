import "./globals.css";

export const metadata = {
  title: "Digital Falak — Hisab Berbasis Koordinat",
  description: "Laboratorium ilmu falak digital: waktu salat, kiblat, Matahari, kalender, dan modul hisab berbasis koordinat.",
  applicationName: "Digital Falak",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Digital Falak",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport = {
  themeColor: "#071a2d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
