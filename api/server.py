#!/usr/bin/env python3
"""Cloud Phone Spotify widget - statik sunucu + istege bagli Spotify Web API proxy.

Kullanim:
    python api/server.py
    -> http://localhost:8080  (statik widget, data/tracks.json kullanir)

    set SPOTIFY_CLIENT_ID=xxx
    set SPOTIFY_CLIENT_SECRET=yyy
    python api/server.py
    -> /api/playlist/<id> ve /api/search?q=... gercek Spotify verisi doner

Proxy olmadan da widget calisir: istemci (js/app.js) proxy 404 alirsa
data/tracks.json dosyasina duser.
"""
import json
import os
import time
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PORT = int(os.environ.get("PORT", "8080"))
CLIENT_ID = os.environ.get("SPOTIFY_CLIENT_ID", "")
CLIENT_SECRET = os.environ.get("SPOTIFY_CLIENT_SECRET", "")
DEFAULT_PLAYLIST = "37i9dQZF1DXcBWIGoYBM5M"

_token = {"value": None, "expires": 0}


def get_token():
    """Client Credentials akisi ile access token al (cache'li)."""
    if not CLIENT_ID or not CLIENT_SECRET:
        return None
    if _token["value"] and time.time() < _token["expires"]:
        return _token["value"]

    body = urllib.parse.urlencode(
        {"grant_type": "client_credentials"}
    ).encode()
    req = urllib.request.Request(
        "https://accounts.spotify.com/api/token",
        data=body,
        headers={
            "Authorization": "Basic "
            + __import__("base64")
            .b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode())
            .decode(),
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read().decode())
    _token["value"] = data["access_token"]
    _token["expires"] = time.time() + int(data.get("expires_in", 3600)) - 60
    return _token["value"]


def api_get(path, params):
    token = get_token()
    if not token:
        raise RuntimeError("Spotify kimlik bilgisi yok")
    url = "https://api.spotify.com/v1/" + path + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode())


def simplify(item):
    track = item.get("track", item)
    artists = ", ".join(a.get("name", "") for a in track.get("artists", []) if a.get("name"))
    image = None
    images = track.get("album", {}).get("images") or []
    if images:
        image = images[-1].get("url")
    return {
        "id": track.get("id"),
        "title": track.get("name"),
        "artist": artists,
        "album": (track.get("album") or {}).get("name", ""),
        "image": image,
        "preview_url": track.get("preview_url"),
        "url": (track.get("external_urls") or {}).get("spotify", ""),
    }


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path.startswith("/api/"):
            return self.handle_api(path, urllib.parse.parse_qs(parsed.query))
        return super().do_GET()

    def handle_api(self, path, query):
        try:
            if path == "/api/playlist/default":
                data = api_get(
                    f"playlists/{DEFAULT_PLAYLIST}/tracks",
                    {"limit": 30, "market": "TR"},
                )
            elif path.startswith("/api/playlist/"):
                pid = path.rsplit("/", 1)[-1]
                data = api_get(f"playlists/{pid}/tracks", {"limit": 30, "market": "TR"})
            elif path == "/api/search":
                q = (query.get("q") or [""])[0]
                if not q:
                    return self.send_json({"items": []})
                data = api_get("search", {"q": q, "type": "track", "limit": 20, "market": "TR"})
                data = {"items": data.get("tracks", {}).get("items", [])}
            else:
                return self.send_json({"error": "unknown endpoint"}, status=404)

            items = [simplify(i) for i in data.get("items", [])]
            self.send_json({"playlist": {"id": DEFAULT_PLAYLIST}, "items": items})
        except Exception as exc:  # proxy yoksa 404 -> istemci yerel JSON'a duser
            self.send_json({"error": str(exc)}, status=404)

    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        print("[%s] %s" % (self.log_date_time_string(), fmt % args))


if __name__ == "__main__":
    srv = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Widget: http://localhost:{PORT}")
    print("Proxy:", "aktif" if CLIENT_ID else "kapali (data/tracks.json kullanilacak)")
    srv.serve_forever()
