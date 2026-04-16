"use client";
import { createClient } from "@liveblocks/client";
import { createRoomContext } from "@liveblocks/react";

const client = createClient({
  authEndpoint: "/api/liveblocks-auth",
});

type Presence = Record<string, never>;

// Storage is per-room; `initialized` tracks whether the Yjs doc has been seeded from DB.
type Storage = {
  initialized: boolean;
};

export type LiveblocksUserInfo = {
  name: string;
  color: string;
  avatar?: string;
};

type UserMeta = {
  id: string;
  info: LiveblocksUserInfo;
};

export const {
  RoomProvider,
  useRoom,
  useOthers,
  useSelf,
  useStorage,
  useMutation,
} = createRoomContext<Presence, Storage, UserMeta>(client);
