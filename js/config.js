/* Spotify Web API yapilandirmasi.
   Degerleri kendi hesabiniza gore doldurun. */
window.SPOTIFY_CONFIG = {
  /* Spotify Developer Dashboard (https://developer.spotify.com/dashboard)
     -> Create app -> Client ID.  Spotify Developer hesabi ucretsizdir. */
  clientId: '851457b011f34cbf8d3e931c34306e4e',

  /* Redirect URI: Dashboard'da "Add redirect URI" ile ayni olmak ZORUNDA.
     Bos birakilirsa mevcut sayfa adresi kullanilir (yayin adresi).
     Ornek: 'https://<kullanici>.github.io/<repo>/'
     Spotify URI'leri BIREBIR karsilastirir: sonundaki "/" bile fark eder. */
  redirectUri: '',

  /* Yerel gelistirme icin kayitli URI.
     Spotify 2025'ten beri "localhost" kaydini KABUL ETMIYOR ("This redirect URI
     is not secure"). Sadece loopback IP literal + port kabul ediliyor.
     Dashboard'a AYRI olarak eklenmelidir:
        http://127.0.0.1:8080/index.html
     NOT: Tarayicida da widget'i bu adresten ac (localhost degil), yoksa
     geri donus localhost'a duser ve PKCE dogrulayicisi localStorage'da
     bulunamaz. */
  localRedirectUri: 'http://127.0.0.1:8080/index.html',

  /* Istenen izinler.
     streaming + user-*-playback-state: tam parca oynatma ve sarma
       (Web Playback SDK + Connect API, Premium gerekir).
     user-library-modify: widget icinden Spotify favorilerine ekle/cikar. */
  scopes: 'user-read-email user-read-private playlist-read-private ' +
          'user-library-read user-library-modify ' +
          'streaming user-read-playback-state user-modify-playback-state'
};
