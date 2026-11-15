# Spotify — Cloud Phone Widget

Cloud Phone (CloudMosa) özellikli telefonlarda çalışan **Spotify widget** projesi.
Telefon 240x320 (QVGA) ve 128x160 (QQVGA) ekranlarına, dokunmatik olmadan
(yön tuşları + Enter + T9 rakamları) kullanılmak üzere tasarlandı.

**Hedef cihaz: Nokia 235 4G** — 2.8" QVGA (240×320) ekran, tuş takımı
(D-pad + LSK/RSK + Enter + rakamlar). Birincil hedef QVGA; `compact` (128×160)
QQVGA modu başka modeller içindir. Resmi Cloud Phone geliştirici notları:
`dev/CLOUDPHONE-NOTES.md`.

```
cloudphone-spotify-widget/
├── index.html            # Widget ekranı (liste / oynatıcı / arama / menü)
├── css/style.css         # QVGA + QQVGA tasarım, odak (focus) stilleri
├── js/app.js             # Tuş yönetimi, T9 arama, Spotify oynatıcı (SDK/embed)
├── js/spotify.js         # PKCE giriş, Web API istemcisi, Web Playback SDK
├── js/config.js          # Client ID + redirect URI + izinler
├── assets/icon-80.png    # Widget ikonu (80x80 PNG, 626 bayt)
├── api/server.py         # Yerel test sunucusu (python api/server.py → :8080)
├── dev/preview.html      # 240x320 ve 128x160 önizleme sayfası
├── dev/CLOUDPHONE-NOTES.md  # Resmi Cloud Phone geliştirici notları (kaynak doküman)
├── deploy-github-pages.ps1  # Tek komutla GitHub Pages yayını
└── README.md
```

---

## 0. Yapman gerekenler (checklist)

| # | İş | Nerede | Süre |
|---|---|---|---|
| 1 | Kodu bir **HTTPS** adresine yayınla (GitHub Pages / Cloudflare Pages) | GitHub → Settings → Pages | 10 dk |
| 2 | **Spotify Developer** uygulaması oluştur, Client ID al | developer.spotify.com/dashboard | 10 dk |
| 3 | Redirect URI'yi dashboard'a **birebir** yaz | `js/config.js` | 2 dk |
| 4 | cloudphone.tech/my → widget'i kaydet (Name + URL + 80x80 ikon) | cloudphone.tech/my | 5 dk |
| 5 | Telefonun **IMEI**'sini listeye ekle, Cloud Phone uygulamasını yeniden aç | cloudphone.tech/my | 5 dk |
| 6 | Telefonda **Developer Mode** aç (LSK → About → LSK×7 → Yes) | telefon | 2 dk |
| 7 | **Simulator**'da test et (cloudphone.tech/my/simulator) | tarayıcı | 15 dk |
| 8 | Yayınlamak için **Contact Us** formunu doldur | cloudphone.tech | 2 dk |

Adım 2 ve 3 olmadan da widget çalışır; o durumda sadece **popüler liste** görünür
ve giriş yapılamaz. Adım 2-3 ile **Çalış Listelerim / Favorilerim / canlı arama**
açılır ve **Premium** hesabınla tam parça çalınır.

---


Cloud Phone widget = **internetten HTTPS ile servis edilen bir web uygulaması**.
Telefona APK/EXE yüklenmez; Cloud Phone sunucusu sayfayı işler, ekrana basar.
Bir widget'in üç zorunlu parçası vardır:

| Zorunlu | Değer | Burada |
|---|---|---|
| **URL** | HTTPS adresi (HTTP çalışmaz) | `https://<kullanici>.github.io/spotify-widget/` |
| **İkon** | 80x80 PNG, ≤ 1 MB | `assets/icon-80.png` |
| **İsim** | ≤ 10 karakter | `Spotify` |

> `manifest.json` **gerekli değil** — Cloud Phone manifest dosyalarını yok sayar.
> Widget her zaman çevrimiçi çalışır (offline destek yok).

---

## 2. Lokal geliştirme

```bash
cd cloudphone-spotify-widget
python api/server.py            # http://localhost:8080
```

