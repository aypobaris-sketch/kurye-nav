# 🔧 KuryeNav Pro - Teknik Dokümantasyon

Motosikletli kuryeler için geliştirilmiş KuryeNav Pro uygulamasının teknik mimarisi, API entegrasyonu ve özelliklerinin detaylı açıklaması.

## 📐 Mimari Genel Bakış

```
┌─────────────────────────────────────────────────────────┐
│                   React Native UI Layer                  │
│  (app/index.jsx - Harita, Adres Arama, Rota Planlama)   │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────┐
│              YandexMapsService (services/)               │
│  - Geocoding (Adres Arama)                              │
│  - Routing (Rota Hesaplama)                             │
│  - Suggestions (Otomatik Tamamlama)                     │
│  - Route Optimization (TSP Algoritması)                 │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────┐
│                   Yandex Maps APIs                       │
│  - Java API (Routing v2, Geocoding)                     │
│  - Statik API (Harita Görüntüleri)                      │
│  - MapKit SDK (Mobil Harita)                            │
└─────────────────────────────────────────────────────────┘
```

## 🏗️ Dosya Yapısı

```
kurye-nav-pro/
├── app/
│   └── index.jsx                    # Ana uygulama bileşeni (16 KB)
├── config/
│   └── yandexConfig.js              # API yapılandırması (1.2 KB)
├── services/
│   └── YandexMapsService.js         # API servisi (9.1 KB)
├── assets/                          # Görseller ve ikonlar
├── node_modules/                    # Bağımlılıklar
├── app.json                         # Expo yapılandırması
├── eas.json                         # EAS Build yapılandırması
├── package.json                     # Proje meta verisi
├── README.md                        # Kullanıcı kılavuzu
├── APK_BUILD_GUIDE.md              # APK oluşturma talimatları
└── TECHNICAL_DOCUMENTATION.md      # Bu dosya
```

## 🔌 API Entegrasyonu

### 1. Yandex Java API (Routing & Geocoding)

**Endpoint:** `https://api.routing.yandex.net/v2/route`

**Kullanım Alanları:**
- Rota hesaplama (başlangıç → bitiş)
- Çoklu durak optimizasyonu
- Mesafe ve süre hesaplama

**Örnek İstek:**
```javascript
GET https://api.routing.yandex.net/v2/route?
  apikey=YOUR_KEY&
  waypoints=28.9784,41.0082|28.9900,41.0150&
  routing_mode=driving&
  avoid_tolls=true&
  traffic=true
```

**Yanıt Örneği:**
```json
{
  "routes": [
    {
      "distance": {"value": 2500},
      "duration": {"value": 180},
      "geometry": "...",
      "summary": {...}
    }
  ]
}
```

### 2. Yandex Geocoding API

**Endpoint:** `https://geocode-maps.yandex.ru/v1/`

**Kullanım Alanları:**
- Adres → Koordinat dönüşümü
- Koordinat → Adres dönüşümü (Ters Geocoding)

**Örnek İstek:**
```javascript
GET https://geocode-maps.yandex.ru/v1/?
  apikey=YOUR_KEY&
  geocode=Taksim,Istanbul&
  format=json&
  lang=tr_TR
```

### 3. Yandex Suggest API

**Endpoint:** `https://suggest-maps.yandex.ru/v1/suggest`

**Kullanım Alanları:**
- Adres önerileri (Autocomplete)
- Yazı tamamlama

**Örnek İstek:**
```javascript
GET https://suggest-maps.yandex.ru/v1/suggest?
  apikey=YOUR_KEY&
  text=Tak&
  lang=tr_TR&
  results=10
```

## 🎯 Temel Özellikler

### 1. Adres Arama (Geocoding)

```javascript
// YandexMapsService.searchAddress(address)
const result = await YandexMapsService.searchAddress("Taksim, Istanbul");
// Döner: { success: true, results: [{address, latitude, longitude, kind}] }
```

