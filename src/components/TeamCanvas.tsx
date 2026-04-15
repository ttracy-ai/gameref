"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Loader2, X, UserPlus, Crown, User, Shield, Link,
  RefreshCw, Copy, Check, Briefcase, Plus, ChevronDown,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Role = "team_leader" | "moderator" | "member";

type Member = {
  id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  image: string | null;
  role: Role;
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
  currentUserRole: Role;
};

type RoleUser = {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
};

type ProjectRole = {
  id: string;
  name: string;
  description: string | null;
  user: RoleUser | null;
};

// ── Preset roles & colors ──────────────────────────────────────────────────────

const PRESET_ROLES = [
  "Programmer",
  "Lead Programmer",
  "Gameplay Programmer",
  "2D Artist",
  "3D Artist",
  "Character Artist",
  "Concept Artist",
  "Animator",
  "VFX Artist",
  "UI / UX Designer",
  "Composer / Musician",
  "Sound Designer",
  "Game Designer",
  "Lead Designer",
  "Level Designer",
  "Narrative Designer",
  "Writer",
  "Project Manager",
  "QA Tester",
  "Voice Actor",
  "Custom…",
] as const;

type RoleColor = { accent: string; bg: string; text: string };

const ROLE_COLOR_MAP: Record<string, RoleColor> = {
  // Programming — blue
  "Programmer":           { accent: "#1d4ed8", bg: "#dbeafe", text: "#1e3a8a" },
  "Lead Programmer":      { accent: "#1e40af", bg: "#bfdbfe", text: "#1e3a8a" },
  "Gameplay Programmer":  { accent: "#2563eb", bg: "#eff6ff", text: "#1e40af" },
  // Art — violet/purple
  "2D Artist":            { accent: "#6d28d9", bg: "#ede9fe", text: "#4c1d95" },
  "3D Artist":            { accent: "#5b21b6", bg: "#ddd6fe", text: "#3b0764" },
  "Character Artist":     { accent: "#7c3aed", bg: "#f5f3ff", text: "#4c1d95" },
  "Concept Artist":       { accent: "#8b5cf6", bg: "#f5f3ff", text: "#5b21b6" },
  "Animator":             { accent: "#7e22ce", bg: "#f3e8ff", text: "#581c87" },
  "VFX Artist":           { accent: "#6b21a8", bg: "#f3e8ff", text: "#581c87" },
  // UI/UX — pink
  "UI / UX Designer":     { accent: "#be185d", bg: "#fce7f3", text: "#831843" },
  // Audio — amber
  "Composer / Musician":  { accent: "#b45309", bg: "#fef3c7", text: "#78350f" },
  "Sound Designer":       { accent: "#92400e", bg: "#fde68a", text: "#451a03" },
  // Design — emerald
  "Game Designer":        { accent: "#047857", bg: "#d1fae5", text: "#064e3b" },
  "Lead Designer":        { accent: "#065f46", bg: "#a7f3d0", text: "#022c22" },
  "Level Designer":       { accent: "#059669", bg: "#ecfdf5", text: "#065f46" },
  // Narrative/Writing — teal/sky
  "Narrative Designer":   { accent: "#0f766e", bg: "#ccfbf1", text: "#134e4a" },
  "Writer":               { accent: "#0369a1", bg: "#e0f2fe", text: "#0c4a6e" },
  // Production — orange
  "Project Manager":      { accent: "#c2410c", bg: "#ffedd5", text: "#7c2d12" },
  // QA — red
  "QA Tester":            { accent: "#b91c1c", bg: "#fee2e2", text: "#7f1d1d" },
  // Voice — lime
  "Voice Actor":          { accent: "#4d7c0f", bg: "#ecfccb", text: "#365314" },
};

const GRAY_COLOR: RoleColor = { accent: "#4b5563", bg: "#f3f4f6", text: "#1f2937" };

