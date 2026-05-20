// OpenRouteService API Configuration
// https://openrouteservice.org/dev/#/api-docs

export const ORS_CONFIG = {
  // API Anahtarı — güvenli ortamda .env'e taşı
  API_KEY: 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImIzMWFlOGJiNDQwODQwM2U4YjM2ODE1YTMxYjg0YjlkIiwiaCI6Im11cm11cjY0In0=',

  // API Endpoints
  ENDPOINTS: {
    // Adres arama (Nominatim - ücretsiz, limitsiz)
    GEOCODER: 'https://nominatim.openstreetmap.org/search',
    // Ters geocoding
    REVERSE: 'https://nominatim.openstreetmap.org/reverse',
    // Adres önerileri (Photon - ORS'un açık kaynak autocomplete'i)
    SUGGEST: 'https://photon.komoot.io/api/',
    // Rota hesaplama (motosiklet = driving-car, bisiklet = cycling-regular)
    ROUTING: 'https://api.openrouteservice.org/v2/directions',
    // Optimize edilmiş çoklu durak
    OPTIMIZE: 'https://api.openrouteservice.org/optimization',
  },

  // Kurye / Motosiklet Ayarları
  COURIER_SETTINGS: {
    // driving-car | driving-hgv | cycling-regular | cycling-road | foot-walking
    profile: 'driving-car',
    // Araç tercih ayarları
    preference: 'fastest',    // fastest | shortest | recommended
    avoid_features: ['ferries'],
    // Trafik bilgisi (ORS Pro'da mevcut)
    // continue_straight: false, // U dönüşlerine izin ver
  },

  // Harita başlangıç konumu (İstanbul)
  DEFAULT_CENTER: {
    latitude: 41.0082,
    longitude: 28.9784,
  },

  DEFAULT_ZOOM: 13,
};

export default ORS_CONFIG;
