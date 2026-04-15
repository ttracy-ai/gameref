"use client";

import { useState, useEffect } from "react";
import { Loader2, X, UserPlus, Crown, User, Link, RefreshCw, Copy, Check } from "lucide-react";

type Member = {
  id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  image: string | null;
  role: string;
  joinedAt: string;
};

type Invitation = {
  id: string;
  email: string;
  createdAt: string;
};

type TeamData = {
  members: Member[];
  invitations: Invitation[];
  currentUserRole: string;
};

function displayName(member: Pick<Member, "username" | "name" | "email">) {
  return member.username ?? member.name ?? member.email ?? "Unknown";
}

function Avatar({ name, username, image }: { name: string | null; username: string | null; image: string | null }) {
  if (image) {
    return (
      <img
        src={image}
        alt={username ?? name ?? ""}
        className="w-8 h-8 rounded-full object-cover shrink-0"
      />
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center shrink-0">
      <User size={16} className="text-neutral-500" />
    </div>
  );
}

export default function TeamCanvas({ projectId }: { projectId: string }) {
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteInput, setInviteInput] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  // Invite link state
  const [inviteToken, setInviteToken] = useState<string | null | undefined>(undefined); // undefined = not loaded
  const [linkGenerating, setLinkGenerating] = useState(false);
  const [linkRevoking, setLinkRevoking] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/projects/${projectId}/members`).then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      }),
      fetch(`/api/projects/${projectId}/invite-link`).then((r) => r.ok ? r.json() : { token: null }),
    ])
      .then(([teamData, linkData]) => {
        setData(teamData);
        setInviteToken(linkData.token ?? null);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [projectId]);

  async function generateLink() {
    setLinkGenerating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/invite-link`, { method: "POST" });
      const json = await res.json();
      if (json.token) setInviteToken(json.token);
    } finally {
      setLinkGenerating(false);
    }
  }

  async function revokeLink() {
    setLinkRevoking(true);
    try {
      await fetch(`/api/projects/${projectId}/invite-link`, { method: "DELETE" });
      setInviteToken(null);
    } finally {
      setLinkRevoking(false);
    }
  }

  function copyLink() {
    if (!inviteToken) return;
    const url = `${window.location.origin}/invite/${inviteToken}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function invite() {
    const email = inviteInput.trim();
    if (!email) return;
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) {
        setInviteError(json.error ?? "Something went wrong.");
      } else if (json.pending) {
        setInviteSuccess(`Invitation sent to ${email}. They'll be added when they sign in.`);
        setData((prev) =>
          prev
            ? {
                ...prev,
                invitations: [
                  ...prev.invitations,
                  { id: `pending-${email}`, email, createdAt: new Date().toISOString() },
                ],
              }
            : prev
        );
        setInviteInput("");
      } else {
        setInviteSuccess(`${email} has been added to the project.`);
        setInviteInput("");
        const refreshed = await fetch(`/api/projects/${projectId}/members`).then((r) => r.json());
        setData(refreshed);
      }
    } catch {
      setInviteError("Failed to send invitation. Please try again.");
    } finally {
      setInviting(false);
    }
  }

  async function removeMember(userId: string) {
    try {
      await fetch(`/api/projects/${projectId}/members/${userId}`, { method: "DELETE" });
      setData((prev) =>
        prev ? { ...prev, members: prev.members.filter((m) => m.id !== userId) } : prev
      );
    } catch {
      // silently fail
    }
  }

  async function cancelInvitation(invitationId: string) {
    try {
      await fetch(`/api/projects/${projectId}/invitations/${invitationId}`, { method: "DELETE" });
      setData((prev) =>
        prev ? { ...prev, invitations: prev.invitations.filter((i) => i.id !== invitationId) } : prev
      );
    } catch {
      // silently fail
    }
  }

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center bg-neutral-900">
        <Loader2 size={20} className="text-neutral-600 animate-spin" />
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex-1 flex items-center justify-center bg-neutral-900">
        <p className="text-neutral-600 text-sm">Failed to load team data.</p>
      </main>
    );
  }

  const isOwner = data.currentUserRole === "owner";

  return (
    <main className="flex-1 flex flex-col h-full overflow-hidden bg-neutral-900">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto py-10 px-6">

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-neutral-200 text-xl font-semibold">Team / Credits</h1>
            <p className="text-neutral-500 text-sm mt-1">
              Manage who has access to this project.
            </p>
          </div>

          {/* Members list */}
          <div className="bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden mb-4">
            <div className="px-5 py-2.5 border-b border-neutral-700">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                Members ({data.members.length})
              </span>
            </div>
            <div className="divide-y divide-neutral-700/50">
              {data.members.map((member) => (
                <div key={member.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar name={member.name} username={member.username} image={member.image} />
                  <div className="flex-1 min-w-0">
                    <p className="text-neutral-200 text-sm font-medium truncate">
                      {displayName(member)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {member.role === "owner" ? (
                      <span className="flex items-center gap-1 text-xs text-amber-500">
                        <Crown size={12} />
                        Owner
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-neutral-500">
                        <User size={12} />
                        Member
                      </span>
                    )}
                    {isOwner && member.role !== "owner" && (
                      <button
                        onClick={() => removeMember(member.id)}
                        className="text-neutral-600 hover:text-red-400 transition-colors ml-2"
                        title="Remove member"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pending invitations */}
          {data.invitations.length > 0 && (
            <div className="bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden mb-4">
              <div className="px-5 py-2.5 border-b border-neutral-700">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Pending Invitations ({data.invitations.length})
                </span>
              </div>
              <div className="divide-y divide-neutral-700/50">
                {data.invitations.map((inv) => (
                  <div key={inv.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center shrink-0">
                      <UserPlus size={14} className="text-neutral-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-neutral-400 text-sm truncate">{inv.email}</p>
                      <p className="text-neutral-600 text-xs">Awaiting sign-in</p>
                    </div>
                    {isOwner && (
                      <button
                        onClick={() => cancelInvitation(inv.id)}
                        className="text-neutral-600 hover:text-red-400 transition-colors"
                        title="Cancel invitation"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invite form — owner only */}
          {isOwner && (
            <>
              <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-5 mb-4">
                <h2 className="text-neutral-300 text-sm font-semibold mb-1 flex items-center gap-2">
                  <UserPlus size={15} />
                  Invite by email or username
                </h2>
                <p className="text-neutral-600 text-xs mb-3">
                  Enter an email address or a <span className="text-neutral-500">@username</span> (for users already signed in)
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inviteInput}
                    onChange={(e) => { setInviteInput(e.target.value); setInviteError(null); setInviteSuccess(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") invite(); }}
                    placeholder="teammate@example.com or @username"
                    className="flex-1 bg-neutral-900 border border-neutral-600 rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 outline-none focus:border-neutral-400 transition-colors"
                  />
                  <button
                    onClick={invite}
                    disabled={!inviteInput.trim() || inviting}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
                  >
                    {inviting ? "Sending…" : "Invite"}
                  </button>
                </div>
                {inviteError && <p className="mt-2 text-xs text-red-400">{inviteError}</p>}
                {inviteSuccess && <p className="mt-2 text-xs text-emerald-400">{inviteSuccess}</p>}
              </div>

              {/* Invite link */}
              <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-5">
                <h2 className="text-neutral-300 text-sm font-semibold mb-1 flex items-center gap-2">
                  <Link size={15} />
                  Invite link
                </h2>
                <p className="text-neutral-600 text-xs mb-3">
                  Share this link anywhere — Discord, email, wherever. Anyone who clicks it and signs in will join the project.
                </p>

                {inviteToken === undefined ? (
                  <div className="flex items-center gap-2 text-neutral-600 text-xs">
                    <Loader2 size={12} className="animate-spin" /> Loading…
                  </div>
                ) : inviteToken ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <div className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-400 font-mono truncate">
                        {typeof window !== "undefined" ? `${window.location.origin}/invite/${inviteToken}` : `/invite/${inviteToken}`}
                      </div>
                      <button
                        onClick={copyLink}
                        className="px-3 py-2 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-neutral-300 transition-colors shrink-0"
                        title="Copy link"
                      >
                        {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      </button>
                      <button
                        onClick={revokeLink}
                        disabled={linkRevoking}
                        className="px-3 py-2 rounded-lg bg-neutral-700 hover:bg-red-900/50 hover:text-red-400 text-neutral-400 transition-colors shrink-0 disabled:opacity-40"
                        title="Revoke link"
                      >
                        {linkRevoking ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                      </button>
                    </div>
                    <p className="text-neutral-700 text-xs">Revoking the link stops any future joins — existing members are unaffected.</p>
                  </div>
                ) : (
                  <button
                    onClick={generateLink}
                    disabled={linkGenerating}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-700 hover:bg-neutral-600 disabled:opacity-40 text-neutral-300 text-sm font-medium transition-colors"
                  >
                    {linkGenerating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    Generate invite link
                  </button>
                )}
              </div>
            </>
          )}

        </div>
      </div>
    </main>
  );
}
