"use client";

import { useState, useEffect } from "react";
import { Loader2, X, UserPlus, Crown, User } from "lucide-react";

type Member = {
  id: string;
  name: string | null;
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

function Avatar({ name, image }: { name: string | null; image: string | null }) {
  if (image) {
    return (
      <img
        src={image}
        alt={name ?? ""}
        className="w-8 h-8 rounded-full object-cover shrink-0"
      />
    );
  }
  const initials = (name ?? "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center text-xs font-semibold text-neutral-300 shrink-0">
      {initials}
    </div>
  );
}

export default function TeamCanvas({ projectId }: { projectId: string }) {
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/projects/${projectId}/members`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [projectId]);

  async function invite() {
    const email = inviteEmail.trim().toLowerCase();
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
        setInviteEmail("");
      } else {
        setInviteSuccess(`${email} has been added to the project.`);
        setInviteEmail("");
        // Refresh member list
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

          {/* Invite form — owner only */}
          {isOwner && (
            <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-5 mb-6">
              <h2 className="text-neutral-300 text-sm font-semibold mb-3 flex items-center gap-2">
                <UserPlus size={15} />
                Invite by email
              </h2>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => { setInviteEmail(e.target.value); setInviteError(null); setInviteSuccess(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter") invite(); }}
                  placeholder="teammate@example.com"
                  className="flex-1 bg-neutral-900 border border-neutral-600 rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 outline-none focus:border-neutral-400 transition-colors"
                />
                <button
                  onClick={invite}
                  disabled={!inviteEmail.trim() || inviting}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
                >
                  {inviting ? "Sending…" : "Invite"}
                </button>
              </div>
              {inviteError && <p className="mt-2 text-xs text-red-400">{inviteError}</p>}
              {inviteSuccess && <p className="mt-2 text-xs text-emerald-400">{inviteSuccess}</p>}
            </div>
          )}

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
                  <Avatar name={member.name} image={member.image} />
                  <div className="flex-1 min-w-0">
                    <p className="text-neutral-200 text-sm font-medium truncate">
                      {member.name ?? member.email}
                    </p>
                    {member.name && (
                      <p className="text-neutral-500 text-xs truncate">{member.email}</p>
                    )}
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
            <div className="bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden">
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

        </div>
      </div>
    </main>
  );
}
