import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-900">
      <div className="w-full max-w-sm">

        {/* Title */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-100">GameRef</h1>
          <p className="mt-2 text-sm text-neutral-400">Reference board for game development</p>
        </div>

        {/* Card */}
        <div className="bg-neutral-800 border border-neutral-700 rounded-xl px-8 py-10 shadow-2xl flex flex-col gap-3">
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/canvas" });
            }}
          >
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 rounded-lg bg-white hover:bg-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-900 transition-colors"
            >
              {/* Google logo */}
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
              </svg>
              Sign in with Google
            </button>
          </form>

          <form
            action={async () => {
              "use server";
              await signIn("discord", { redirectTo: "/canvas" });
            }}
          >
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] px-4 py-3 text-sm font-semibold text-white transition-colors"
            >
              {/* Discord logo */}
              <svg width="20" height="20" viewBox="0 0 127.14 96.36" aria-hidden="true" fill="currentColor">
                <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
              </svg>
              Sign in with Discord
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
