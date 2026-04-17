import "./globals.css";

export const metadata = {
  title: "Whispr",
  description: "Zero-trust encrypted chat MVP",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