function getRoleColor(name: string): RoleColor {
  return ROLE_COLOR_MAP[name] ?? GRAY_COLOR;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function displayName(member: Pick<Member, "username" | "name" | "email">) {
  return member.username ?? member.name ?? member.email ?? "Unknown";
}

function roleDisplayName(u: Pick<RoleUser, "username" | "name">) {
  return u.username ?? u.name ?? "Unknown";
}

function Avatar({
  name,
  username,
  image,
  size = 8,
}: {
  name: string | null;
  username: string | null;
  image: string | null;
  size?: number;
}) {
  const cls = `w-${size} h-${size} rounded-full shrink-0`;
  if (image) {
    return (
      <img
        src={image}
        alt={username ?? name ?? ""}
        className={`${cls} object-cover`}
      />
    );
  }
  return (
    <div className={`${cls} bg-neutral-700 flex items-center justify-center`}>
      <User size={size * 2} className="text-neutral-500" />
    </div>
  );
}

function RoleBadge({ role }: { role: Role }) {
  if (role === "team_leader") {
    return (
      <span className="flex items-center gap-1 text-xs text-amber-500">
        <Crown size={12} /> Team Leader
      </span>
    );
  }
  if (role === "moderator") {
    return (
      <span className="flex items-center gap-1 text-xs text-indigo-400">
        <Shield size={12} /> Moderator
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-neutral-500">
      <User size={12} /> Member
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TeamCanvas({ projectId }: { projectId: string }) {
  const [data, setData] = useState<TeamData | null>(null);
  const [roles, setRoles] = useState<ProjectRole[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite state
  const [inviteInput, setInviteInput] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  // Invite link state
  const [inviteToken, setInviteToken] = useState<string | null | undefined>(undefined);
  const [linkGenerating, setLinkGenerating] = useState(false);
  const [linkRevoking, setLinkRevoking] = useState(false);
  const [copied, setCopied] = useState(false);

  // Member role change
  const [changingRole, setChangingRole] = useState<Record<string, boolean>>({});

  // Role management
  const [addingRole, setAddingRole] = useState(false);
  const [newRolePreset, setNewRolePreset] = useState<string>(PRESET_ROLES[0]);
  const [newRoleCustom, setNewRoleCustom] = useState("");
  const [newRoleUserId, setNewRoleUserId] = useState("");
  const [savingRole, setSavingRole] = useState(false);
  const [assigningRoleId, setAssigningRoleId] = useState<string | null>(null);
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);
  const customInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/projects/${projectId}/members`).then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      }),
      fetch(`/api/projects/${projectId}/invite-link`).then((r) =>
        r.ok ? r.json() : { token: null }
      ),
      fetch(`/api/projects/${projectId}/roles`).then((r) =>
        r.ok ? r.json() : { roles: [] }
      ),
    ])
      .then(([teamData, linkData, rolesData]) => {
        setData(teamData);
        setInviteToken(linkData.token ?? null);
        setRoles(rolesData.roles ?? []);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [projectId]);

  // ── Invite link ─────────────────────────────────────────────────────────────

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

  // ── Invite member ──────────────────────────────────────────────────────────

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
        prev
          ? { ...prev, invitations: prev.invitations.filter((i) => i.id !== invitationId) }
          : prev
      );
    } catch {
      // silently fail
    }
  }

  async function changeRole(userId: string, role: Role) {
    setChangingRole((prev) => ({ ...prev, [userId]: true }));
    try {
      const res = await fetch(`/api/projects/${projectId}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        setData((prev) =>
          prev
            ? { ...prev, members: prev.members.map((m) => (m.id === userId ? { ...m, role } : m)) }
            : prev
        );
      }
    } finally {
      setChangingRole((prev) => ({ ...prev, [userId]: false }));
    }
  }

  // ── Role management ────────────────────────────────────────────────────────

  const isCustomPreset = newRolePreset === "Custom…";
  const newRoleName = isCustomPreset ? newRoleCustom.trim() : newRolePreset;

  useEffect(() => {
    if (isCustomPreset) customInputRef.current?.focus();
  }, [isCustomPreset]);

  async function addRole() {
    if (!newRoleName) return;
    setSavingRole(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRoleName,
          userId: newRoleUserId || null,
        }),
      });
      if (res.ok) {
        const created: ProjectRole = await res.json();
        setRoles((prev) => [...prev, created]);
        setAddingRole(false);
        setNewRolePreset(PRESET_ROLES[0]);
        setNewRoleCustom("");
        setNewRoleUserId("");
      }
    } finally {
      setSavingRole(false);
    }
  }

  async function assignRole(roleId: string, userId: string | null) {
    setAssigningRoleId(roleId);
    try {
      const res = await fetch(`/api/projects/${projectId}/roles/${roleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        const updated: ProjectRole = await res.json();
        setRoles((prev) => prev.map((r) => (r.id === roleId ? updated : r)));
      }
    } finally {
      setAssigningRoleId(null);
    }
  }

  async function deleteRole(roleId: string) {
    setDeletingRoleId(roleId);
    try {
      await fetch(`/api/projects/${projectId}/roles/${roleId}`, { method: "DELETE" });
      setRoles((prev) => prev.filter((r) => r.id !== roleId));
    } finally {
      setDeletingRoleId(null);
    }
  }

  // ── Derived color map (must be before early returns — Rules of Hooks) ────────

  const memberColorMap = useMemo<Record<string, RoleColor | null>>(() => {
    const roleNames: Record<string, string[]> = {};
    for (const r of roles) {
      if (r.user) {
        if (!roleNames[r.user.id]) roleNames[r.user.id] = [];
        roleNames[r.user.id].push(r.name);
      }
    }
    const result: Record<string, RoleColor | null> = {};
    for (const [userId, names] of Object.entries(roleNames)) {
      result[userId] = names.length === 1 ? getRoleColor(names[0]) : GRAY_COLOR;
    }
    return result;
  }, [roles]);

  // ── Render ─────────────────────────────────────────────────────────────────

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

  const isTeamLeader = data.currentUserRole === "team_leader";
  const canInvite = isTeamLeader || data.currentUserRole === "moderator";

  const filledRoles = roles.filter((r) => r.user !== null);
  const openRoles = roles.filter((r) => r.user === null);

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

          {/* ── Members ── */}
          <div className="bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden mb-4">
            <div className="px-5 py-2.5 border-b border-neutral-700">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                Members ({data.members.length})
              </span>
            </div>
            <div className="divide-y divide-neutral-700/50">
              {data.members.map((member) => {
                const saving = changingRole[member.id];
                const memberColor = memberColorMap[member.id] ?? null;
                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 px-5 py-3 transition-colors"
                    style={memberColor ? { background: memberColor.bg } : undefined}
                  >
                    <Avatar name={member.name} username={member.username} image={member.image} />
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: memberColor ? memberColor.text : undefined }}
                      >
                        {displayName(member)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isTeamLeader && member.role !== "team_leader" ? (
                        <div className="relative flex items-center">
                          {saving && (
                            <Loader2 size={12} className="text-neutral-500 animate-spin mr-1.5" />
                          )}
                          <select
                            value={member.role}
                            disabled={saving}
                            onChange={(e) => changeRole(member.id, e.target.value as Role)}
                            className="text-xs bg-neutral-700 border border-neutral-600 text-neutral-300 rounded-md pl-2 pr-6 py-1 outline-none focus:border-neutral-400 cursor-pointer appearance-none disabled:opacity-50"
                          >
                            <option value="team_leader">Team Leader</option>
                            <option value="moderator">Moderator</option>
                            <option value="member">Member</option>
                          </select>
                        </div>
                      ) : (
                        <RoleBadge role={member.role} />
                      )}
                      {isTeamLeader && member.role !== "team_leader" && (
                        <button
                          onClick={() => removeMember(member.id)}
                          className="text-neutral-600 hover:text-red-400 transition-colors ml-1"
                          title="Remove member"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Roles ── */}
          <div className="bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden mb-4">
            <div className="px-5 py-2.5 border-b border-neutral-700 flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                Roles
                {roles.length > 0 && (
                  <span className="ml-1.5 text-neutral-600">
                    ({filledRoles.length} filled
                    {openRoles.length > 0 && `, ${openRoles.length} open`})
                  </span>
                )}
              </span>
              {canInvite && !addingRole && (
                <button
                  onClick={() => setAddingRole(true)}
                  className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  <Plus size={12} /> Add role
                </button>
              )}
            </div>

            {roles.length === 0 && !addingRole ? (
              <div className="px-5 py-6 text-center">
                <Briefcase size={20} className="text-neutral-700 mx-auto mb-2" />
                <p className="text-neutral-600 text-sm">No roles defined yet.</p>
                {canInvite && (
                  <p className="text-neutral-700 text-xs mt-1">
                    Add roles to give team members credit and advertise open positions.
                  </p>
                )}
              </div>
            ) : (
              <div className="divide-y divide-neutral-700/50">

                {/* Filled roles */}
                {filledRoles.map((role) => {
                  const color = getRoleColor(role.name);
                  return (
                  <div
                    key={role.id}
                    className="flex items-center gap-3 py-3 pr-5"
                    style={{ background: color.bg, borderLeft: `3px solid ${color.accent}`, paddingLeft: "calc(1.25rem - 3px)" }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: color.text }}>{role.name}</p>
                    </div>
                    {role.user && (
                      <div className="flex items-center gap-2 shrink-0">
                        <Avatar
                          name={role.user.name}
                          username={role.user.username}
                          image={role.user.image}
                          size={6}
                        />
                        <span className="text-xs font-medium truncate max-w-[120px]" style={{ color: color.text, opacity: 0.75 }}>
                          {roleDisplayName(role.user)}
                        </span>
                      </div>
                    )}
                    {canInvite && (
                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        {/* Reassign dropdown */}
                        <div className="relative">
                          <select
                            value={role.user?.id ?? ""}
                            disabled={assigningRoleId === role.id}
                            onChange={(e) => assignRole(role.id, e.target.value || null)}
                            className="text-xs bg-neutral-700 border border-neutral-600 text-neutral-400 rounded-md pl-2 pr-5 py-0.5 outline-none focus:border-neutral-400 cursor-pointer appearance-none disabled:opacity-50"
                            title="Reassign or unassign"
                          >
                            <option value="">— Open —</option>
                            {data.members.map((m) => (
                              <option key={m.id} value={m.id}>
                                {displayName(m)}
                              </option>
                            ))}
                          </select>
                          {assigningRoleId === role.id ? (
                            <Loader2
                              size={10}
                              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-neutral-500 animate-spin"
                            />
                          ) : (
                            <ChevronDown
                              size={10}
                              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none"
                            />
                          )}
                        </div>
                        <button
                          onClick={() => deleteRole(role.id)}
                          disabled={deletingRoleId === role.id}
                          className="text-neutral-600 hover:text-red-400 transition-colors disabled:opacity-40 ml-0.5"
                          title="Remove role"
                        >
                          {deletingRoleId === role.id ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <X size={13} />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                  );
                })}

                {/* Open roles */}
                {openRoles.map((role) => {
                  const color = getRoleColor(role.name);
                  return (
                  <div
                    key={role.id}
                    className="flex items-center gap-3 py-3 pr-5"
                    style={{ background: color.bg, borderLeft: `3px solid ${color.accent}`, paddingLeft: "calc(1.25rem - 3px)" }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: color.text }}>{role.name}</p>
                    </div>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0 border" style={{ color: color.accent, borderColor: color.accent, background: "transparent" }}>
                      Open
                    </span>
                    {canInvite && (
                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        <div className="relative">
                          <select
                            value=""
                            disabled={assigningRoleId === role.id}
                            onChange={(e) => assignRole(role.id, e.target.value || null)}
                            className="text-xs bg-neutral-700 border border-neutral-600 text-neutral-400 rounded-md pl-2 pr-5 py-0.5 outline-none focus:border-neutral-400 cursor-pointer appearance-none disabled:opacity-50"
                            title="Assign to member"
                          >
                            <option value="">Assign…</option>
                            {data.members.map((m) => (
                              <option key={m.id} value={m.id}>
                                {displayName(m)}
                              </option>
                            ))}
                          </select>
                          {assigningRoleId === role.id ? (
                            <Loader2
                              size={10}
                              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-neutral-500 animate-spin"
                            />
                          ) : (
                            <ChevronDown
                              size={10}
                              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none"
                            />
                          )}
                        </div>
                        <button
                          onClick={() => deleteRole(role.id)}
                          disabled={deletingRoleId === role.id}
                          className="text-neutral-600 hover:text-red-400 transition-colors disabled:opacity-40 ml-0.5"
                          title="Remove role"
                        >
                          {deletingRoleId === role.id ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <X size={13} />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                  );
                })}

                {/* Add role form */}
                {addingRole && (
                  <div className="px-5 py-4 bg-neutral-750 border-t border-neutral-700/50">
                    <p className="text-xs text-neutral-500 mb-3 font-medium">New role</p>
                    <div className="flex flex-col gap-2">
                      {/* Role name */}
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <select
                            value={newRolePreset}
                            onChange={(e) => setNewRolePreset(e.target.value)}
                            className="w-full text-sm bg-neutral-900 border border-neutral-600 text-neutral-300 rounded-lg px-3 pr-8 py-2 outline-none focus:border-neutral-400 cursor-pointer appearance-none"
                          >
                            {PRESET_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                          <ChevronDown
                            size={14}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none"
                          />
                        </div>
                      </div>

                      {/* Custom name input */}
                      {isCustomPreset && (
                        <input
                          ref={customInputRef}
                          value={newRoleCustom}
                          onChange={(e) => setNewRoleCustom(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") addRole(); }}
                          placeholder="Role name…"
                          className="text-sm bg-neutral-900 border border-neutral-600 text-neutral-200 rounded-lg px-3 py-2 outline-none focus:border-neutral-400 placeholder:text-neutral-600"
                        />
                      )}

                      {/* Assign to member (optional) */}
                      <div className="relative">
                        <select
                          value={newRoleUserId}
                          onChange={(e) => setNewRoleUserId(e.target.value)}
                          className="w-full text-sm bg-neutral-900 border border-neutral-600 text-neutral-400 rounded-lg px-3 pr-8 py-2 outline-none focus:border-neutral-400 cursor-pointer appearance-none"
                        >
                          <option value="">Leave open (unfilled)</option>
                          {data.members.map((m) => (
                            <option key={m.id} value={m.id}>
                              {displayName(m)}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={14}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none"
                        />
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={addRole}
                          disabled={!newRoleName || savingRole}
                          className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
                        >
                          {savingRole ? <Loader2 size={14} className="animate-spin" /> : "Add"}
                        </button>
                        <button
                          onClick={() => {
                            setAddingRole(false);
                            setNewRolePreset(PRESET_ROLES[0]);
                            setNewRoleCustom("");
                            setNewRoleUserId("");
                          }}
                          className="px-3 py-1.5 rounded-lg text-neutral-500 hover:text-neutral-300 text-sm transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Pending invitations ── */}
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
                    {canInvite && (
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

          {/* ── Invite form — team leader & moderator ── */}
          {canInvite && (
            <>
              <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-5 mb-4">
                <h2 className="text-neutral-300 text-sm font-semibold mb-1 flex items-center gap-2">
                  <UserPlus size={15} />
                  Invite by email or username
                </h2>
                <p className="text-neutral-600 text-xs mb-3">
                  Enter an email address or a{" "}
                  <span className="text-neutral-500">@username</span> (for users already signed in)
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inviteInput}
                    onChange={(e) => {
                      setInviteInput(e.target.value);
                      setInviteError(null);
                      setInviteSuccess(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") invite();
                    }}
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
                  Share this link anywhere — Discord, email, wherever. Anyone who clicks it and
                  signs in will join the project.
                </p>

                {inviteToken === undefined ? (
                  <div className="flex items-center gap-2 text-neutral-600 text-xs">
                    <Loader2 size={12} className="animate-spin" /> Loading…
                  </div>
                ) : inviteToken ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <div className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-400 font-mono truncate">
                        {typeof window !== "undefined"
                          ? `${window.location.origin}/invite/${inviteToken}`
                          : `/invite/${inviteToken}`}
                      </div>
                      <button
                        onClick={copyLink}
                        className="px-3 py-2 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-neutral-300 transition-colors shrink-0"
                        title="Copy link"
                      >
                        {copied ? (
                          <Check size={14} className="text-emerald-400" />
                        ) : (
                          <Copy size={14} />
                        )}
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
                    <p className="text-neutral-700 text-xs">
                      Revoking the link stops any future joins — existing members are unaffected.
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={generateLink}
                    disabled={linkGenerating}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-700 hover:bg-neutral-600 disabled:opacity-40 text-neutral-300 text-sm font-medium transition-colors"
                  >
                    {linkGenerating ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <RefreshCw size={14} />
                    )}
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
