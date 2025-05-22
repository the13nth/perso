import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <main className="flex flex-col items-center justify-center w-full flex-1 px-20 text-center">
        <h1 className="text-6xl font-bold">
          404 - Page Not Found
        </h1>
        <p className="mt-3 text-2xl">
          The page you were looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Link 
            href="/"
            className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors"
          >
            Go Home
          </Link>
        </div>
      </main>
    </div>
  );
} 