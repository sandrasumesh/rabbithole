// Simple JSON-file storage. Easy to swap for a real database (Postgres, MongoDB) later.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export class Store {
  constructor(file) {
    this.file = file;
    this.data = { sessions: [] };
    if (fs.existsSync(file)) {
      try {
        this.data = JSON.parse(fs.readFileSync(file, "utf8"));
      } catch {
        console.warn("Could not read data file, starting fresh");
      }
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
  }

  list() {
    return this.data.sessions;
  }

  get(id) {
    return this.data.sessions.find((s) => s.id === id);
  }

  create(name, visits = []) {
    const session = {
      id: crypto.randomUUID(),
      name: name || "Untitled session",
      createdAt: Date.now(),
      active: true,
      visits,
      analysis: null,
    };
    this.data.sessions.unshift(session);
    this.save();
    return session;
  }

  update(id, changes) {
    const s = this.get(id);
    if (!s) return null;
    Object.assign(s, changes);
    this.save();
    return s;
  }

  remove(id) {
    const before = this.data.sessions.length;
    this.data.sessions = this.data.sessions.filter((s) => s.id !== id);
    this.save();
    return this.data.sessions.length < before;
  }
}
