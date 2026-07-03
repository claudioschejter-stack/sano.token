import Link from 'next/link';
import { ForgotPasswordForm } from '../../../../components/auth/ForgotPasswordForm';
import { LandingHeader } from '../../../../components/landing/LandingHeader';

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <LandingHeader />

      <main className="mx-auto w-full max-w-lg px-4 py-12 md:py-16">
        <article className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Recuperar contraseña</h1>
          <div className="mt-6">
            <ForgotPasswordForm />
          </div>
        </article>

        <p className="mt-8 text-center text-sm text-slate-500">
          <Link href="/acceso" className="font-medium text-blue-600 hover:text-blue-500">
            ← Volver a acceso
          </Link>
        </p>
      </main>
    </div>
  );
}