**Algoritma:**
1. Kullanıcı adres girer
2. Yandex Geocoding API'ye istek gönder
3. Koordinatları ve adres bilgilerini döndür
4. UI'da göster

### 2. Rota Hesaplama

```javascript
// YandexMapsService.calculateRoute(startPoint, endPoint, waypoints)
const route = await YandexMapsService.calculateRoute(
  {latitude: 41.0082, longitude: 28.9784},
  {latitude: 41.0150, longitude: 28.9900}
);
// Döner: { success: true, routes: [{distance, duration, polyline}] }
```

**Kurye Modu Ayarları:**
- `routing_mode: 'driving'` - Araç navigasyonu
- `avoid_tolls: true` - Ücretli yollardan kaçın
- `avoid_unpaved: false` - Dar/dönerme yolları kullanabilir
- `traffic: true` - Trafik bilgisini dikkate al

### 3. Çoklu Durak Optimizasyonu

```javascript
// YandexMapsService.optimizeRoute(startPoint, stops)
const optimized = await YandexMapsService.optimizeRoute(
  {latitude: 41.0082, longitude: 28.9784},
  [
    {latitude: 41.0150, longitude: 28.9900},
    {latitude: 41.0200, longitude: 28.9950},
    {latitude: 41.0250, longitude: 29.0000}
  ]
);
```

**Algoritma: En Yakın Komşu (Nearest Neighbor TSP)**

```
1. Başlangıç noktasından başla
2. Ziyaret edilmemiş duraklar arasında en yakını bul
3. O durağa git
4. Adım 2-3'ü tekrarla
5. Tüm duraklar ziyaret edilene kadar devam et
```

**Karmaşıklık:** O(n²) - Pratik uygulamalar için yeterli

**Örnek:**
```
Başlangıç: (41.0082, 28.9784)
Duraklar: A, B, C, D

Adım 1: Başlangıç → En yakın (A) = 500m
Adım 2: A → En yakın (C) = 400m
Adım 3: C → En yakın (B) = 300m
Adım 4: B → Son (D) = 600m

Toplam: 1.8 km
```

### 4. Otomatik Tamamlama (Autocomplete)

```javascript
// YandexMapsService.getSuggestions(text)
const suggestions = await YandexMapsService.getSuggestions("Tak");
// Döner: { success: true, results: [{title, subtitle}] }
```

**Kullanım Akışı:**
1. Kullanıcı yazı yazmaya başlar
2. Her karakter için API'ye istek gönder
3. Önerileri dropdown'da göster
4. Kullanıcı seçimi tıkla

## 📊 Veri Yapıları

### Konum Nesnesi
```javascript
{
  latitude: number,      // Enlem (-90 to 90)
  longitude: number      // Boylam (-180 to 180)
}
```

### Adres Nesnesi
```javascript
{
  address: string,       // Tam adres
  latitude: number,
  longitude: number,
  kind: string          // 'house', 'street', 'city', vb.
}
```

### Rota Nesnesi
```javascript
{
  id: number,
  distance: number,      // Metre cinsinden
  duration: number,      // Saniye cinsinden
  durationMinutes: number,
  distanceKm: string,
  polyline: string,      // Encoded polyline
  summary: object
}
```

### Durak Nesnesi
```javascript
{
  id: number,            // Unique ID (timestamp)
  address: string        // Durak adresi
}
```

## 🔐 Güvenlik

### API Anahtarları
- Üç ayrı anahtar kullanılır (Java, Statik, MapKit)
- `config/yandexConfig.js` dosyasında saklanır
- Production'da ortam değişkenlerinden yüklenmelidir

### Önerilen Güvenlik Uygulamaları

```javascript
// ❌ YANLIŞ - Hardcoded API Key
const API_KEY = 'a29dcaf3-68a6-43f6-9688-77529ad2e1c3';

// ✅ DOĞRU - Ortam değişkeninden
const API_KEY = process.env.YANDEX_API_KEY;
```