Tarayıcıda `http://localhost:8080` → widget çalışır.
Ekran boyutlarını görmek için: **http://localhost:8080/dev/preview.html**
(240x320 ve 128x160 yan yana).

Chrome'da hızlı test:
1. F12 → device toolbar (Ctrl+Shift+M) → Responsive
2. Width/Height: `240x320` veya `128x160`
3. Klavye: yön tuşları, Enter, `0-9`, `*`, `#`, `Esc`

### Gerçek Spotify verisi (isteğe bağlı)

`api/server.py` Spotify Web API proxy'sidir. Kimlik bilgisi verilirse
`/api/playlist/default` ve `/api/search?q=` gerçek veri döner:

```bash
# Windows
set SPOTIFY_CLIENT_ID=xxxx
set SPOTIFY_CLIENT_SECRET=yyyy
python api/server.py

# macOS / Linux
export SPOTIFY_CLIENT_ID=xxxx
export SPOTIFY_CLIENT_SECRET=yyyy
python api/server.py
```

Kimlik bilgisi yoksa proxy 404 döner, widget otomatik olarak
`data/tracks.json` dosyasına düşer → **kredi olmadan da çalışır**.

---

## 3. Cloud Phone'a ekleme (adım adım)

### 3.1 Widget'ı HTTPS'e yayınla

Cloud Phone yalnızca HTTPS kabul eder. GitHub Pages için (script ile tek adım):

```powershell
cd C:\Users\Safer\Desktop\spotify\cloudphone-spotify-widget
.\deploy-github-pages.ps1 -RepoUrl https://github.com/<KULLANICI>/spotify-widget.git
```

Script; `git init` → commit → remote → push yapar ve sonunda yapılacak 2 adımı
(Repo → Settings → Pages ve Spotify redirect URI) yazdırır.

Elle yapmak istersen:
- **GitHub Pages**: boş bir repo oluştur → Settings → Pages → `main` / `root`
  → URL: `https://<kullanici>.github.io/<repo>/`
- **Cloudflare Pages / Netlify**: klasörü sürükle-bırak, HTTPS otomatik.

> Sayfa kökü olarak `index.html` yayınlanmalı; alt klasör yayınlarsanız
> göreli yollar (`css/...`, `js/...`) bozulur.

### 3.2 Developer Program hesabı

1. **https://cloudphone.tech/my** adresine git (ücretsiz, sadece e-posta).
2. Giriş yap → **Widget List** bölümünde `+` ile yeni widget ekle.
3. Şu 3 alanı doldur:
   - **Name**: `Spotify` (≤10 karakter)
   - **URL**: `https://<kullanici>.github.io/<repo>/`
   - **Icon**: `assets/icon-80.png` (80x80 PNG)
4. Kaydet. Yayınlanmamış widget, IMEI listesindeki cihazlarda 🔧 (anahtar)
   simgesiyle ana ekranın **en altında** görünür.

### 3.3 Telefonu listeye ekle (IMEI)

1. Telefonda **`*#06#`** tuşlayarak IMEI numarasını öğrenin.
2. cloudphone.tech/my → **IMEI List** → `+` → `+` → numarayı virgülle ayırarak
   yazın (tek seferde 100 IMEI) → **Add**.
3. Telefonda **Cloud Phone uygulamasını kapatıp yeniden açın** (widget listesi
   ancak o zaman yenilenir).

### 3.4 Developer Mode (telefonda)

Telefon ana ekranından:

1. **LSK** (sol yumuşak tuş) → **Settings**
2. **About**
3. **LSK'e 7 kez bas**
4. **LSK → Yes** (onay)

Widget artık ana ekranda 🔧 simgesiyle görünür.

> **Developer Mode'u kapatmak** için aynı adımları tekrarla
> (LSK → Settings → About → LSK×7 → onay).

### 3.5 Simulator'da test (telefon gerekmez)

**https://cloudphone.tech/my/simulator** → widget'ı çalıştırın. Simulator
yalnızca **Google Chrome** ile çalışır; çözünürlük seçilebilir (QVGA/QQVGA
kontrolü burada yapılır). Gömülü **Cloud Phone Debugger**, Chrome DevTools
benzeri paneller sunar:

