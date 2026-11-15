# Cloud Phone — Geliştirici Notları (kaynak: developer.cloudphone.tech)

> Bu dosya resmi Cloud Phone dokümantasyonundan (Developer Tools sayfası)
> derlenmiştir — hafıza/yardım dosyası. Son güncelleme: 2026-11.

## Cihaz bilgisi

| Alan | Değer |
|---|---|
| Kullanıcının telefonu | **Nokia 235 4G** (S30+, Cloud Phone destekli) |
| Ekran | 2.8", **QVGA 240×320** |
| Girdi | Tuş takımı (D-pad + LSK/RSK + Enter + rakamlar), dokunmatik yok |
| Widget çözünürlük hedefi | QVGA 240×320 birincil; `compact` (128×160) yalnızca QQVGA modeller için |
| IMEI öğrenme | Telefonu arama ekranında `*#06#` |

## The Cloud Phone Simulator

- Adres: **https://cloudphone.tech/my/simulator**
- Ücretisiz, kayıtlı tüm geliştiricilere açık.
- Widget'ı her ülkede, her dilde ve **desteklenen tüm ekran çözünürlüklerinde**
  test etmeye yarar (çözünürlük seçilebilir → QVGA/QQVGA kontrolü burada yapılır).
- Fiziksel cihazla birebir değil; özellikle donanım ve depolama API'lerinde fark olabilir.

### Simulator'ın bilinen sınırları

- **Volume Manager desteklenmez** (ses seviyesi yönetimi etkisizdir).
- `navigator.mediaDevices.getUserMedia()` ile mikrofon/kamera erişimi yoktur.
- `<input type="file">` ile dosya yükleme ve `<a download>` ile indirme yoktur.
- Simulator **yalnızca Google Chrome** ile çalışır.

## Cloud Phone Debugger

- Simulator'un içinde, Chrome DevTools benzeri uzak hata ayıklayıcı.
- Panelleri:
  - **Elements** — HTML/CSS'i gerçek zamanlı incele/düzenle
  - **Console** — interaktif JS REPL, `console.*` çıktıları
  - **Network** — HTTPS ve WebSocket istekleri: fetch, XMLHttpRequest, CSS, JS,
    font, görsel, medya (ses/görüntü), Wasm
  - **Performance** — LCP (Largest Contentful Paint), INP (Interaction to Next Paint)
  - **Sources** — widget kaynaklarını görüntüle/düzenle, JS breakpoint koyma
  - **Lighthouse** — Performans / Erişilebilirlik / SEO / En-iyi-uygulamalar denetimi
  - **Memory** — bellek profili, sızıntı tespiti
  - **Application** — manifest, service worker, storage (localStorage), cache

Kullanım: performans darboğazı bulma, hata çözme, widget'ın beklendiği gibi
çalıştığını doğrulama.

## Developer Mode (telefonda)

Yayımlanmamış widget'ların telefonda görünmesi için gereklidir. Tüm
Cloud Phone modellerinde açılabilir.

### Açma

Cloud Phone ana ekranından:

1. **LSK** → Settings
2. **About**
3. **LSK'ye 7 kez bas**
4. **LSK → Yes** (onayla)

Açtıktan sonra telefonun IMEI numarasını cloudphone.tech/my'daki geliştirici
hesabına ekleyin. Yayımlanmamış widget'lar Cloud Phone ana sayfasının **en
altında 🔧 (anahtar) simgesiyle** görünür.

### IMEI listesine ekleme (cloudphone.tech/my)

1. Geliştirici ana sayfasında **IMEI List** yanındaki artı ( `+` ) simgesine bas.
2. Sonraki sayfada tekrar artı ( `+` ) simgesine bas.
3. Virgülle ayrılmış şekilde **tek seferde en fazla 100 IMEI** ekleyebilirsin.
4. **Add**'e bas.

Yeni IMEI eklendikten sonra telefonda **Cloud Phone uygulamasını kapatıp
yeniden aç** — yoksa widget listesi yenilenmez.

### Kapatma

Developer Mode'u kapatmak için **açmakta izlenen adımların aynısını** uygula
(LSK → Settings → About → LSK×7 → onay).

## Widget görünümı hatırlatmaları (deneyimledik)

- LSK = `Escape` klavye olayı; RSK = `back` olayı
  (`window.addEventListener('back', ...)` + `event.preventDefault()`).
- `manifest.json` Cloud Phone tarafından yok sayılır; gerekmez, offline yok.
- Widget kaydı: HTTPS URL + 80×80 PNG ikon (≤1 MB) + ad (≤10 karakter).
