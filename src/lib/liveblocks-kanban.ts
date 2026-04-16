"use client";
import { createClient } from "@liveblocks/client";
import { createRoomContext } from "@liveblocks/react";

const client = createClient({
  authEndpoint: "/api/liveblocks-auth",
});

type Presence = Record<string, never>;
type Storage = {
  boardJson: string;
};
type UserMeta = {
  id: string;
  info: { name: string; color: string; avatar?: string };
};

export const {
  RoomProvider,
  useStorage,
  useMutation,
} = createRoomContext<Presence, Storage, UserMeta>(client);