- **Elements** – HTML/CSS incele, anlık düzelt
- **Console** – `console.log` çıktıları, hata ayıklama
- **Network** – fetch/XHR/JS/CSS/font/medya ve WebSocket istekleri
- **Performance / Lighthouse** – LCP/INP metrikleri, erişilebilirlik denetimi
- **Sources** – kaynak dosyaları görüntüle/düzenle, JS breakpoint
- **Memory** – bellek profili ve sızıntı analizi
- **Application** – localStorage, cache, manifest, service worker

Simulator'ın sınırları: **Volume Manager desteklenmez**, `getUserMedia`
(mikrofon/kamera) yok, `<input type="file">` ve `<a download>` desteklenmiyor.

### 3.6 Yayınlama (publish)

Widget'ı herkese açmak için **Contact Us** formunu doldurun. Cloud Phone önce
QVGA/QQVGA testlerini yapar, sonra partner'lara dağıtır. Test listesi:
tüm içerik okunabilir olmalı, tüm ülkelerde/saat dilimlerinde çalışmalı,
birden fazla dil hazır olmalı, **IPv6-only APN** ile çalışmalı.

---

## 4. Tuş haritası (widget içinde)

| Tuş | İşlev |
|---|---|
| `↑` `↓` | Listede/menüde gezinme (basa basa sarar) |
| `Enter` | Seçili öğeyi aç / menüde onayla |
| `Esc` = **LSK** | Seçenek menüsünü açar (açıkken kapatır) |
| **RSK** | Geri: menüyü kapat → oynatıcıdan listeye dön → çıkış |
| `0-9` | T9 çoklu tuşla arama (2=abc … 9=wxyz), `0`=boşluk |
| `*` | Arama alanında sil / listede yenile |
| `#` | Listede seçili şarkıyı favoriye ekle/çıkar |

---

## 5. Spotify tarafı: hangi yöntem?

### 5.1 Spotify girişi (PKCE) — Premium için gerekli

Embed oynatıcının tam parça çalabilmesi için tarayıcıda **Spotify oturumu**
açık olmalı. Widget bunu kendi yapar (client secret gerekmez):

1. **https://developer.spotify.com/dashboard** → *Create app* → ad ver
   (örn. `CloudPhoneWidget`) → **Client ID**'yi kopyala
2. Dashboard → *Settings* → **Redirect URIs** → widget adresini **birebir**
   ekle: `https://<kullanici>.github.io/<repo>/`
   Yerelde test edeceksen ayrıca **loopback IP** ekle (Spotify 2025'ten beri
   `localhost` kaydını reddeder — "This redirect URI is not secure"):
   `http://127.0.0.1:8080/index.html`
   > `http://127.0.0.1` (portsuz) da reddedilir; **port** şart.
   > Yerel testte widget'ı `http://127.0.0.1:8080/index.html` adresinden aç
   > (`localhost` değil) — aksi halde PKCE doğrulayıcısı farklı origin'de
   > kalır ve token değişimi başarısız olur.
3. `js/config.js` içine yaz:

   ```js
   window.SPOTIFY_CONFIG = {
     clientId: 'BURAYA_CLIENT_ID',
     redirectUri: 'https://<kullanici>.github.io/<repo>/',
     scopes: 'user-read-email user-read-private playlist-read-private user-library-read'
   };
   ```

4. Widget'ta **LSK (Esc) → "Spotify'a giriş yap"** → Spotify login sayfası
   açılır → giriş yap → otomatik olarak widget'a döner, token kaydedilir.
   Artık menüde **Çalış listelerim** ve **Favorilerim (Spotify)** çıkar ve
   arama canlı Spotify API'sine gider.

Notlar:
- Spotify dashboard'da uygulama "Development Mode" ise **yalnızca eklediğin
  kullanıcılara** (Spotify hesabı e-posta listesi) izin verir. Kendi
  hesabını `Users` sekmesinden ekle.
- Token'lar `localStorage`'da saklanır (`sp.token.v1`), cihazda kalıcıdır.
- Giriş `accounts.spotify.com` üzerinden yapıldığı için aynı tarayıcı
  oturumunda **embed oynatıcı da oturum açık olur** → Premium ile tam parça
  çalar.

