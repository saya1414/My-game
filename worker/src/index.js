// Cloudflare Worker entrypoint + GameRoom Durable Object.
// One Durable Object instance per room ID.
// Any player can draw their own objects. Host draws scenario/twist and controls phase.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export class GameRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map(); // ws -> { id, name }
    this.roomState = {
      started: false,
      phase: "drawing",         // "drawing" | "summary"
      players: [],              // [{ id, name }]
      hostId: null,
      round: 1,
      playerObjects: {},        // { playerId: { name, items: [] } }
      scenario: "",
      twist: "",
      deckMode: "default",
    };
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected websocket upgrade", { status: 426 });
    }

    const url = new URL(request.url);
    const name = (url.searchParams.get("name") || "Player").slice(0, 40) || "Player";
    const id = crypto.randomUUID();

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    this.sessions.set(server, { id, name });
    if (!this.roomState.hostId) {
      this.roomState.hostId = id;
    }
    this.refreshPlayerList();

    this.send(server, { type: "welcome", you: id });
    this.broadcastState();

    server.addEventListener("message", (evt) => this.handleMessage(server, evt));
    server.addEventListener("close", () => this.handleClose(server));
    server.addEventListener("error", () => this.handleClose(server));

    return new Response(null, { status: 101, webSocket: client });
  }

  refreshPlayerList() {
    this.roomState.players = [...this.sessions.values()].map((s) => ({
      id: s.id,
      name: s.name,
    }));
  }

  handleMessage(ws, evt) {
    let msg;
    try {
      msg = JSON.parse(evt.data);
    } catch {
      return;
    }
    const session = this.sessions.get(ws);
    if (!session) return;
    const isHost = session.id === this.roomState.hostId;

    switch (msg.type) {
      case "rename": {
        const newName = String(msg.name || session.name).slice(0, 40);
        if (newName) {
          session.name = newName;
          this.refreshPlayerList();
        }
        break;
      }
      case "start": {
        if (!isHost) return;
        this.roomState.started = true;
        this.roomState.phase = "drawing";
        this.roomState.round = 1;
        this.roomState.playerObjects = {};
        this.roomState.scenario = "";
        this.roomState.twist = "";
        if (typeof msg.deckMode === "string") {
          this.roomState.deckMode = msg.deckMode === "custom" ? "custom" : "default";
        }
        break;
      }
      case "drawObjects": {
        // Any player can draw their own objects
        const items = Array.isArray(msg.items)
          ? msg.items.slice(0, 20).map((x) => String(x).slice(0, 200))
          : [];
        this.roomState.playerObjects[session.id] = { name: session.name, items };
        break;
      }
      case "drawScenario": {
        if (!isHost) return;
        this.roomState.scenario = String(msg.item || "").slice(0, 1000);
        break;
      }
      case "drawTwist": {
        if (!isHost) return;
        this.roomState.twist = String(msg.item || "").slice(0, 1000);
        break;
      }
      case "showSummary": {
        if (!isHost) return;
        this.roomState.phase = "summary";
        break;
      }
      case "nextRound": {
        if (!isHost) return;
        this.roomState.phase = "drawing";
        this.roomState.round += 1;
        this.roomState.playerObjects = {};
        this.roomState.scenario = "";
        this.roomState.twist = "";
        break;
      }
      case "reset": {
        if (!isHost) return;
        this.roomState.started = false;
        this.roomState.phase = "drawing";
        this.roomState.round = 1;
        this.roomState.playerObjects = {};
        this.roomState.scenario = "";
        this.roomState.twist = "";
        break;
      }
      default:
        return;
    }
    this.broadcastState();
  }

  handleClose(ws) {
    const session = this.sessions.get(ws);
    if (!session) return;

    // Remove this player's objects when they leave
    delete this.roomState.playerObjects[session.id];
    this.sessions.delete(ws);
    this.refreshPlayerList();

    if (session.id === this.roomState.hostId) {
      this.roomState.hostId = this.roomState.players[0]?.id || null;
    }
    this.broadcastState();
  }

  send(ws, obj) {
    try {
      ws.send(JSON.stringify(obj));
    } catch {
      /* socket may be closed */
    }
  }

  broadcastState() {
    const payload = JSON.stringify({ type: "state", state: this.roomState });
    for (const ws of this.sessions.keys()) {
      try {
        ws.send(payload);
      } catch {
        /* ignore */
      }
    }
  }
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);
    const match = url.pathname.match(/^\/room\/([A-Za-z0-9_-]{1,32})$/);
    if (!match) {
      return new Response("My Game multiplayer server is running.", {
        status: 200,
        headers: CORS,
      });
    }

    const roomId = match[1].toUpperCase();
    const id = env.GAME_ROOM.idFromName(roomId);
    const stub = env.GAME_ROOM.get(id);
    return stub.fetch(request);
  },
};