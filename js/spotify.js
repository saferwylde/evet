/* ------------------------------------------------------------------
   Spotify Web API istemcisi - PKCE (Authorization Code + PKCE)
   Client secret gerektirmez, tamamen tarayicida calisir.
   Token'lar localStorage'da saklanir (Cloud Phone WebStorage destekler).
   ------------------------------------------------------------------ */
(function (global) {
  'use strict';

  var CFG = global.SPOTIFY_CONFIG || {};
  var TOKEN_KEY = 'sp.token.v1';
  var VERIFIER_KEY = 'sp.pkce.v1';

  function cfg() { return CFG || {}; }

  function redirectUri() {
    if (cfg().redirectUri) return cfg().redirectUri;
    var origin = location.origin || '';
    var host = origin.replace(/^https?:\/\//, '').split(':')[0];
    /* Yerel gelistirme: kayitli localRedirectUri ile birebir ayni olmali.
       Spotify "localhost" kaydini reddeder; 127.0.0.1 kullanilir. */
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') {
      return cfg().localRedirectUri || (origin + location.pathname);
    }
    return origin + location.pathname;
  }

  /* ---- yardimcilar ---- */
  function b64url(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function randomString(len) {
    var bytes = new Uint8Array(len);
    crypto.getRandomValues(bytes);
    return b64url(bytes);
  }

  function store(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* kota dolu olabilir */ }
  }

  function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function readJSON(key) {
    var v = read(key);
    try { return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }

  /* ---- PKCE ---- */
  function challenge(verifier) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
      .then(function (buf) { return b64url(new Uint8Array(buf)); });
  }

  function ensureVerifier() {
    var v = read(VERIFIER_KEY);
    if (!v) {
      v = randomString(64);
      store(VERIFIER_KEY, v);
    }
    return v;
  }

  /* ---- token islemleri ---- */
  function saveToken(data) {
    var token = readJSON(TOKEN_KEY) || {};
    token.access_token = data.access_token;
    token.refresh_token = data.refresh_token || token.refresh_token;
    token.expires_at = Date.now() + (data.expires_in || 3600) * 1000;
    /* Spotify yanitta verilen izinler — 'streaming' SDK oynatma icin sart */
    if (data.scope) token.scope = data.scope;
    store(TOKEN_KEY, JSON.stringify(token));
    return token;
  }

  function token() { return readJSON(TOKEN_KEY); }

  function clearToken() {
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* yoksay */ }
  }

  function refresh() {
    var t = token();
    if (!t || !t.refresh_token) return Promise.reject(new Error('refresh token yok'));

    return fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(t.refresh_token) +
            '&client_id=' + encodeURIComponent(cfg().clientId || '')
    }).then(function (r) {
      if (!r.ok) throw new Error('token yenilenemedi (' + r.status + ')');
      return r.json();
    }).then(saveToken);
  }

  function accessToken() {
    var t = token();
    if (!t) return Promise.reject(new Error('giris yapilmamis'));
    if (t.expires_at && t.expires_at - Date.now() > 60000) {
      return Promise.resolve(t.access_token);
    }
    return refresh().then(function (t2) { return t2.access_token; });
  }

  /* ---- public API ---- */
  function api(path, params) {
    var url = 'https://api.spotify.com/v1/' + path;
    if (params) {
      var q = [];
      for (var k in params) {
        if (Object.prototype.hasOwnProperty.call(params, k) && params[k] !== undefined && params[k] !== null) {
          q.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
        }
      }
      if (q.length) url += '?' + q.join('&');
    }
    return accessToken().then(function (tok) {
      return fetch(url, { headers: { Authorization: 'Bearer ' + tok } }).then(function (r) {
        if (r.status === 401) { clearToken(); throw new Error('oturum gecersiz, tekrar giris yapin'); }
        if (!r.ok) throw new Error('Spotify API ' + r.status);
        return r.json();
      });
    });
  }

  /* ---- login (PKCE) ---- */
  function login() {
    if (!cfg().clientId) return Promise.reject(new Error('clientId tanimli degil (js/config.js)'));
    var verifier = ensureVerifier();
    return challenge(verifier).then(function (ch) {
      var url = 'https://accounts.spotify.com/authorize' +
        '?client_id=' + encodeURIComponent(cfg().clientId) +
        '&response_type=code' +
        '&redirect_uri=' + encodeURIComponent(redirectUri()) +
        '&scope=' + encodeURIComponent(cfg().scopes || '') +
        '&code_challenge_method=S256' +
        '&code_challenge=' + encodeURIComponent(ch) +
        '&show_dialog=true';
      location.assign(url);
      return true;
    });
  }

  /* Geri dönüşte ?code=... ile gelindiğinde token değişimi */
  function handleRedirect() {
    var params = new URLSearchParams(location.search);
    var code = params.get('code');
    var err = params.get('error');
    if (err) {
      history.replaceState(null, '', location.pathname);
      return Promise.reject(new Error('giris reddedildi: ' + err));
    }
    if (!code) return Promise.resolve(null);

    var verifier = read(VERIFIER_KEY);
    if (!verifier) {
      history.replaceState(null, '', location.pathname);
      return Promise.reject(new Error('PKCE dogrulayici bulunamadi'));
    }

    return fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=authorization_code' +
            '&code=' + encodeURIComponent(code) +
            '&redirect_uri=' + encodeURIComponent(redirectUri()) +
            '&client_id=' + encodeURIComponent(cfg().clientId || '') +
            '&code_verifier=' + encodeURIComponent(verifier)
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error('token hatasi: ' + t.slice(0, 120)); });
      return r.json();
    }).then(function (data) {
      saveToken(data);
      try { localStorage.removeItem(VERIFIER_KEY); } catch (e) { /* yoksay */ }
      history.replaceState(null, '', location.pathname);
      return getProfile();
    });
  }

  function getProfile() {
    return api('me').then(function (me) {
      return { id: me.id, name: me.display_name || me.id, email: me.email || '' };
    });
  }

  function isLoggedIn() {
    var t = token();
    return !!(t && t.access_token);
  }

  function logout() {
    clearToken();
    try { localStorage.removeItem(VERIFIER_KEY); } catch (e) { /* yoksay */ }
  }

  /* ---- genel HTTP (PUT/DELETE/POST govdesiz de calisir) ---- */
  function apiRaw(path, method, body) {
    var url = 'https://api.spotify.com/v1/' + path;
    return accessToken().then(function (tok) {
      var opt = {
        method: method || 'GET',
        headers: { Authorization: 'Bearer ' + tok }
      };
      if (body) {
        opt.headers['Content-Type'] = 'application/json';
        opt.body = JSON.stringify(body);
      }
      return fetch(url, opt).then(function (r) {
        if (r.status === 401) { clearToken(); throw new Error('oturum gecersiz, tekrar giris yapin'); }
        if (!r.ok) throw new Error('Spotify API ' + r.status);
        /* 204 No Content (oynatici komutlari) JSON degildir */
        if (r.status === 204) return null;
        return r.json();
      });
    });
  }

  /* ---- veri yardimcilari ---- */
  function simplifyTrack(track) {
    var artists = ((track && track.artists) || [])
      .map(function (a) { return a.name; }).filter(Boolean).join(', ');
    return {
      id: track.id,
      title: track.name,
      artist: artists,
      album: (track.album && track.album.name) || '',
      image: (track.album && track.album.images && track.album.images.length)
        ? track.album.images[track.album.images.length - 1].url : null,
      preview_url: track.preview_url || null,
      url: (track.external_urls && track.external_urls.spotify) || ('https://open.spotify.com/track/' + track.id),
      duration_ms: track.duration_ms
    };
  }

  /* Sayfalama: Spotify paging objesi 'next' linkiyle devam eder.
     limit=50 ile gonderilen istekler 50'de kesilir; 'next' bos kalana kadar
     takip edilir (en fazla 1000 oge, sonsuz donguyu engellemek icin). */
  function paged(path, params) {
    var out = [];
    function walk(data) {
      var items = (data && data.items) || [];
      out = out.concat(items);
      var next = data && data.next;
      if (!next || out.length >= 1000) return out;
      var rest = String(next).replace('https://api.spotify.com/v1/', '');
      return api(rest).then(walk);
    }
    return api(path, params).then(walk);
  }

  function myPlaylists() {
    return paged('me/playlists', { limit: 50 }).then(function (items) {
      return items.map(function (p) {
        return {
          id: p.id,
          title: p.name,
          artist: p.owner && p.owner.display_name ? p.owner.display_name : '',
          ownerId: p.owner && p.owner.id ? p.owner.id : '',
          /* Subat 2026 sonrasi sekil: tracks yerine items alanindan okunur */
          trackCount:
            (p.items && p.items.total) ||
            (p.tracks && p.tracks.total) || 0,
          image: p.images && p.images.length ? p.images[0].url : null,
          url: p.external_urls && p.external_urls.spotify
        };
      });
    });
  }

  function playlistTracks(playlistId) {
    var id = encodeURIComponent(playlistId);
    /* Subat 2026 gecisi: /tracks ucu dev-mode uygulamalarda bos/403 doner,
       yerine /items geldi; her oge de 'track' yerine 'item' alaninda.
       Sirayla 4 yontem dener, sonuclu olan ilkini kullanir. */
    var attempts = [
      /* 1) yeni uc: /items */
      function () { return paged('playlists/' + id + '/items', { limit: 50 }); },
      /* 2) yeni uc + market */
      function () { return paged('playlists/' + id + '/items', { limit: 50, market: 'TR' }); },
      /* 3) eski uc (bazi ortamlarda hala calisir) */
      function () { return paged('playlists/' + id + '/tracks', { limit: 50 }); },
      /* 4) playlist objesinin kendisi (items veya tracks alanindan) */
      function () {
        return api('playlists/' + id, { additional_types: 'track' })
          .then(function (p) {
            return (p.items && p.items.items) ||
              (p.tracks && p.tracks.items) || [];
          });
      }
    ];

    function tryAt(i) {
      if (i >= attempts.length) {
        var none = [];
        none.used = 'tum yontemler bos';
        return Promise.resolve(none);
      }
      return attempts[i]()
        .then(function (items) {
          if (items && items.length) {
            items.used = 'yontem ' + (i + 1);
            return items;
          }
          return tryAt(i + 1);
        })
        .catch(function () { return tryAt(i + 1); });
    }

    return tryAt(0).then(function (items) {
      var out = [];
      var skipped = 0; /* id'siz ogeler: yerel dosya, podcast bolumu vb. */
      items.forEach(function (i) {
        /* yeni sekilde 'item', eski sekilde 'track' */
        var t = i && (i.item || i.track);
        if (t && t.id) {
          out.push(simplifyTrack(t));
        } else if (t || i) {
          skipped++;
        }
      });
      out.skipped = skipped;
      out.used = items.used || '';
      return out;
    });
  }

  function savedTracks() {
    return paged('me/tracks', { limit: 50 }).then(function (items) {
      return items
        .map(function (i) { return i.track; })
        .filter(function (t) { return t && t.id; })
        .map(simplifyTrack);
    });
  }

  function searchTracks(query) {
    return api('search', { q: query, type: 'track', limit: 30 }).then(function (data) {
      var items = (data.tracks && data.tracks.items) || [];
      return items.map(simplifyTrack);
    });
  }

  /* ---- Spotify favorileri (me/tracks) ---- */
  function savedContains(id) {
    return api('me/tracks/contains', { ids: id }).then(function (arr) {
      return !!(arr && arr[0]);
    });
  }
  function saveTrack(id) {
    return apiRaw('me/tracks?ids=' + encodeURIComponent(id), 'PUT');
  }
  function removeTrack(id) {
    return apiRaw('me/tracks?ids=' + encodeURIComponent(id), 'DELETE');
  }

  /* ---- oynatma: Web Playback SDK + Connect API ----
     Premium oturumla TAM PARCA oynatir; seek/next/prev tuslarla kontrol
     edilir. SDK desteklenmezse (cogu telefon tarayicisi EME/DRM
     desteklemez) uygulama embed iframe'e duser; app.js halleder. */
  var sdkPlayer = null;
  var sdkDeviceId = null;
  var sdkPromise = null;
  var sdkStateCb = null;

  function sdkLoad() {
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise(function (resolve) {
      /* SDK script'i window.Spotify'i EZER; o yuzden yakalayip sonra
         kendi istemcimizi geri koyariz. */
      window.onSpotifyWebPlaybackSDKReady = function () {
        var SDK = window.Spotify;
        global.Spotify = exports; /* kendi istemcimizi geri tasi */
        try {
          sdkPlayer = new SDK.Player({
            name: 'Cloud Phone Widget',
            getOAuthToken: function (cb) {
              accessToken().then(cb).catch(function () { cb(null); });
            },
            volume: 0.9
          });
          sdkPlayer.addListener('ready', function (d) {
            sdkDeviceId = d.device_id;
            resolve(d.device_id);
          });
          sdkPlayer.addListener('not_ready', function () { /* yoksay */ });
          ['initialization_error', 'authentication_error', 'account_error', 'playback_error']
            .forEach(function (ev) {
              sdkPlayer.addListener(ev, function (e) {
                console.warn('[playback-sdk]', ev, e && e.message);
              });
            });
          sdkPlayer.addListener('player_state_changed', function (s) {
            if (sdkStateCb) sdkStateCb(s);
          });
          sdkPlayer.connect();
        } catch (e) {
          console.warn('[playback-sdk]', e.message);
          resolve(null);
        }
      };
      var s = document.createElement('script');
      s.src = 'https://sdk.scdn.co/spotify-player.js';
      s.onerror = function () { resolve(null); };
      document.head.appendChild(s);
      /* 12 sn icinde 'ready' gelmezse SDK desteklenmiyor say */
      setTimeout(function () { if (!sdkDeviceId) resolve(null); }, 12000);
    });
    return sdkPromise;
  }

  function playerDeviceId() { return sdkDeviceId; }

  /* SDK durum degisikligini dinleyiciye haber verir */
  function onPlayerState(cb) { sdkStateCb = cb || null; }

  function playerPlay(body) {
    return sdkLoad().then(function (dev) {
      if (!dev) return Promise.reject(new Error('sdk yok'));
      return apiRaw('me/player/play?device_id=' + encodeURIComponent(dev), 'PUT', body);
    });
  }
  function playerTransfer() {
    return sdkLoad().then(function (dev) {
      if (!dev) throw new Error('sdk yok');
      return apiRaw('me/player', 'PUT', { device_ids: [dev], play: false });
    });
  }
  function playerToggle() {
    return sdkLoad().then(function (dev) {
      if (!dev) throw new Error('sdk yok');
      /* govdesiz PUT /me/player/play oynatiyor; pause duraklatir.
         Toggle uc noktasi yok; durum SDK'dan takip edilir. */
      return apiRaw('me/player/pause?device_id=' + encodeURIComponent(dev), 'PUT');
    });
  }
  function playerResume() {
    return sdkLoad().then(function (dev) {
      if (!dev) throw new Error('sdk yok');
      return apiRaw('me/player/play?device_id=' + encodeURIComponent(dev), 'PUT');
    });
  }
  function playerSeek(ms) {
    return sdkLoad().then(function (dev) {
      if (!dev) throw new Error('sdk yok');
      return apiRaw('me/player/seek?position_ms=' + Math.max(0, Math.round(ms)) +
        '&device_id=' + encodeURIComponent(dev), 'PUT');
    });
  }
  function playerNext() {
    return sdkLoad().then(function (dev) {
      if (!dev) throw new Error('sdk yok');
      return apiRaw('me/player/next?device_id=' + encodeURIComponent(dev), 'POST');
    });
  }
  function playerPrevious() {
    return sdkLoad().then(function (dev) {
      if (!dev) throw new Error('sdk yok');
      return apiRaw('me/player/previous?device_id=' + encodeURIComponent(dev), 'POST');
    });
  }

  var exports = {
    login: login,
    logout: logout,
    handleRedirect: handleRedirect,
    getProfile: getProfile,
    isLoggedIn: isLoggedIn,
    configured: function () { return !!cfg().clientId; },
    redirectUri: redirectUri,
    clientId: function () { return cfg().clientId || ''; },
    tokenScopes: function () { var t = token(); return (t && t.scope) || ''; },
    hasStreaming: function () {
      var t = token();
      return !!(t && t.scope && String(t.scope).indexOf('streaming') > -1);
    },
    myPlaylists: myPlaylists,
    playlistTracks: playlistTracks,
    savedTracks: savedTracks,
    searchTracks: searchTracks,
    simplifyTrack: simplifyTrack,
    /* favoriler */
    savedContains: savedContains,
    saveTrack: saveTrack,
    removeTrack: removeTrack,
    /* oynatma */
    playerDeviceId: playerDeviceId,
    onPlayerState: onPlayerState,
    playerPlay: playerPlay,
    playerTransfer: playerTransfer,
    playerToggle: playerToggle,
    playerResume: playerResume,
    playerSeek: playerSeek,
    playerNext: playerNext,
    playerPrevious: playerPrevious
  };
  global.Spotify = exports;
})(window);
