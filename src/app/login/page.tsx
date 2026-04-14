import { signIn } from "@/auth";

const LOGO = "data:image/png;base64,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";

export default function LoginPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "radial-gradient(ellipse at 50% -20%, #1c2a0e 0%, #0d1208 50%, #080c06 100%)" }}
    >
      {/* Grid overlay */}
      <div
        className="pointer-events-none fixed inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(132,204,22,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(132,204,22,0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Vignette */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)" }}
      />

      <div className="relative w-full max-w-sm">

        {/* Top accent line */}
        <div
          className="absolute top-0 inset-x-8 h-px rounded-full"
          style={{ background: "linear-gradient(90deg, transparent, rgba(132,204,22,0.8), transparent)" }}
        />

        {/* Card */}
        <div
          className="relative rounded-2xl px-8 pt-10 pb-8"
          style={{
            background: "linear-gradient(160deg, rgba(20,28,12,0.95) 0%, rgba(12,18,8,0.98) 100%)",
            border: "1px solid rgba(132,204,22,0.12)",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.5), 0 32px 64px rgba(0,0,0,0.6), 0 0 80px rgba(132,204,22,0.05)",
          }}
        >
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div
              className="mb-5 p-3.5 rounded-xl"
              style={{
                background: "rgba(132,204,22,0.07)",
                border: "1px solid rgba(132,204,22,0.18)",
                boxShadow: "0 0 20px rgba(132,204,22,0.12), inset 0 1px 0 rgba(132,204,22,0.1)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={LOGO} alt="Plan A Project" className="w-12 h-12 object-contain" />
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-100">
              Plan A Project
            </h1>
            <p
              className="mt-0.5 text-xs font-semibold tracking-[0.2em] uppercase"
              style={{ color: "rgba(132,204,22,0.65)" }}
            >
              planaproject.io
            </p>
            <p className="mt-2.5 text-xs text-slate-600 text-center leading-relaxed">
              Game development, organized.
            </p>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.05)" }} />
            <span className="text-[10px] text-slate-700 uppercase tracking-[0.15em]">continue with</span>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.05)" }} />
          </div>

          {/* Sign-in buttons */}
          <div className="flex flex-col gap-2.5">

            {/* Google */}
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/canvas" });
              }}
            >
              <button
                type="submit"
                className="w-full group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-300 transition-all duration-200"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget;
                  el.style.background = "rgba(132,204,22,0.06)";
                  el.style.borderColor = "rgba(132,204,22,0.2)";
                  el.style.color = "#e2e8d0";
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget;
                  el.style.background = "rgba(255,255,255,0.03)";
                  el.style.borderColor = "rgba(255,255,255,0.07)";
                  el.style.color = "";
                }}
              >
                <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true" className="shrink-0">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
                </svg>
                <span className="flex-1 text-left">Google</span>
                <span className="text-slate-700 text-xs">→</span>
              </button>
            </form>

            {/* Discord */}
            <form
              action={async () => {
                "use server";
                await signIn("discord", { redirectTo: "/canvas" });
              }}
            >
              <button
                type="submit"
                className="w-full group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-300 transition-all duration-200"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget;
                  el.style.background = "rgba(132,204,22,0.06)";
                  el.style.borderColor = "rgba(132,204,22,0.2)";
                  el.style.color = "#e2e8d0";
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget;
                  el.style.background = "rgba(255,255,255,0.03)";
                  el.style.borderColor = "rgba(255,255,255,0.07)";
                  el.style.color = "";
                }}
              >
                <svg width="17" height="17" viewBox="0 0 127.14 96.36" aria-hidden="true" fill="#5865F2" className="shrink-0">
                  <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
                </svg>
                <span className="flex-1 text-left">Discord</span>
                <span className="text-slate-700 text-xs">→</span>
              </button>
            </form>

          </div>

          <p className="mt-6 text-center text-[11px] text-slate-700">
            By signing in you agree to our terms of service.
          </p>
        </div>

        {/* Bottom glow */}
        <div
          className="absolute -bottom-px inset-x-12 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(132,204,22,0.3), transparent)" }}
        />

      </div>
    </div>
  );
}
