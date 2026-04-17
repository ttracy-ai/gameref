"use client";

// Shared loading screen shown while a canvas fetches data from the DB
// or waits for Liveblocks storage to hydrate.

export default function CanvasLoader({ label }: { label?: string }) {
  return (
    <main
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        background: "#171717",
        userSelect: "none",
      }}
    >
      {/* Spinner */}
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        style={{ animation: "canvas-spin 0.9s linear infinite" }}
      >
        <circle cx="16" cy="16" r="13" stroke="#2a2a2a" strokeWidth="3" />
        <path
          d="M16 3 A13 13 0 0 1 29 16"
          stroke="#525252"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>

      {label && (
        <span style={{ fontSize: 12, color: "#404040", letterSpacing: "0.04em" }}>
          {label}
        </span>
      )}

      <style>{`
        @keyframes canvas-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  );
}