### 5.2 Diğer yöntemler


| Yöntem | Durum |
|---|---|
| **Spotify Embed iframe** (`open.spotify.com/embed/track/<id>`) | Widget'ta kullanıldı. Anahtar/hesap gerekmez, iframe'e gömülebilir, `<iframe>` `X-Frame-Options` engeli yok. |
| **Spotify Web API** (`api.spotify.com/v1`) | PKCE ile tarayıcıdan doğrudan (`js/spotify.js`) veya `api/server.py` proxy ile. Aramada **30 sn `preview_url`** dönerse widget'ta doğrudan `<audio>` ile çalar — tuşlu telefon için en güvenilir yöntem. |
| **Web player'ı iframe'e koymak** (`open.spotify.com/embed/playlist/...`) | Spotify'nun kendi arayüzü dokunmatik için tasarlandığı için 240 px genişlikte kullanımı zor; widget kendi listesini çiziyor, embed sadece çalınan parçayı gösteriyor. |

Dikkat edilecekler:

- **Premium gerekir.** Ücretsiz hesapla embed oynatıcıda tam parça çalmaz
  (reklam/önizleme sınırı). Widget'in "Önizleme (30 sn)" seçeneği
  `preview_url` varsa reklamsız 30 saniyelik parça çalar.
- Embed oynatıcının kendi play düğmesi **dokunmatik** içindir. Cloud Phone'da
  en güvenilir yol: widget listesinden şarkı seç → `Önizleme`/`Spotify'da aç`.
- **ToS:** Spotify içeriğini kopyalama/indirme yapan bir widget yayınlanamaz.
  Resmî Embed ve Web API kullanımı içindir.
- `preview_url` Spotify tarafında yeni uygulamalara kısmen kaldırılmış olabilir;
  yoksa oynatıcı yalnızca embed gösterir.

---

## 6. Sık karşılaşılan sorunlar

| Belirti | Sebep / Çözüm |
|---|---|
| Widget ana ekranda yok | IMEI listeye eklenmemiş **ve** Cloud Phone uygulaması yeniden başlatılmamış |
| Widget açılıyor ama HTTP hatası | URL `https://` olmalı; `http://` ve `localhost` çalışmaz |
| **Spotify login: "Not matching configuration"** | Dashboard'daki redirect URI ile widget'ın gönderdiği URI birebir eşleşmiyor. Widget → **Esc → Hakkında** → "Redirect URI" satırını dashboard'dakiyle **harf harf** karşılaştır. Sondaki `/` bile fark eder. |
| **Dashboard: "This redirect URI is not secure"** | Spotify `localhost` kaydını reddediyor. Loopback IP + port kullan: `http://127.0.0.1:8080/index.html` (portsuz `http://127.0.0.1` de reddedilir). |
| Login sonrası "redirect_uri mismatch" / doğrulayıcı yok | Widget'ı `localhost` ile değil `127.0.0.1` ile aç — PKCE doğrulayıcısı origin'e bağlıdır. |
| Login "app is in development mode" hatası | Spotify Dashboard → **Users** sekmesine kendi Spotify e-postanı ekle |
| Login sonrası "redirect_uri mismatch" | Adres çubuğundaki URL ile dashboard'daki URI farklı (örn. `/repo` vs `/repo/`) — adres çubuğundaki **son** halini kopyala |
| Metin taşıyor / çok büyük | CSS px cinsinden sabit ölçü kullanın; `compact` sınıfı 180 px altında otomatik devreye girer |
| Tuşlar çalışmıyor | `keydown` dinleyicisi `document` üzerinde olmalı; odak `input`/`iframe` üzerindeyse tuşlar oraya gider |
| LSK menüyü açmıyor | Cloud Phone'da LSK = `Escape` tuşudur (`SoftLeft` değil) |
| RSK beklemeden çıkıyor | `window.addEventListener('back', ...)` kullanıp `event.preventDefault()` ile müdahale edin |
| Spotify embed boş | Spotify'ya erişim engeli olan ağlar; `preview_url` yolunu kullanın |
