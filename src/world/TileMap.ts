// Logical grid the whole sim runs on. No rendering here.
export class TileMap {
  walkable: Uint8Array;
  room: Int16Array;        // index into rooms list, -1 = none
  reserved: Int32Array;    // entity id that reserved this tile for a task, 0 = free

  constructor(public width: number, public height: number) {
    const n = width * height;
    this.walkable = new Uint8Array(n);
    this.room = new Int16Array(n).fill(-1);
    this.reserved = new Int32Array(n);
  }

  idx(x: number, y: number) { return y * this.width + x; }
  inBounds(x: number, y: number) { return x >= 0 && y >= 0 && x < this.width && y < this.height; }
  isWalkable(x: number, y: number) { return this.inBounds(x, y) && this.walkable[this.idx(x, y)] === 1; }

  tileXY(idx: number) { return { x: idx % this.width, y: Math.floor(idx / this.width) }; }

  // tile -> world (center of tile), centered on origin
  toWorld(x: number, y: number) { return { x: x - this.width / 2 + 0.5, z: y - this.height / 2 + 0.5 }; }
  worldToTile(wx: number, wz: number) {
    return { x: Math.floor(wx + this.width / 2), y: Math.floor(wz + this.height / 2) };
  }
  worldToIdx(wx: number, wz: number) { const t = this.worldToTile(wx, wz); return this.inBounds(t.x, t.y) ? this.idx(t.x, t.y) : -1; }
}
