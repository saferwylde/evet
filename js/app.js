/* ------------------------------------------------------------------
   Spotify widget for Cloud Phone  (v2)
   - Tum veriler Spotify Web API'den (PKCE) gelir; yerel/demo veri yok
   - Web Playback SDK (Premium) ile TAM PARCA oynatma
   - Tuslarla ileri/geri sarma, sonraki/onceki, duraklat/devam
   - SDK desteklenmezse Spotify Embed iframe'e duser
   - Klavye: LSK=Escape, RSK=back, Enter, oklar, rakamlar
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  /* T9 / coklu tus: 2=abc ... 9=wxyz */
  var KEYMAP = { '2': 'abc', '3': 'def', '4': 'ghi', '5': 'jkl', '6': 'mno', '7': 'pqrs', '8': 'tuv', '9': 'wxyz' };
  var MULTITAP_MS = 900;
  var SEEK_MS = 10000;

  var $ = function (id) { return document.getElementById(id); };
  var hasSpotify = function () { return typeof window.Spotify === 'object'; };

  var state = {
    view: 'list',        /* list | player */
    overlay: null,       /* null | menu | search | info */
    source: 'tracks',    /* playlists | tracks | search */
    shown: [],
    sel: 0,
    actionSel: 0,
    actionItems: [],
    menuSel: 0,
    user: null,
    /* oynatici durumu */
    play: {
      mode: 'sdk',       /* sdk | embed */
      track: null,
      ctx: null,         /* { contextUri } | { uris:[], offset:n } */
      paused: true,
      posMs: 0,
      durMs: 0,
      lastTick: 0,
      fav: null          /* null=bulunamadi, true/false Spotify kayitli */
    },
    query: '',
    tap: { key: '', at: 0, idx: 0 }
  };

  var dom = {};

  /* ---------------- baslangic ---------------- */
  function init() {
    dom = {
      list: $('list'), empty: $('empty'), hint: $('hintline'), net: $('net'),
      viewList: $('view-list'), viewPlayer: $('view-player'),
      nowTitle: $('nowTitle'), nowArtist: $('nowArtist'),
      embed: $('embed'), actions: $('actions'),
      progress: $('progress'), pfill: $('pfill'), ptime: $('ptime'),
      menu: $('menu'), menuList: $('menuList'),
      search: $('search'), qtext: $('qtext'),
      info: $('info'), infoBody: $('infoBody'), btnInfoClose: $('btnInfoClose'),
      lsk: $('lsk'), rsk: $('rsk'), tip: $('tip'),
      btnSearchGo: $('btnSearchGo')
    };

    dom.lsk.addEventListener('click', function () { openMenu(); });
    dom.rsk.addEventListener('click', function () { goBack(); });
    dom.btnSearchGo.addEventListener('click', function () { runSearch(); });
    dom.btnInfoClose.addEventListener('click', function () { closeOverlay(); });
    document.addEventListener('keydown', onKey);
    /* RSK (back) olayini yakala */
    window.addEventListener('back', onBack);

    window.addEventListener('resize', fitScreen);
    fitScreen();

    /* ilerleme sayaci */
    setInterval(tick, 500);

    /* Web Playback SDK durum akisi -> oynatici ekranina aktar */
    if (hasSpotify()) Spotify.onPlayerState(onSdkState);

    setNet(true);
    setTip('↑↓ seç · Enter aç');
    initSession();
  }

  function fitScreen() {
    document.body.classList.toggle('compact', window.innerWidth < 180);
  }

  function setTip(t) { dom.tip.textContent = t; }

  /* Uzun basliklar icin marquee (Cloud Phone kilavuzu: kisaltma yerine kaydirma).
     Kisalarca normal, uzursa .mq sinifi eklenir. */
  function marquee(el, text, limit) {
    el.textContent = text;
    el.classList.toggle('mq', text.length > limit);
  }

  function setNet(ok) {
    dom.net.className = ok ? 'net' : 'net off';
    dom.net.title = ok ? 'bagli' : 'cevrimdisi';
  }

  /* ---------------- Spotify oturumu ---------------- */
  function initSession() {
    if (!hasSpotify()) return;

    /* Geri donuste ?code=... ile gelindiyse token degisimi yap */
    Spotify.handleRedirect()
      .then(function (profile) {
        if (profile) {
          state.user = profile;
          setTip('hoşgeldin ' + profile.name);
          dom.hint.textContent = 'Spotify: ' + profile.name;
          /* oynatma motorunu erken baslat (ilk 12 sn SDK baglanir) */
          Spotify.playerDeviceId();
          homeList();
        }
      })
      .catch(function (err) { setTip('giris hatasi'); console.warn('[spotify]', err.message); });

    if (Spotify.isLoggedIn()) {
      Spotify.getProfile()
        .then(function (p) {
          state.user = p;
          dom.hint.textContent = 'Spotify: ' + p.name;
          Spotify.playerDeviceId(); /* SDK'yi erken bagla */
          if (Spotify.hasStreaming && Spotify.hasStreaming()) {
            if (!state.user._loaded) { state.user._loaded = true; homeList(); }
          } else {
            /* eski oturum: streaming izni yok -> embed 30 sn calar */
            dom.hint.textContent = 'Spotify: ' + p.name;
            setTip('⚠ tam çalma için: Esc → çıkış + giriş');
            if (!state.user._loaded) { state.user._loaded = true; homeList(); }
          }
        })
        .catch(function () { /* token yenilenemedi, giris menusunden tekrar giris yapilir */ });
    } else {
      dom.hint.textContent = 'Spotify';
      dom.empty.hidden = false;
      dom.empty.textContent = 'LSK menü → Spotify’a giriş yap';
    }
  }

  /* acilista gosterilecek ana liste: calis listeleri */
  function homeList() {
    if (Spotify.isLoggedIn()) openPlaylists();
  }

  function loginToSpotify() {
    if (!hasSpotify()) return;
    if (!Spotify.configured()) {
      setTip('clientId gerekli (js/config.js)');
      return;
    }
    setTip('Spotify’a yönlendiriliyor…');
    Spotify.login().catch(function (err) {
      setTip('giriş başarısız');
      console.warn('[spotify]', err.message);
    });
  }

  /* ---------------- listeler ---------------- */
  function showTracks(tracks, label, ctx) {
    state.source = 'tracks';
    state.shown = tracks;
    state.sel = 0;
    state.listCtx = ctx || null;
    dom.hint.textContent = label;
    renderList();
    setTip('↑↓ seç · Enter aç');
  }

  function openSaved() {
    if (requireLogin()) return;
    setTip('yükleniyor…');
    Spotify.savedTracks()
      .then(function (tracks) {
        showTracks(tracks, 'Favorilerim (' + tracks.length + ')');
        setNet(true);
      })
      .catch(function (err) { apiFail(err); });
  }

  function openPlaylists() {
    if (requireLogin()) return;
    setTip('yükleniyor…');
    Spotify.myPlaylists()
      .then(function (lists) {
        state.source = 'playlists';
        state.shown = lists.map(function (p) {
          return {
            id: p.id,
            title: p.title,
            owner: p.ownerId || '',
            artist: (p.artist || '') +
              (p.ownerId === 'spotify' ? ' · özel' : '') +
              (p.trackCount ? ' · ' + p.trackCount + ' şarkı' : ' · boş'),
            image: p.image,
            url: p.url
          };
        })
        /* kendi listelerini one al, Spotify'a ait algoritmikleri sona at */
        .sort(function (a, b) {
          var ao = a.owner === 'spotify' ? 1 : 0;
          var bo = b.owner === 'spotify' ? 1 : 0;
          return ao - bo;
        });
        /* listenin en ustunde arama satiri */
        state.shown.unshift({ id: '__search', title: '🔎 Şarkı ara…', artist: 'Enter → harf yaz' });
        state.sel = 0;
        dom.hint.textContent = 'Çalış listelerim (' + (state.shown.length - 1) + ')';
        renderList();
        setTip('↑↓ seç · Enter aç');
        setNet(true);
      })
      .catch(apiFail);
  }

  function openPlaylist(playlistId) {
    if (requireLogin()) return;
    setTip('şarkılar yükleniyor…');
    Spotify.playlistTracks(playlistId)
      .then(function (tracks) {
        if (!tracks.length) {
          setTip(tracks.skipped
            ? 'Çalınabilir şarkı yok (' + tracks.skipped + ' öğe atlandı)'
            : 'Playlist boş');
          return;
        }
        showTracks(tracks,
          'Playlist · ' + tracks.length + ' şarkı' +
          (tracks.skipped ? ' · ' + tracks.skipped + ' atlandı' : ''),
          { contextUri: 'spotify:playlist:' + playlistId });
      })
      .catch(apiFail);
  }

  function requireLogin() {
    if (hasSpotify() && Spotify.isLoggedIn()) return false;
    setTip('önce Spotify’a giriş yap');
    return true;
  }

  function apiFail(err) {
    setTip('hata: ' + String(err.message || err).slice(0, 34));
    console.warn('[spotify]', err);
  }

  /* ---------------- liste ---------------- */
  function renderList() {
    dom.list.innerHTML = '';
    dom.empty.hidden = state.shown.length > 0;

    state.shown.forEach(function (t, i) {
      var li = document.createElement('li');
      li.className = 'item' + (i === state.sel ? ' sel' : '');
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', i === state.sel ? 'true' : 'false');
      li.innerHTML =
        '<span class="num">' + (i + 1) + '</span>' +
        '<span class="txt"><span class="title"></span><span class="artist"></span></span>';
      li.querySelector('.title').textContent = t.title;
      li.querySelector('.artist').textContent = t.artist || t.album || '';
      li.addEventListener('click', function () { state.sel = i; openSelected(); });
      dom.list.appendChild(li);
    });

    scrollToSel();
  }

  function scrollToSel() {
    var node = dom.list.children[state.sel];
    if (node && node.scrollIntoView) {
      node.scrollIntoView({ block: 'nearest' });
    }
  }

  function moveSel(delta) {
    if (!state.shown.length) return;
    state.sel = (state.sel + delta + state.shown.length) % state.shown.length;
    renderList();
  }

  function refreshView() {
    if (state.source === 'playlists') { openPlaylists(); return; }
    if (state.source === 'search') { runSearch(); return; }
    openSaved();
  }

  function openSelected() {
    var t = state.shown[state.sel];
    if (!t) return;

    if (state.source === 'playlists') {
      if (t.id === '__search') { openSearchPanel(); return; }
      openPlaylist(t.id);
      return;
    }
    openPlayer(t, state.sel);
  }

  /* ---------------- oynatici ---------------- */

  /* Calma baglami: playlist ise context_uri, arama/favori ise uri listesi
     (50'ye kadar, secili sarki pencereye alinir). */
  function buildCtx(track, index) {
    if (state.listCtx && state.listCtx.contextUri) {
      return { context_uri: state.listCtx.contextUri, offset: { uri: 'spotify:track:' + track.id } };
    }
    var ids = [];
    var start = Math.max(0, Math.min(index, state.shown.length - 50));
    var end = Math.min(state.shown.length, start + 50);
    for (var i = start; i < end; i++) {
      if (state.shown[i] && state.shown[i].id) ids.push('spotify:track:' + state.shown[i].id);
    }
    var offset = ids.indexOf('spotify:track:' + track.id);
    if (offset < 0) { ids.unshift('spotify:track:' + track.id); offset = 0; }
    return { uris: ids, offset: { position: offset } };
  }

  function openPlayer(track, index) {
    state.current = track;
    state.view = 'player';
    state.actionSel = 0;

    dom.viewList.hidden = true;
    dom.viewPlayer.hidden = false;
    dom.nowTitle.textContent = track.title;
    dom.nowArtist.textContent = track.artist || '';

    state.play.track = track;
    state.play.ctx = buildCtx(track, index);
    state.play.mode = 'sdk';
    state.play.paused = true;
    state.play.posMs = 0;
    state.play.durMs = track.duration_ms || 0;
    state.play.fav = null;

    /* onceki embed sesini kes (cift calma olmasin) */
    dom.embed.innerHTML = '';

    /* streaming izni eski oturumda yok -> SDK calismaz, direkt embed */
    if (hasSpotify() && Spotify.hasStreaming && !Spotify.hasStreaming()) {
      embedFallback(track, '⚠ eski oturum — Esc → çıkış + giriş (30sn embed)');
      return;
    }

    var body = {};
    if (state.play.ctx.context_uri) {
      body.context_uri = state.play.ctx.context_uri;
      body.offset = state.play.ctx.offset;
    } else {
      body.uris = state.play.ctx.uris;
      body.offset = state.play.ctx.offset;
    }

    /* SDK'yi kesin tetikle (ilkinde baglanti ~12 sn surebilir) */
    Spotify.playerPlay(body)
      .then(function () {
        state.play.mode = 'sdk';
        setTip('tam parça çalıyor · ◀▶ sarma');
      })
      .catch(function (err) {
        console.warn('[playback] sdk yok:', err.message);
        embedFallback(track, 'SDK yok — embed ile oynatılıyor');
      });

    buildActions();
    checkFav();
  }

  function embedFallback(track, note) {
    state.play.mode = 'embed';
    dom.embed.innerHTML = '';
    var src = 'https://open.spotify.com/embed/track/' + encodeURIComponent(track.id) +
      '?utm_source=generator&theme=0';
    var f = document.createElement('iframe');
    f.src = src;
    f.allow = 'autoplay; encrypted-media; clipboard-write';
    f.loading = 'lazy';
    f.title = 'Spotify ' + track.title;
    dom.embed.appendChild(f);
    dom.progress.hidden = true;
    buildActions();
    setTip(note || 'embed modu · sarma yok');
  }

  /* SDK durum degisikligini dinle (app.js kapanis kisminda baglanir) */
  function onSdkState(s) {
    if (!s || state.play.mode !== 'sdk') return;
    state.play.paused = s.paused;
    state.play.posMs = s.position || 0;
    state.play.durMs = (s.track_window && s.track_window.current_track &&
      s.track_window.current_track.duration_ms) || state.play.durMs;
    var cur = s.track_window && s.track_window.current_track;
    if (cur) {
      var artists = (cur.artists || []).map(function (a) { return a.name; }).join(', ');
      if (cur.name && state.current && cur.name !== state.current.title) {
        state.current = { id: cur.id, title: cur.name, artist: artists, url: cur.uri };
        dom.nowTitle.textContent = cur.name;
        dom.nowArtist.textContent = artists;
      }
    }
    paintProgress();
    refreshActionLabels();
  }

  function tick() {
    if (state.view !== 'player' || state.play.mode !== 'sdk') return;
    if (!state.play.paused && state.play.posMs < state.play.durMs) {
      var now = Date.now();
      var dt = state.play.lastTick ? now - state.play.lastTick : 0;
      state.play.lastTick = now;
      state.play.posMs = Math.min(state.play.durMs, state.play.posMs + dt);
    } else {
      state.play.lastTick = Date.now();
    }
    paintProgress();
  }

  function fmt(ms) {
    if (!ms || ms < 0) ms = 0;
    var s = Math.floor(ms / 1000);
    return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  }

  function paintProgress() {
    if (state.play.mode !== 'sdk') return;
    dom.progress.hidden = false;
    var pct = state.play.durMs ? Math.round(100 * state.play.posMs / state.play.durMs) : 0;
    dom.pfill.style.width = pct + '%';
    dom.ptime.textContent = fmt(state.play.posMs) + ' / ' + fmt(state.play.durMs) +
      (state.play.paused ? ' · ❚❚' : '');
  }

  function buildActions() {
    var sdk = state.play.mode === 'sdk';
    var items = [];
    if (sdk) {
      items.push({ id: 'toggle', label: state.play.paused ? '▶ Devam et' : '❚❚ Duraklat' });
      items.push({ id: 'back10', label: '⏪ 10 sn geri' });
      items.push({ id: 'fwd10', label: '⏩ 10 sn ileri' });
      items.push({ id: 'next', label: '⏭ Sonraki' });
      items.push({ id: 'prev', label: '⏮ Önceki' });
    } else {
      items.push({ id: 'hint', label: '⚠ Embed: 30 sn sınırlı · sarma yok' });
    }
    items.push({ id: 'fav', label: '♥ Favorilerim (Spotify)' });
    items.push({ id: 'open', label: '↗ Spotify’da aç' });

    dom.actions.innerHTML = '';
    items.forEach(function (it, i) {
      var li = document.createElement('li');
      li.className = i === state.actionSel ? 'sel' : '';
      li.textContent = it.label;
      li.addEventListener('click', function () { state.actionSel = i; runAction(it.id); });
      dom.actions.appendChild(li);
    });
    state.actionItems = items;
  }

  function refreshActionLabels() {
    if (state.play.mode !== 'sdk') return;
    state.actionItems.forEach(function (it) {
      if (it.id === 'toggle') {
        it.label = state.play.paused ? '▶ Devam et' : '❚❚ Duraklat';
      } else if (it.id === 'fav') {
        it.label = state.play.fav ? '♥ Favoride — çıkar' : '♥ Favorilerim (Spotify)';
      }
    });
    var lis = dom.actions.children;
    for (var i = 0; i < lis.length; i++) {
      if (state.actionItems[i]) lis[i].textContent = state.actionItems[i].label;
      lis[i].className = i === state.actionSel ? 'sel' : '';
    }
  }

  function seek(deltaMs) {
    if (state.play.mode !== 'sdk') { setTip('sarma sadece SDK modunda'); return; }
    var target = Math.max(0, Math.min(state.play.durMs || 999999, state.play.posMs + deltaMs));
    state.play.posMs = target;
    paintProgress();
    Spotify.playerSeek(target)
      .then(function () { setTip(deltaMs > 0 ? '+10 sn' : '−10 sn'); })
      .catch(function (err) { apiFail(err); });
  }

  function checkFav() {
    var t = state.play.track;
    if (!t || !t.id || state.play.fav !== null) return;
    Spotify.savedContains(t.id)
      .then(function (has) {
        state.play.fav = has;
        refreshActionLabels();
      })
      .catch(function () { /* sessiz */ });
  }

  function toggleFavTrack(track) {
    if (!track || !track.id) return;
    var op = state.play.fav ? Spotify.removeTrack(track.id) : Spotify.saveTrack(track.id);
    op.then(function () {
      state.play.fav = !state.play.fav;
      setTip(state.play.fav ? 'Spotify favorilerine eklendi' : 'Spotify favorilerinden çıkarıldı');
      refreshActionLabels();
    }).catch(function (err) {
      setTip(String(err.message || err).slice(0, 34));
    });
  }

  function runAction(id) {
    var t = state.play.track;
    if (!t) return;

    if (id === 'hint') return;
    if (id === 'toggle') {
      if (state.play.paused) {
        Spotify.playerResume()
          .then(function () { state.play.paused = false; state.play.lastTick = Date.now(); refreshActionLabels(); })
          .catch(apiFail);
      } else {
        Spotify.playerToggle()
          .then(function () { state.play.paused = true; refreshActionLabels(); })
          .catch(apiFail);
      }
    } else if (id === 'back10') {
      seek(-SEEK_MS);
    } else if (id === 'fwd10') {
      seek(SEEK_MS);
    } else if (id === 'next') {
      Spotify.playerNext()
        .then(function () { setTip('sonraki…'); })
        .catch(apiFail);
    } else if (id === 'prev') {
      Spotify.playerPrevious()
        .then(function () { setTip('önceki…'); })
        .catch(apiFail);
    } else if (id === 'fav') {
      toggleFavTrack(t);
    } else if (id === 'open') {
      window.open(t.url || ('https://open.spotify.com/track/' + t.id), '_blank');
    }
  }

  /* ---------------- menu (LSK) ---------------- */
  function menuItems() {
    var items = [];
    if (hasSpotify() && Spotify.isLoggedIn()) {
      items.push({ id: 'playlists', label: 'Çalış listelerim' });
      items.push({ id: 'saved', label: 'Favorilerim (Spotify)' });
      items.push({ id: 'logout', label: 'Spotify çıkış' });
    } else if (hasSpotify() && Spotify.configured()) {
      items.push({ id: 'login', label: 'Spotify’a giriş yap' });
    } else {
      items.push({ id: 'login', label: 'Spotify girişi (kurulum gerekli)', disabled: true });
    }
    items.push({ id: 'search', label: 'Ara' });
    items.push({ id: 'info', label: 'Hakkında' });
    if (hasSpotify() && Spotify.isLoggedIn()) {
      items.push({ id: 'apitest', label: 'API testi (teşhis)' });
    }
    return items;
  }

  function openMenu() {
    state.overlay = 'menu';
    state.menuSel = 0;
    var items = menuItems();
    dom.menuList.innerHTML = '';
    items.forEach(function (it, i) {
      var li = document.createElement('li');
      li.className = i === 0 ? 'sel' : '';
      li.textContent = it.label;
      if (it.disabled) li.style.color = '#666';
      li.addEventListener('click', function () { state.menuSel = i; runMenu(it.id); });
      dom.menuList.appendChild(li);
    });
    dom.menu.hidden = false;
    setTip('↑↓ seç · Enter onay');
  }

  function closeOverlay() {
    state.overlay = null;
    dom.menu.hidden = true;
    dom.search.hidden = true;
    dom.info.hidden = true;
    setTip(state.view === 'player' ? '↑↓ eylem · ◀▶ sarma' : '↑↓ seç · Enter aç');
  }

  function runMenu(id) {
    if (id === 'login') {
      closeOverlay();
      loginToSpotify();
      return;
    }
    if (id === 'logout') {
      closeOverlay();
      if (hasSpotify()) Spotify.logout();
      state.user = null;
      dom.hint.textContent = 'Çıkış yapıldı';
      setTip('Spotify çıkış yapıldı — LSK menü → giriş');
      return;
    }
    if (id === 'playlists') { closeOverlay(); toList(); openPlaylists(); return; }
    if (id === 'saved') { closeOverlay(); toList(); openSaved(); return; }
    if (id === 'search') { closeOverlay(); openSearchPanel(); return; }
    if (id === 'info') {
      closeOverlay();
      showInfo();
      return;
    }
    if (id === 'apitest') {
      runApiTest();
      return;
    }
  }

  function openSearchPanel() {
    state.overlay = 'search';
    state.query = '';
    dom.qtext.textContent = '';
    dom.search.hidden = false;
    setTip('0-9 yaz · Enter ara');
  }

  function toList() {
    state.view = 'list';
    dom.viewPlayer.hidden = true;
    dom.viewList.hidden = false;
    /* dikkat: embed temizlenmez — liste gezinirken muzik calismaya devam eder */
  }

  /* Teşhis: gerçek Spotify yanıtlarını panelde gösterir */
  function runApiTest() {
    closeOverlay();
    if (!hasSpotify()) return;

    state.overlay = 'info';
    dom.info.hidden = false;
    dom.infoBody.innerHTML = '';
    setTip('test çalışıyor…');

    var addRow = function (k, v) {
      var row = document.createElement('div');
      row.className = 'row';
      var kk = document.createElement('div');
      kk.className = 'k';
      kk.textContent = k;
      var vv = document.createElement('div');
      vv.className = 'v';
      vv.textContent = v;
      row.appendChild(kk);
      row.appendChild(vv);
      dom.infoBody.appendChild(row);
      return vv;
    };

    if (!Spotify.isLoggedIn()) {
      addRow('Oturum', 'kapalı — önce giriş yap');
      setTip('test bitti');
      return;
    }

    addRow('Oynatma motoru',
      Spotify.playerDeviceId() ? 'SDK hazır (tam parça + sarma)' :
      (Spotify.hasStreaming && Spotify.hasStreaming() ? 'SDK bağlanıyor…' :
      'streaming izni YOK → embed 30 sn — çıkış+giriş yap'));

    Spotify.getProfile()
      .then(function (p) {
        addRow('Profil', p.name + ' (id=' + p.id + ')');
        return Spotify.myPlaylists().then(function (lists) {
          var own = lists.filter(function (l) { return l.ownerId === p.id; });
          addRow('me/playlists', lists.length + ' liste · ' + own.length + ' kendi listen');

          /* kendi listelerinden toplami en buyuk 3 tanesini test et */
          var cands = own.slice()
            .sort(function (a, b) { return (b.trackCount || 0) - (a.trackCount || 0); })
            .slice(0, 3);
          if (!cands.length) {
            addRow('Kendi liste', 'yok — test atlandi');
            return;
          }
          var chain = Promise.resolve();
          cands.forEach(function (l) {
            chain = chain.then(function () {
              var vv = addRow('▸ ' + String(l.title).slice(0, 20), 'total=' + l.trackCount + ' · okunuyor…');
              return Spotify.playlistTracks(l.id)
                .then(function (tr) {
                  vv.textContent = 'total=' + l.trackCount + ' → ' + tr.length +
                    ' okundu · ' + (tr.used || '-') + ' · atlanan=' + (tr.skipped || 0);
                })
                .catch(function (e) {
                  vv.textContent = 'total=' + l.trackCount + ' → HATA ' + e.message;
                });
            });
          });
          return chain;
        });
      })
      .catch(function (e) { addRow('Profil', 'HATA ' + e.message); });

    Spotify.savedTracks()
      .then(function (tr) { addRow('me/tracks (Favorilerim)', tr.length + ' şarkı'); })
      .catch(function (e) { addRow('me/tracks (Favorilerim)', 'HATA ' + e.message); });

    setTip('test bitti');
  }

  /* Bilgi paneli: gonderilen redirect_uri dashboard ile karsilastirmak icin */
  function showInfo() {
    var host = location.hostname;
    var rows = [
      ['Widget adresi', location.href],
      ['Redirect URI', hasSpotify() ? Spotify.redirectUri() : '-'],
      ['Client ID', hasSpotify() ? Spotify.clientId() : '-'],
      ['Oturum', hasSpotify() && Spotify.isLoggedIn() ? 'acik' : 'kapali'],
      ['Oynatma', 'tam parça (SDK) veya embed'],
      ['Versiyon', 'v2 - Cloud Phone widget']
    ];

    /* localhost ile acildiysa uyari goster: Spotify localhost kaydini reddeder */
    if (host === 'localhost') {
      rows.splice(2, 0, ['! UYARI', 'Yerel testte http://127.0.0.1:8080/index.html adresini kullan']);
    }

    dom.infoBody.innerHTML = '';
    rows.forEach(function (r) {
      var row = document.createElement('div');
      row.className = 'row';
      var k = document.createElement('div');
      k.className = 'k';
      k.textContent = r[0];
      var v = document.createElement('div');
      v.className = 'v';
      v.textContent = r[1];
      row.appendChild(k);
      row.appendChild(v);
      dom.infoBody.appendChild(row);
    });
    state.overlay = 'info';
    dom.info.hidden = false;
    setTip('Esc ile kapat');
  }

  /* ---------------- arama (coklu tus) ---------------- */
  function tapPush(key) {
    var now = Date.now();
    if (state.tap.key === key && now - state.tap.at <= MULTITAP_MS) {
      state.tap.idx = (state.tap.idx + 1) % KEYMAP[key].length;
      state.query = state.query.slice(0, -1); /* onceki harfi degistir */
    } else {
      state.tap = { key: key, at: now, idx: 0 };
    }
    state.tap.at = now;
    state.query += KEYMAP[key][state.tap.idx];
    dom.qtext.textContent = state.query;
  }

  function runSearch() {
    var q = state.query.trim();
    if (!q) { setTip('bir şeyler yaz'); return; }
    if (requireLogin()) { return; }

    setTip('aranıyor…');
    Spotify.searchTracks(q)
      .then(function (tracks) {
        state.source = 'search';
        state.shown = tracks;
        state.sel = 0;
        state.listCtx = null;
        dom.hint.textContent = '"' + q + '" · ' + tracks.length + ' sonuç';
        renderList();
        closeOverlay();
        setTip('↑↓ seç · Enter aç');
        setNet(true);
      })
      .catch(apiFail);
  }

  /* ---------------- klavye ----------------
     Cloud Phone tuş haritasi:
       LSK  -> Escape   (menu acilir)
       RSK  -> back eventi / history.back()
       Enter-> Enter
       yon  -> ArrowUp / ArrowDown / ArrowLeft / ArrowRight
       rakam-> 0-9, '*', '#'
   ------------------------------------------ */
  function onKey(e) {
    var k = e.key;

    /* LSK = Escape */
    if (k === 'Escape') {
      if (state.overlay) { closeOverlay(); } else { openMenu(); }
      e.preventDefault();
      return;
    }

    if (state.overlay === 'info') {
      if (k === 'Enter') { closeOverlay(); }
      e.preventDefault();
      return;
    }

    if (state.overlay === 'menu') {
      if (k === 'ArrowDown') { state.menuSel = (state.menuSel + 1) % menuItems().length; paintMenu(); }
      else if (k === 'ArrowUp') { state.menuSel = (state.menuSel + menuItems().length - 1) % menuItems().length; paintMenu(); }
      else if (k === 'Enter') { runMenu(menuItems()[state.menuSel].id); }
      e.preventDefault();
      return;
    }

    if (state.overlay === 'search') {
      if (KEYMAP[k]) { tapPush(k); }
      else if (k === '0') { state.query += ' '; dom.qtext.textContent = state.query; state.tap = { key: '', at: 0, idx: 0 }; }
      else if (k === '*' || k === 'Backspace') { state.query = state.query.slice(0, -1); dom.qtext.textContent = state.query; state.tap = { key: '', at: 0, idx: 0 }; }
      else if (k === '#') { state.query = ''; dom.qtext.textContent = ''; state.tap = { key: '', at: 0, idx: 0 }; }
      else if (k === 'Enter') { runSearch(); }
      e.preventDefault();
      return;
    }

    if (state.view === 'player') {
      var n = state.actionItems.length;
      if (k === 'ArrowDown') { state.actionSel = (state.actionSel + 1) % Math.max(n, 1); refreshActionLabels(); }
      else if (k === 'ArrowUp') { state.actionSel = (state.actionSel + n - 1) % Math.max(n, 1); refreshActionLabels(); }
      /* ◀▶ = ileri/geri sarma (10 sn) */
      else if (k === 'ArrowLeft') { seek(-SEEK_MS); }
      else if (k === 'ArrowRight') { seek(SEEK_MS); }
      else if (k === 'Enter') { runAction(state.actionItems[state.actionSel].id); }
      e.preventDefault();
      return;
    }

    /* liste ekrani */
    if (k === 'ArrowDown') { moveSel(1); }
    else if (k === 'ArrowUp') { moveSel(-1); }
    else if (k === 'Enter') { openSelected(); }
    else if (k === '*') { setTip('yenileniyor…'); refreshView(); }
    else if (k === '#') {
      /* Spotify favorilerine ekle/cikar (sadece sarki listelerinde) */
      var t = state.shown[state.sel];
      if (t && t.id && state.source !== 'playlists') {
        var fav = null;
        Spotify.savedContains(t.id).then(function (has) {
          fav = has;
          return has ? Spotify.removeTrack(t.id) : Spotify.saveTrack(t.id);
        }).then(function () {
          renderList();
          setTip(fav ? 'Spotify favorilerinden çıkarıldı' : 'Spotify favorilerine eklendi');
        }).catch(function (err) { apiFail(err); });
      }
    }
    e.preventDefault();
  }

  /* RSK: once overlay, sonra oynatici ekrani; yoksa varsayilan (cikis) */
  function onBack(e) {
    if (state.overlay) { e.preventDefault(); closeOverlay(); return; }
    if (state.view === 'player') {
      e.preventDefault();
      toList();
      setTip('↑↓ seç · Enter aç');
    }
  }

  function paintMenu() {
    var lis = dom.menuList.children;
    for (var i = 0; i < lis.length; i++) {
      lis[i].className = i === state.menuSel ? 'sel' : '';
    }
  }

  function goBack() {
    if (state.overlay) { closeOverlay(); return; }
    if (state.view === 'player') {
      toList();
      setTip('↑↓ seç · Enter aç');
    } else {
      history.back();
    }
  }

  /* SDK durum dinleyicisi init() icinde baglanir */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();