### İzinler (Android)
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.INTERNET" />
```

## 🚀 Performans Optimizasyonları

### 1. Caching
- Arama sonuçlarını cache'le
- Tekrarlanan istekleri azalt

### 2. Debouncing
- Adres arama sırasında API çağrılarını azalt
- Kullanıcı yazı yazmayı bittikten sonra ara

### 3. Lazy Loading
- Rotaları ihtiyaç duyulduğunda yükle
- Harita tile'larını dinamik yükle

### 4. Veri Sıkıştırma
- Polyline'ları encoded format'ta sakla
- JSON yanıtlarını gzip ile sıkıştır

## 🧪 Test Senaryoları

### 1. Adres Arama Testi
```javascript
// Geçerli adres
searchAddress("Taksim, Istanbul") → ✅ Başarılı

// Geçersiz adres
searchAddress("XYZ123") → ❌ Bulunamadı

// Boş adres
searchAddress("") → ❌ Hata
```

### 2. Rota Hesaplama Testi
```javascript
// Geçerli rota
calculateRoute(start, end) → ✅ 3 alternatif rota

// Aynı nokta
calculateRoute(start, start) → ⚠️ 0 km, 0 dakika

// Çok uzak noktalar
calculateRoute(istanbul, ankara) → ✅ Başarılı (400+ km)
```

### 3. Çoklu Durak Testi
```javascript
// 3 durak
optimizeRoute(start, [a, b, c]) → ✅ Optimize edilmiş sıra

// 10+ durak
optimizeRoute(start, [a...j]) → ✅ Hala çalışır (O(n²))

// Yinelenen duraklar
optimizeRoute(start, [a, a, b]) → ⚠️ Tekrarlı işleme
```

## 📈 Ölçeklenebilirlik

### Mevcut Sınırlamalar
- **Maksimum durak:** ~20 (TSP algoritması O(n²))
- **Maksimum istek boyutu:** 5 MB
- **API Rate Limit:** Yandex'in limitine bağlı

### Gelecek İyileştirmeler
- **Ant Colony Optimization** - Daha iyi TSP çözümü
- **Caching Layer** - Redis/Memcached
- **Batch Processing** - Toplu istek işleme
- **WebSocket** - Gerçek zamanlı güncellemeler

## 🔧 Hata Yönetimi

### Hata Türleri

| Hata | Sebep | Çözüm |
|------|-------|-------|
| API Key Rejected | Geçersiz anahtar | Anahtarı kontrol et |
| Network Error | İnternet yok | Bağlantıyı kontrol et |
| Address Not Found | Adres bulunamadı | Farklı adres dene |
| Route Not Found | Rota yok | Başlangıç/bitiş kontrol et |

### Error Handling Örneği
```javascript
try {
  const result = await YandexMapsService.searchAddress(address);
  if (!result.success) {
    Alert.alert('Hata', result.message);
    return;
  }
  // Başarılı işlem
} catch (error) {
  console.error('Kritik hata:', error);
  Alert.alert('Sistem Hatası', error.message);
}
```

## 📚 Kaynaklar

- [Yandex Maps API Docs](https://yandex.com/dev/maps/)
- [React Native Docs](https://reactnative.dev/)
- [Expo Documentation](https://docs.expo.dev/)
- [TSP Algoritmaları](https://en.wikipedia.org/wiki/Travelling_salesman_problem)

## 📝 Versiyon Tarihi

| Versiyon | Tarih | Değişiklikler |
|----------|-------|---------------|
| 1.0.0 | 19 May 2026 | İlk sürüm - Temel özellikler |
| 1.1.0 | TBD | Harita görünümü, gerçek zamanlı trafik |
| 1.2.0 | TBD | Sürücü profili, ödeme entegrasyonu |

---

**Son Güncelleme:** 19 Mayıs 2026
