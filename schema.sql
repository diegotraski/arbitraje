import "./globals.css";

export const metadata = {
  title: "Surebet Finder",
  description: "Detector de arbitraje deportivo entre casas de apuestas",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-surebet-dark text-white min-h-screen">
        {children}
      </body>
    </html>
  );
}
