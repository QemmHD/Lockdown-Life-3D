import { ROOM_MAP, roomAt } from '../data/rooms';
import type { RoomDef } from '../game/types';

export interface Vec2 { x: number; z: number; }

function doorOuter(r: RoomDef): Vec2 { return { x: r.x, z: r.z < 0 ? -3 : 3 }; }
function doorInner(r: RoomDef): Vec2 { return { x: r.x, z: r.z < 0 ? -8 : 8 }; }

export function wanderPoint(roomId: string): Vec2 {
  const r = ROOM_MAP[roomId] ?? ROOM_MAP['hallway'];
  const pad = 2;
  return {
    x: r.x + (Math.random() - 0.5) * Math.max(0, r.w - pad * 2),
    z: r.z + (Math.random() - 0.5) * Math.max(0, r.d - pad * 2)
  };
}

// Build a waypoint list from a position to a target room, routing via the hallway.
export function computePath(x: number, z: number, toRoomId: string): Vec2[] {
  const fromRoom = roomAt(x, z);
  const toRoom = ROOM_MAP[toRoomId] ?? ROOM_MAP['hallway'];
  const nodes: Vec2[] = [];

  if (fromRoom.id !== 'hallway' && fromRoom.id !== toRoom.id) {
    nodes.push(doorInner(fromRoom));
    nodes.push(doorOuter(fromRoom));
  }

  // travel along the central hallway lane
  const laneX = toRoom.id === 'hallway' ? x + (Math.random() - 0.5) * 30 : toRoom.x;
  nodes.push({ x: clampHall(laneX), z: 0 });

  if (toRoom.id !== 'hallway') {
    nodes.push(doorOuter(toRoom));
    nodes.push(doorInner(toRoom));
    nodes.push(wanderPoint(toRoom.id));
  } else {
    nodes.push({ x: clampHall(laneX), z: (Math.random() - 0.5) * 6 });
  }
  return nodes;
}

function clampHall(x: number) { return Math.max(-58, Math.min(58, x)); }
