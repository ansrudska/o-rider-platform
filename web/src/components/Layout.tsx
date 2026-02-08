import { Outlet, Link } from "react-router-dom";

export default function Layout() {
  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-200">
        <nav className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-6">
          <Link to="/" className="text-xl font-bold text-orange-600">
            O-Rider
          </Link>
          <div className="flex gap-4 text-sm text-gray-600">
            <Link to="/" className="hover:text-gray-900">
              홈
            </Link>
          </div>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
