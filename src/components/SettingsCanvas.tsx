"use client";

import { useState, useEffect } from "react";
import { Loader2, Pencil, Check, X } from "lucide-react";

type Profile = {
  username: string | null;
  name: string | null;
  email: string | null;
  image: string | null;
};

export default function SettingsCanvas() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/user/profile")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d) => setProfile(d))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, []);

  function startEditing() {
    setUsernameInput(profile?.username ?? "");
    setUsernameError(null);
    setEditingUsername(true);
  }

  async function saveUsername() {
    const trimmed = usernameInput.trim();
    if (!trimmed) return;
    setUsernameSaving(true);
    setUsernameError(null);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmed }),
      });
      const json = await res.json();
      if (!res.ok) {
        setUsernameError(json.error ?? "Failed to save.");
      } else {
        setProfile((prev) => prev ? { ...prev, username: json.username } : prev);
        setEditingUsername(false);
      }
    } catch {
      setUsernameError("Failed to save. Please try again.");
    } finally {
      setUsernameSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center bg-neutral-900">
        <Loader2 size={20} className="text-neutral-600 animate-spin" />
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col h-full overflow-hidden bg-neutral-900">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto py-10 px-6">

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-neutral-200 text-xl font-semibold">Settings</h1>
            <p className="text-neutral-500 text-sm mt-1">Manage your account preferences.</p>
          </div>

          {/* Profile section */}
          <div className="bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden mb-4">
            <div className="px-5 py-2.5 border-b border-neutral-700">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Profile</span>
            </div>

            {profile ? (
              <div className="divide-y divide-neutral-700/50">

                {/* Email — read only */}
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="w-32 shrink-0">
                    <p className="text-xs text-neutral-500">Email</p>
                  </div>
                  <p className="text-sm text-neutral-400">{profile.email ?? "—"}</p>
                </div>

                {/* Username */}
                <div className="flex items-start gap-4 px-5 py-4">
                  <div className="w-32 shrink-0 pt-0.5">
                    <p className="text-xs text-neutral-500">Username</p>
                  </div>
                  <div className="flex-1">
                    {editingUsername ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={usernameInput}
                          onChange={(e) => { setUsernameInput(e.target.value); setUsernameError(null); }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveUsername();
                            if (e.key === "Escape") setEditingUsername(false);
                          }}
                          placeholder="your_username"
                          autoFocus
                          className="flex-1 bg-neutral-900 border border-neutral-600 rounded-lg px-3 py-1.5 text-sm text-neutral-200 placeholder:text-neutral-600 outline-none focus:border-neutral-400 transition-colors"
                        />
                        <button
                          onClick={saveUsername}
                          disabled={!usernameInput.trim() || usernameSaving}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
                        >
                          {usernameSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        </button>
                        <button
                          onClick={() => setEditingUsername(false)}
                          className="px-3 py-1.5 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-neutral-300 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-neutral-200">
                          {profile.username
                            ? `@${profile.username}`
                            : <span className="text-neutral-500 font-sans italic">Not set</span>}
                        </span>
                        <button
                          onClick={startEditing}
                          className="text-neutral-600 hover:text-neutral-300 transition-colors"
                          title="Edit username"
                        >
                          <Pencil size={13} />
                        </button>
                      </div>
                    )}
                    {usernameError && <p className="mt-1.5 text-xs text-red-400">{usernameError}</p>}
                    <p className="mt-1.5 text-xs text-neutral-600">
                      Shown to teammates instead of your full name · letters, numbers, _, ., - · 2–32 chars
                    </p>
                  </div>
                </div>

              </div>
            ) : (
              <p className="px-5 py-4 text-sm text-neutral-600">Failed to load profile.</p>
            )}
          </div>

        </div>
      </div>
    </main>
  );
}
