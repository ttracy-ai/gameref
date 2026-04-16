"use client";
import { createClient } from "@liveblocks/client";
import { createRoomContext } from "@liveblocks/react";

const client = createClient({
  authEndpoint: "/api/liveblocks-auth",
});

type Presence = Record<string, never>;
type Storage  = Record<string, never>;

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
  useOthers,
  useSelf,
} = createRoomContext<Presence, Storage, UserMeta>(client);
