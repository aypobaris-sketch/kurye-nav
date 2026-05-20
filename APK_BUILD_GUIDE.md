# 🏗️ KuryeNav Pro - APK Oluşturma Kılavuzu

Bu dokümanda KuryeNav Pro uygulamasının Android APK'sını oluşturma adımları anlatılmıştır.

## 📋 Ön Gereksinimler

1. **Node.js ve npm/pnpm kurulu** (v16+)
2. **Java Development Kit (JDK)** (v11+)
3. **Android SDK** (API Level 31+)
4. **Expo CLI** kurulu
5. **EAS CLI** kurulu

## 🚀 Hızlı Başlangıç

### Seçenek 1: Expo Cloud Build (Önerilen)

Expo'nun bulut hizmetini kullanarak APK oluşturmak en kolay yoldur:

```bash
# Projeye gir
cd kurye-nav-pro

# EAS Build ile APK oluştur
eas build --platform android --profile preview
```

Bu komut:
- Uygulamayı Expo sunucularında derler
- Otomatik olarak imzalar
- APK dosyasını indirir

### Seçenek 2: Lokal Build (Gelişmiş)

Kendi bilgisayarınızda APK oluşturmak için:

#### 1. Android SDK'yı Kur

```bash
# ANDROID_HOME ortam değişkenini ayarla
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

#### 2. Eas Build Yapılandırmasını Oluştur

```bash
eas build:configure
```

#### 3. APK'yı Derle

```bash
# Debug APK
eas build --platform android --profile preview

# Release APK (imzalı)
eas build --platform android --profile production
```

## 📦 Proje Yapısı

```
kurye-nav-pro/
├── app/
│   └── index.jsx              # Ana uygulama ekranı
├── config/
│   └── yandexConfig.js        # Yandex API yapılandırması
├── services/
│   └── YandexMapsService.js   # Yandex Maps API servisi
├── assets/                    # Uygulamaya ait görseller
├── app.json                   # Expo yapılandırması
├── package.json               # Proje bağımlılıkları
└── eas.json                   # EAS Build yapılandırması
```

## 🔧 Yapılandırma

### app.json Ayarları

Uygulamanın temel ayarları `app.json` dosyasında bulunur:

```json
{
  "expo": {
    "name": "KuryeNav Pro",
    "slug": "kurye-nav-pro",
    "version": "1.0.0",
    "android": {
      "package": "com.kuryenav.pro",
      "permissions": [
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.INTERNET"
      ]
    }
  }
}
```

### Yandex API Anahtarları

`config/yandexConfig.js` dosyasında API anahtarlarınızı güncelleyin:

```javascript
export const YANDEX_CONFIG = {
  JAVA_API_KEY: 'a29dcaf3-68a6-43f6-9688-77529ad2e1c3',
  STATIC_API_KEY: 'fa3b0684-530d-47fd-b319-5e5dbfff6c3e',
  MAPKIT_API_KEY: 'd7ead52a-c26a-4926-a773-f66eaba77468',
};
```

## 📱 APK Dosyasının Kurulumu

### Android Cihaza Kurulum

APK dosyasını indirdikten sonra:

```bash
# USB Debugging'i cihazda etkinleştir
# Cihazı bilgisayara bağla

# APK'yı kur
adb install kurye-nav-pro.apk
```

### Emülatöre Kurulum

```bash
# Emülatörü başlat
emulator -avd YourAVDName

# APK'yı kur
adb install kurye-nav-pro.apk
```

## 🔐 İmzalama

### Otomatik İmzalama (EAS)

EAS Build otomatik olarak APK'yı imzalar. İlk kez çalıştırdığınızda:

```bash
eas build --platform android --profile production
```

Sistem sizi imzalama anahtarı oluşturma konusunda yönlendirecektir.

### Manuel İmzalama

Kendi imzalama anahtarınızı kullanmak için:

```bash
# Keystore oluştur
keytool -genkey -v -keystore kurye-nav-pro.keystore \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias kurye-nav-pro

# APK'yı imzala
jarsigner -verbose -sigalg SHA1withRSA \
  -digestalg SHA1 -keystore kurye-nav-pro.keystore \
  kurye-nav-pro.apk kurye-nav-pro

# Align et
zipalign -v 4 kurye-nav-pro.apk kurye-nav-pro-aligned.apk
```

## 🧪 Test Etme

### Lokal Test

```bash
# Web'de test et
pnpm run web

# Expo Go'da test et
pnpm start
```

### Cihazda Test

1. APK'yı cihaza kur
2. Uygulamayı aç
3. Konum izni ver
4. Adres arama ve rota planlama özelliklerini test et

## 📊 Sorun Giderme

### "API Key Rejected" Hatası

- Yandex Developer Console'da API anahtarlarınızı kontrol edin
- Anahtarların doğru paket adı (`com.kuryenav.pro`) için yapılandırıldığını doğrulayın
- Anahtarların gerekli servisleri (Routing, Geocoding) etkin olduğunu kontrol edin

### "Build Failed" Hatası

```bash
# Cache'i temizle
rm -rf node_modules
pnpm install

# Yeniden dene
eas build --platform android --profile preview
```

### Konum İzni Sorunu

`app.json` dosyasında izinlerin doğru tanımlandığını kontrol edin:

```json
"android": {
  "permissions": [
    "android.permission.ACCESS_FINE_LOCATION",
    "android.permission.ACCESS_COARSE_LOCATION",
    "android.permission.INTERNET"
  ]
}
```

## 📈 Versiyon Yönetimi

Yeni sürüm yayınlamak için:

1. `app.json` dosyasında `version` numarasını artır
2. Değişiklikleri commit et
3. Yeni APK'yı oluştur

```json
{
  "expo": {
    "version": "1.0.1"
  }
}
```

## 🔗 Faydalı Linkler

- [Expo Build Documentation](https://docs.expo.dev/build/setup/)
- [EAS Build Guide](https://docs.expo.dev/build/introduction/)
- [Android App Signing](https://developer.android.com/studio/publish/app-signing)
- [Yandex Developer Console](https://developer.tech.yandex.ru)

## 📝 Notlar

- APK dosyası genellikle 50-100 MB arasında olur
- İlk build daha uzun sürebilir (5-10 dakika)
- Sonraki buildler daha hızlı olur (cache nedeniyle)
- Production APK'sı debug APK'sından daha küçüktür

## 👨‍💻 Destek

Sorularınız için lütfen iletişime geçin.

---

**Son Güncelleme:** 19 Mayıs 2026
