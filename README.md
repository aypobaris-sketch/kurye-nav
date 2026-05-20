# 🏍️ KuryeNav Pro - Motosikletli Kurye Navigasyonu

Yandex Maps API'leri kullanarak motosikletli kuryeler için özel olarak tasarlanmış, ara sokakları ve kestirmeleri önceliklendiren akıllı navigasyon uygulaması.

## 📋 Özellikler

### 1. **Akıllı Rota Planlama**
- Motosikletler için optimize edilmiş rota hesaplama
- Ara sokakları ve dar yolları tercih eden algoritma
- Üç alternatif rota önerisi
- Gerçek zamanlı trafik bilgisi entegrasyonu

### 2. **Çoklu Durak Desteği**
- Birden fazla teslimat noktası için rota optimizasyonu
- En yakın komşu algoritması (TSP) ile en kısa toplam mesafe
- Durakları ekle/sil özelliği
- Durak sırası otomatik optimizasyonu

### 3. **Adres Arama ve Öneriler**
- Yandex Geocoding API ile hassas adres bulma
- Otomatik tamamlama (Autocomplete) özelliği
- Ters geocoding (koordinatlardan adres bulma)
- Türkçe dil desteği

### 4. **Kullanıcı Dostu Arayüz**
- Kolay adres girişi
- Durak yönetimi
- Rota detayları (mesafe, süre)
- Navigasyon başlatma butonu

### 5. **Konum Servisleri**
- GPS ile mevcut konumu otomatik algılama
- Konum izni yönetimi
- Başlangıç noktası olarak mevcut konumu kullanma

## 🛠️ Teknoloji Stack

- **Framework:** React Native + Expo
- **Harita API:** Yandex Maps (Java API, Statik API, MapKit)
- **Konum:** expo-location
- **HTTP İstemci:** axios
- **Stil:** React Native StyleSheet

## 📦 Kurulum

### Ön Gereksinimler
- Node.js (v16+)
- pnpm veya npm
- Expo CLI

### Adımlar

1. **Projeyi klonla veya indir:**
```bash
cd kurye-nav-pro
```

2. **Bağımlılıkları yükle:**
```bash
pnpm install
```

3. **API Anahtarlarını Yapılandır:**
`config/yandexConfig.js` dosyasında Yandex API anahtarlarınızı güncelleyin:
```javascript
export const YANDEX_CONFIG = {
  JAVA_API_KEY: 'your-java-api-key',
  STATIC_API_KEY: 'your-static-api-key',
  MAPKIT_API_KEY: 'your-mapkit-api-key',
};
```

## 🚀 Çalıştırma

### Android APK Oluşturma
```bash
pnpm run android
```

### Web'de Test Etme
```bash
pnpm run web
```

### Expo Go ile Canlı Geliştirme
```bash
pnpm start
```

## 📱 APK Oluşturma (Production)

```bash
eas build --platform android
```

## 🗺️ Yandex Maps API Anahtarları

Uygulamayı kullanmak için Yandex Developer Console'dan 3 anahtar gereklidir:

1. **Java API Key** - Routing ve Geocoding işlemleri
2. **Statik API Key** - Harita görüntüleri
3. **MapKit Mobile SDK Key** - Mobil harita entegrasyonu

## 🎯 Temel Kullanım

### 1. Başlangıç Noktası Belirle
- Mevcut konumunuz otomatik algılanır
- Veya manuel olarak bir adres girin

### 2. Bitiş Noktası Belirle
- Teslimat yapılacak adresi girin
- Önerilerden seçin

### 3. Duraklar Ekle (Opsiyonel)
- Birden fazla teslimat noktası için duraklar ekleyin
- Duraklar otomatik olarak optimize edilir

### 4. Rota Hesapla
- "🗺️ Rota Hesapla" butonuna tıklayın
- 3 alternatif rota gösterilir

### 5. Navigasyonu Başlat
- En uygun rotayı seçin
- "🚀 Navigasyonu Başlat" butonuna tıklayın

## 📊 Rota Optimizasyonu

Uygulama, çoklu duraklar için **En Yakın Komşu Algoritması (Nearest Neighbor TSP)** kullanarak en kısa toplam mesafeyi hesaplar.

## 🐛 Sorun Giderme

### "Adres bulunamadı" Hatası
- Adresin doğru yazıldığını kontrol edin
- Türkçe karakterleri kullanın
- Daha kısa bir adres deneyin

### "Rota hesaplanamadı" Hatası
- API anahtarlarının geçerli olduğunu kontrol edin
- İnternet bağlantısını kontrol edin

### Konum Erişim Sorunu
- Uygulamaya konum izni verin
- Cihazın GPS'ini açın

## 📝 Lisans

MIT License

## 👨‍💻 Geliştirici

Manus AI tarafından geliştirilmiştir.

---

**Sürüm:** 1.0.0  
**Son Güncelleme:** 19 Mayıs 2026
