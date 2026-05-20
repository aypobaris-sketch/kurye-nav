/**
 * KuryeNav Pro — Tam Navigasyon
 * + Karanlık mod, sesli yönlendirme, hız göstergesi,
 *   teslimat geçmişi, favori adresler, kalın rota çizgisi
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, StyleSheet, Alert, Modal,
  KeyboardAvoidingView, Platform, Dimensions, Switch,
  Animated, Vibration,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ORSService from '../services/ORSService';

const { width: SW, height: SH } = Dimensions.get('window');

// ── Tema renkleri ─────────────────────────────────────────────────────────────
const THEME = {
  light: {
    bg: '#FFFFFF', card: '#F4F6F8', border: '#DDE1E7',
    text: '#2C3E50', sub: '#7F8C8D', input: '#F4F6F8',
    sheet: '#FFFFFF', mapStyle: [],
  },
  dark: {
    bg: '#1A1A2E', card: '#16213E', border: '#0F3460',
    text: '#E0E0E0', sub: '#7F8C8D', input: '#16213E',
    sheet: '#1A1A2E',
    mapStyle: [
      { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
      { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
      { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
      { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
      { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
      { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#746855' }] },
      { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
    ],
  },
};

const ORANGE = '#FF6B35';
const GREEN  = '#27AE60';
const BLUE   = '#3498DB';
const RED    = '#E74C3C';

// ── Adım ikonu ─────────────────────────────────────────────────────────────────
function stepIcon(type) {
  const icons = { 0:'🏁',1:'↗️',2:'↙️',3:'⬆️',4:'↩️',5:'↪️',6:'↖️',7:'↗️',10:'🔄',11:'⬆️',12:'🏁' };
  return icons[type] || '➡️';
}

// ── Debounce hook ─────────────────────────────────────────────────────────────
function useDebounce(fn, delay) {
  const timer = useRef(null);
  return useCallback((...args) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

// ── Öneri Listesi ─────────────────────────────────────────────────────────────
function SuggestionList({ suggestions, onSelect, onDismiss, t }) {
  return (
    <View style={[sl.box, { backgroundColor: t.card, borderColor: t.border }]}>
      {suggestions.slice(0, 6).map((item, i) => (
        <TouchableOpacity key={i} style={[sl.item, { borderBottomColor: t.border }]} onPress={() => onSelect(item)}>
          <Text style={[sl.title, { color: t.text }]} numberOfLines={1}>{item.title}</Text>
          {!!item.subtitle && <Text style={[sl.sub, { color: t.sub }]} numberOfLines={1}>{item.subtitle}</Text>}
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={sl.close} onPress={onDismiss}>
        <Text style={[sl.closeText, { color: t.sub }]}>Kapat</Text>
      </TouchableOpacity>
    </View>
  );
}
const sl = StyleSheet.create({
  box: { borderRadius: 10, borderWidth: 1, marginBottom: 6, overflow: 'hidden' },
  item: { paddingHorizontal: 13, paddingVertical: 10, borderBottomWidth: 1 },
  title: { fontSize: 14, fontWeight: '600' },
  sub: { fontSize: 11, marginTop: 2 },
  close: { paddingVertical: 7, alignItems: 'center' },
  closeText: { fontSize: 12 },
});

// ── Hız Göstergesi ────────────────────────────────────────────────────────────
function SpeedMeter({ speed, darkMode }) {
  const t = darkMode ? THEME.dark : THEME.light;
  const kmh = Math.round((speed ?? 0) * 3.6);
  const color = kmh > 80 ? RED : kmh > 50 ? ORANGE : GREEN;
  return (
    <View style={[sm.box, { backgroundColor: t.card, borderColor: color }]}>
      <Text style={[sm.value, { color }]}>{kmh}</Text>
      <Text style={[sm.unit, { color: t.sub }]}>km/s</Text>
    </View>
  );
}
const sm = StyleSheet.create({
  box: { position: 'absolute', bottom: 100, left: 16, borderRadius: 40,
         width: 72, height: 72, alignItems: 'center', justifyContent: 'center',
         borderWidth: 3, elevation: 8, shadowColor: '#000',
         shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
  value: { fontSize: 22, fontWeight: '900' },
  unit: { fontSize: 10, fontWeight: '600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// ANA EKRAN
// ─────────────────────────────────────────────────────────────────────────────
export default function CourierNavApp() {

  // Tema
  const [darkMode, setDarkMode] = useState(false);
  const t = darkMode ? THEME.dark : THEME.light;

  // Mod: 'plan' | 'navigate' | 'history' | 'favorites'
  const [mode, setMode] = useState('plan');

  // Konum
  const [userLocation, setUserLocation]   = useState(null);
  const [currentSpeed, setCurrentSpeed]   = useState(0);
  const [heading, setHeading]             = useState(0);
  const locationSub = useRef(null);
  const mapRef      = useRef(null);

  // Adresler
  const [startAddress, setStartAddress] = useState('');
  const [endAddress, setEndAddress]     = useState('');
  const [startPoint, setStartPoint]     = useState(null);
  const [endPoint, setEndPoint]         = useState(null);

  // Öneriler
  const [startSug, setStartSug] = useState([]);
  const [endSug, setEndSug]     = useState([]);
  const [stopSug, setStopSug]   = useState([]);
  const [favSug, setFavSug]     = useState([]);

  // Duraklar
  const [stops, setStops]           = useState([]);
  const [showStopModal, setShowStopModal] = useState(false);
  const [stopText, setStopText]     = useState('');
  const [stopPoint, setStopPoint]   = useState(null);

  // Rotalar
  const [routes, setRoutes]       = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [loading, setLoading]     = useState(false);

  // Navigasyon
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const lastSpokenStep = useRef(-1);
  const [voiceEnabled, setVoiceEnabled]     = useState(true);

  // Teslimat geçmişi
  const [history, setHistory] = useState([]);

  // Favori adresler
  const [favorites, setFavorites]     = useState([]);
  const [showFavModal, setShowFavModal] = useState(false);
  const [favName, setFavName]         = useState('');
  const [favAddress, setFavAddress]   = useState('');
  const [favPoint, setFavPoint]       = useState(null);

  // Navigasyon başlangıç zamanı
  const navStartTime = useRef(null);
  const navStartKm   = useRef(null);

  // ── Kalıcı veri yükle ────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const h = await AsyncStorage.getItem('delivery_history');
        if (h) setHistory(JSON.parse(h));
        const f = await AsyncStorage.getItem('favorites');
        if (f) setFavorites(JSON.parse(f));
        const dm = await AsyncStorage.getItem('dark_mode');
        if (dm) setDarkMode(JSON.parse(dm));
      } catch {}
    })();
  }, []);

  // ── Konum izni ────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({});
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setUserLocation(coords);
      setStartPoint(coords);
      const rev = await ORSService.reverseGeocode(coords.latitude, coords.longitude);
      setStartAddress(rev.success ? rev.address.slice(0, 55) : `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
    })();
  }, []);

  // ── Navigasyon GPS takibi ─────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'navigate') {
      locationSub.current?.remove();
      locationSub.current = null;
      return;
    }
    (async () => {
      locationSub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5 },
        (loc) => {
          const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setUserLocation(coords);
          setCurrentSpeed(loc.coords.speed ?? 0);
          setHeading(loc.coords.heading ?? 0);
          mapRef.current?.animateCamera({
            center: coords, heading: loc.coords.heading ?? 0, pitch: 55, zoom: 18,
          }, { duration: 600 });

          // Adım geçiş kontrolü
          const route = routes[selectedIdx];
          if (!route) return;
          const steps = route.steps;
          const step  = steps[currentStepIdx];
          if (!step) return;

          // Sesli yönlendirme (her adım bir kez)
          if (voiceEnabled && currentStepIdx !== lastSpokenStep.current) {
            lastSpokenStep.current = currentStepIdx;
            Speech.speak(step.instruction, { language: 'tr-TR', rate: 0.95 });
          }
        }
      );
    })();
    return () => { locationSub.current?.remove(); };
  }, [mode, currentStepIdx, voiceEnabled]);

  // ── Öneri debounce ────────────────────────────────────────────────────────
  const fetchSug = useCallback(async (text, setter) => {
    if (text.length < 3) { setter([]); return; }
    const res = await ORSService.getSuggestions(text);
    setter(res.success ? res.results : []);
  }, []);

  const dStart = useDebounce((t) => fetchSug(t, setStartSug), 400);
  const dEnd   = useDebounce((t) => fetchSug(t, setEndSug),   400);
  const dStop  = useDebounce((t) => fetchSug(t, setStopSug),  400);
  const dFav   = useDebounce((t) => fetchSug(t, setFavSug),   400);

  const pickStart = (s) => {
    setStartAddress(`${s.title}${s.subtitle ? ', '+s.subtitle : ''}`);
    setStartPoint({ latitude: s.latitude, longitude: s.longitude });
    setStartSug([]);
  };
  const pickEnd = (s) => {
    setEndAddress(`${s.title}${s.subtitle ? ', '+s.subtitle : ''}`);
    setEndPoint({ latitude: s.latitude, longitude: s.longitude });
    setEndSug([]);
  };
  const pickStop = (s) => {
    setStopText(`${s.title}${s.subtitle ? ', '+s.subtitle : ''}`);
    setStopPoint({ latitude: s.latitude, longitude: s.longitude });
    setStopSug([]);
  };
  const pickFav = (s) => {
    setFavAddress(`${s.title}${s.subtitle ? ', '+s.subtitle : ''}`);
    setFavPoint({ latitude: s.latitude, longitude: s.longitude });
    setFavSug([]);
  };

  // ── Durak ekle ────────────────────────────────────────────────────────────
  const addStop = async () => {
    if (!stopText.trim()) return;
    let pt = stopPoint;
    if (!pt) {
      const r = await ORSService.searchAddress(stopText);
      if (!r.success || !r.results.length) { Alert.alert('Hata', 'Durak bulunamadı'); return; }
      pt = r.results[0];
    }
    setStops((prev) => [...prev, { id: Date.now(), address: stopText, latitude: pt.latitude, longitude: pt.longitude }]);
    setStopText(''); setStopPoint(null); setStopSug([]); setShowStopModal(false);
  };

  // ── Favori kaydet ─────────────────────────────────────────────────────────
  const saveFavorite = async () => {
    if (!favName.trim() || !favAddress.trim()) return;
    let pt = favPoint;
    if (!pt) {
      const r = await ORSService.searchAddress(favAddress);
      if (!r.success || !r.results.length) { Alert.alert('Hata', 'Adres bulunamadı'); return; }
      pt = r.results[0];
    }
    const newFav = { id: Date.now(), name: favName, address: favAddress, latitude: pt.latitude, longitude: pt.longitude };
    const updated = [...favorites, newFav];
    setFavorites(updated);
    await AsyncStorage.setItem('favorites', JSON.stringify(updated));
    setFavName(''); setFavAddress(''); setFavPoint(null); setFavSug([]); setShowFavModal(false);
  };

  const deleteFavorite = async (id) => {
    const updated = favorites.filter((f) => f.id !== id);
    setFavorites(updated);
    await AsyncStorage.setItem('favorites', JSON.stringify(updated));
  };

  // Favoriden rota başlat
  const routeFromFavorite = (fav) => {
    setEndAddress(fav.address);
    setEndPoint({ latitude: fav.latitude, longitude: fav.longitude });
    setMode('plan');
  };

  // ── Rota hesapla ──────────────────────────────────────────────────────────
  const calculateRoute = async () => {
    if (!startAddress.trim() || !endAddress.trim()) {
      Alert.alert('Eksik', 'Başlangıç ve bitiş adresini girin'); return;
    }
    setLoading(true); setRoutes([]); setSelectedIdx(null);
    try {
      let sPoint = startPoint;
      if (!sPoint) {
        const r = await ORSService.searchAddress(startAddress);
        if (!r.success || !r.results.length) { Alert.alert('Hata', 'Başlangıç bulunamadı'); return; }
        sPoint = r.results[0]; setStartPoint(sPoint);
      }
      let ePoint = endPoint;
      if (!ePoint) {
        const r = await ORSService.searchAddress(endAddress);
        if (!r.success || !r.results.length) { Alert.alert('Hata', 'Bitiş bulunamadı'); return; }
        ePoint = r.results[0]; setEndPoint(ePoint);
      }

      let result;
      if (stops.length > 0) {
        const allStops = [...stops.map((s) => ({ latitude: s.latitude, longitude: s.longitude })), ePoint];
        result = await ORSService.optimizeRoute(sPoint, allStops);
      } else {
        result = await ORSService.calculateRoute(sPoint, ePoint);
      }

      if (result.success && result.routes?.length) {
        setRoutes(result.routes);
        setSelectedIdx(0);
        const coords = result.routes[0].polylineCoords;
        if (coords?.length && mapRef.current) {
          setTimeout(() => mapRef.current.fitToCoordinates(coords, {
            edgePadding: { top: 80, right: 40, bottom: 340, left: 40 }, animated: true,
          }), 500);
        }
      } else {
        Alert.alert('Hata', result.message || 'Rota hesaplanamadı');
      }
    } catch (err) {
      Alert.alert('Hata', err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Navigasyon başlat ─────────────────────────────────────────────────────
  const startNavigation = () => {
    if (selectedIdx === null || !routes[selectedIdx]) return;
    setCurrentStepIdx(0);
    lastSpokenStep.current = -1;
    navStartTime.current = Date.now();
    navStartKm.current = parseFloat(routes[selectedIdx].distanceKm);
    setMode('navigate');
    if (userLocation) {
      mapRef.current?.animateCamera({
        center: userLocation, pitch: 55, heading: 0, zoom: 18,
      }, { duration: 1000 });
    }
    if (voiceEnabled) {
      const firstStep = routes[selectedIdx]?.steps?.[0];
      if (firstStep) Speech.speak(`Navigasyon başladı. ${firstStep.instruction}`, { language: 'tr-TR' });
    }
  };

  // ── Navigasyon bitir + geçmişe kaydet ────────────────────────────────────
  const stopNavigation = async () => {
    const route = routes[selectedIdx];
    if (route && navStartTime.current) {
      const elapsed = Math.round((Date.now() - navStartTime.current) / 60000);
      const entry = {
        id: Date.now(),
        date: new Date().toLocaleDateString('tr-TR'),
        time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        from: startAddress.slice(0, 40),
        to: endAddress.slice(0, 40),
        distanceKm: route.distanceKm,
        durationMin: elapsed,
        stops: stops.length,
      };
      const updated = [entry, ...history].slice(0, 50);
      setHistory(updated);
      await AsyncStorage.setItem('delivery_history', JSON.stringify(updated));
    }
    Speech.stop();
    setMode('plan');
    setCurrentStepIdx(0);
    const coords = routes[selectedIdx]?.polylineCoords;
    if (coords?.length && mapRef.current) {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 80, right: 40, bottom: 340, left: 40 }, animated: true,
      });
    }
  };

  // ── Karanlık mod kaydet ───────────────────────────────────────────────────
  const toggleDark = async (val) => {
    setDarkMode(val);
    await AsyncStorage.setItem('dark_mode', JSON.stringify(val));
  };

  const selectedRoute = selectedIdx !== null ? routes[selectedIdx] : null;
  const currentStep   = selectedRoute?.steps?.[currentStepIdx];

  // ── Adım ileri/geri ───────────────────────────────────────────────────────
  const nextStep = () => setCurrentStepIdx((p) => Math.min(p + 1, (selectedRoute?.steps?.length ?? 1) - 1));
  const prevStep = () => setCurrentStepIdx((p) => Math.max(p - 1, 0));

  // ─────────────────────────────────────────────────────────────────────────
  // GEÇMİŞ EKRANI
  // ─────────────────────────────────────────────────────────────────────────
  if (mode === 'history') {
    const totalKm  = history.reduce((s, h) => s + parseFloat(h.distanceKm || 0), 0);
    const totalMin = history.reduce((s, h) => s + (h.durationMin || 0), 0);
    return (
      <View style={[ms.root, { backgroundColor: t.bg }]}>
        <View style={[ms.header, { backgroundColor: darkMode ? '#0F3460' : ORANGE }]}>
          <TouchableOpacity onPress={() => setMode('plan')}>
            <Text style={ms.headerBack}>← Geri</Text>
          </TouchableOpacity>
          <Text style={ms.headerTitle}>📊 Teslimat Geçmişi</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Özet */}
        <View style={[ms.summaryRow, { backgroundColor: t.card, borderColor: t.border }]}>
          <View style={ms.summaryItem}>
            <Text style={[ms.summaryVal, { color: ORANGE }]}>{history.length}</Text>
            <Text style={[ms.summaryLabel, { color: t.sub }]}>Teslimat</Text>
          </View>
          <View style={[ms.summaryDivider, { backgroundColor: t.border }]} />
          <View style={ms.summaryItem}>
            <Text style={[ms.summaryVal, { color: GREEN }]}>{totalKm.toFixed(1)}</Text>
            <Text style={[ms.summaryLabel, { color: t.sub }]}>Toplam km</Text>
          </View>
          <View style={[ms.summaryDivider, { backgroundColor: t.border }]} />
          <View style={ms.summaryItem}>
            <Text style={[ms.summaryVal, { color: BLUE }]}>{totalMin}</Text>
            <Text style={[ms.summaryLabel, { color: t.sub }]}>Toplam dk</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {history.length === 0 && (
            <Text style={[ms.empty, { color: t.sub }]}>Henüz teslimat yok</Text>
          )}
          {history.map((item) => (
            <View key={item.id} style={[ms.histCard, { backgroundColor: t.card, borderColor: t.border }]}>
              <View style={ms.histCardTop}>
                <Text style={[ms.histDate, { color: t.sub }]}>{item.date} {item.time}</Text>
                <Text style={[ms.histKm, { color: ORANGE }]}>{item.distanceKm} km</Text>
              </View>
              <Text style={[ms.histFrom, { color: t.text }]}>📍 {item.from}</Text>
              <Text style={[ms.histTo, { color: t.text }]}>🎯 {item.to}</Text>
              <View style={ms.histFooter}>
                {item.stops > 0 && <Text style={[ms.histTag, { color: t.sub }]}>📦 {item.stops} durak</Text>}
                <Text style={[ms.histTag, { color: t.sub }]}>⏱️ {item.durationMin} dk</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FAVORİLER EKRANI
  // ─────────────────────────────────────────────────────────────────────────
  if (mode === 'favorites') {
    return (
      <View style={[ms.root, { backgroundColor: t.bg }]}>
        <View style={[ms.header, { backgroundColor: darkMode ? '#0F3460' : ORANGE }]}>
          <TouchableOpacity onPress={() => setMode('plan')}>
            <Text style={ms.headerBack}>← Geri</Text>
          </TouchableOpacity>
          <Text style={ms.headerTitle}>⭐ Favoriler</Text>
          <TouchableOpacity onPress={() => setShowFavModal(true)}>
            <Text style={ms.headerBack}>+ Ekle</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {favorites.length === 0 && (
            <Text style={[ms.empty, { color: t.sub }]}>Henüz favori adres yok</Text>
          )}
          {favorites.map((fav) => (
            <View key={fav.id} style={[ms.favCard, { backgroundColor: t.card, borderColor: t.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[ms.favName, { color: t.text }]}>⭐ {fav.name}</Text>
                <Text style={[ms.favAddr, { color: t.sub }]} numberOfLines={1}>{fav.address}</Text>
              </View>
              <TouchableOpacity style={ms.favRouteBtn} onPress={() => routeFromFavorite(fav)}>
                <Text style={ms.favRouteTxt}>Rota</Text>
              </TouchableOpacity>
              <TouchableOpacity style={ms.favDelBtn} onPress={() => deleteFavorite(fav.id)}>
                <Text style={ms.favDelTxt}>🗑️</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>

        {/* Favori Ekle Modal */}
        <Modal visible={showFavModal} transparent animationType="slide"
          onRequestClose={() => setShowFavModal(false)}>
          <TouchableOpacity style={ms.modalOverlay} activeOpacity={1} onPress={() => setShowFavModal(false)}>
            <View style={[ms.modalBox, { backgroundColor: t.sheet }]} onStartShouldSetResponder={() => true}>
              <Text style={[ms.modalTitle, { color: t.text }]}>⭐ Favori Ekle</Text>
              <TextInput
                style={[ms.input, { backgroundColor: t.input, color: t.text, borderColor: t.border }]}
                placeholder="Favori adı (örn: Ev, İş)"
                placeholderTextColor={t.sub}
                value={favName}
                onChangeText={setFavName}
              />
              <TextInput
                style={[ms.input, { backgroundColor: t.input, color: t.text, borderColor: t.border }]}
                placeholder="Adres"
                placeholderTextColor={t.sub}
                value={favAddress}
                onChangeText={(tx) => { setFavAddress(tx); setFavPoint(null); dFav(tx); }}
              />
              {favSug.length > 0 && (
                <SuggestionList suggestions={favSug} onSelect={pickFav} onDismiss={() => setFavSug([])} t={t} />
              )}
              <View style={ms.modalBtns}>
                <TouchableOpacity style={ms.modalBtnOk} onPress={saveFavorite}>
                  <Text style={ms.modalBtnText}>Kaydet</Text>
                </TouchableOpacity>
                <TouchableOpacity style={ms.modalBtnCancel} onPress={() => setShowFavModal(false)}>
                  <Text style={ms.modalBtnText}>İptal</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ANA EKRAN (plan + navigate)
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={ms.root}>

      {/* HARİTA */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_DEFAULT}
        customMapStyle={t.mapStyle}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass
        showsScale
        initialRegion={{
          latitude: userLocation?.latitude ?? 41.0082,
          longitude: userLocation?.longitude ?? 28.9784,
          latitudeDelta: 0.05, longitudeDelta: 0.05,
        }}
      >
        {startPoint && <Marker coordinate={startPoint} title="Başlangıç" pinColor={GREEN} />}
        {endPoint   && <Marker coordinate={endPoint}   title="Bitiş"     pinColor={RED} />}
        {stops.map((stop, i) => (
          <Marker key={stop.id}
            coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}
            title={`Durak ${i + 1}`} pinColor={BLUE} />
        ))}

        {/* Seçili rota — kalın, canlı renk, kenarlık efekti */}
        {selectedRoute?.polylineCoords?.length > 0 && (<>
          {/* Gölge/kenarlık katmanı */}
          <Polyline
            coordinates={selectedRoute.polylineCoords}
            strokeColor={darkMode ? '#001133' : '#1A5276'}
            strokeWidth={12}
            lineCap="round"
            lineJoin="round"
          />
          {/* Ana çizgi */}
          <Polyline
            coordinates={selectedRoute.polylineCoords}
            strokeColor={mode === 'navigate' ? '#3498DB' : '#FF6B35'}
            strokeWidth={8}
            lineCap="round"
            lineJoin="round"
          />
          {/* Parlak iç çizgi */}
          <Polyline
            coordinates={selectedRoute.polylineCoords}
            strokeColor={mode === 'navigate' ? '#85C1E9' : '#FFB347'}
            strokeWidth={3}
            lineCap="round"
            lineJoin="round"
          />
        </>)}

        {/* Alternatif rotalar */}
        {routes.map((route, idx) =>
          idx !== selectedIdx && route.polylineCoords?.length > 0 ? (
            <Polyline key={idx}
              coordinates={route.polylineCoords}
              strokeColor={darkMode ? '#44566C' : '#AEB6BF'}
              strokeWidth={5}
              lineCap="round"
            />
          ) : null
        )}
      </MapView>

      {/* Navigasyon hız göstergesi */}
      {mode === 'navigate' && (
        <SpeedMeter speed={currentSpeed} darkMode={darkMode} />
      )}

      {/* NAVİGASYON ÜST ADIM PANELİ */}
      {mode === 'navigate' && currentStep && (
        <View style={[ms.stepPanel, { backgroundColor: darkMode ? '#0F3460' : DARK }]}>
          <TouchableOpacity onPress={prevStep} style={ms.stepArrow}>
            <Text style={ms.stepArrowText}>‹</Text>
          </TouchableOpacity>
          <Text style={ms.stepIconTxt}>{stepIcon(currentStep.type)}</Text>
          <View style={ms.stepTextBox}>
            <Text style={ms.stepInstruction} numberOfLines={2}>{currentStep.instruction}</Text>
            <Text style={ms.stepDist}>
              {currentStep.distance < 1
                ? `${Math.round(currentStep.distance * 1000)} m`
                : `${currentStep.distance.toFixed(1)} km`}
            </Text>
          </View>
          <TouchableOpacity onPress={nextStep} style={ms.stepArrow}>
            <Text style={ms.stepArrowText}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={ms.stopNavBtn} onPress={stopNavigation}>
            <Text style={ms.stopNavText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* NAVİGASYON ALT BAR */}
      {mode === 'navigate' && selectedRoute && (
        <View style={[ms.navBar, { backgroundColor: darkMode ? '#0F3460' : '#1A252F' }]}>
          <View style={ms.navBarItem}>
            <Text style={ms.navBarValue}>{selectedRoute.distanceKm}</Text>
            <Text style={ms.navBarLabel}>km</Text>
          </View>
          <View style={ms.navBarDiv} />
          <View style={ms.navBarItem}>
            <Text style={ms.navBarValue}>{selectedRoute.durationMinutes}</Text>
            <Text style={ms.navBarLabel}>dakika</Text>
          </View>
          <View style={ms.navBarDiv} />
          <View style={ms.navBarItem}>
            <Text style={ms.navBarValue}>{currentStepIdx + 1}/{selectedRoute.steps.length}</Text>
            <Text style={ms.navBarLabel}>adım</Text>
          </View>
          <View style={ms.navBarDiv} />
          <TouchableOpacity style={ms.voiceBtn} onPress={() => setVoiceEnabled((v) => !v)}>
            <Text style={ms.voiceBtnText}>{voiceEnabled ? '🔊' : '🔇'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* PLANLAMA ALT PANEL */}
      {mode === 'plan' && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[ms.bottomSheet, { backgroundColor: t.sheet }]}
        >
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}>

            <View style={ms.sheetHandle} />

            {/* Üst bar */}
            <View style={ms.topBar}>
              <Text style={[ms.sheetTitle, { color: t.text }]}>🏍️ KuryeNav Pro</Text>
              <View style={ms.topBarRight}>
                {/* Karanlık mod toggle */}
                <Text style={{ fontSize: 16, marginRight: 4 }}>{darkMode ? '🌙' : '☀️'}</Text>
                <Switch
                  value={darkMode}
                  onValueChange={toggleDark}
                  trackColor={{ false: '#DDE1E7', true: '#0F3460' }}
                  thumbColor={darkMode ? BLUE : '#fff'}
                  style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                />
                {/* Geçmiş */}
                <TouchableOpacity style={ms.iconBtn} onPress={() => setMode('history')}>
                  <Text style={ms.iconBtnText}>📊</Text>
                </TouchableOpacity>
                {/* Favoriler */}
                <TouchableOpacity style={ms.iconBtn} onPress={() => setMode('favorites')}>
                  <Text style={ms.iconBtnText}>⭐</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Başlangıç */}
            <Text style={[ms.fieldLabel, { color: t.sub }]}>📍 Başlangıç</Text>
            <TextInput
              style={[ms.input, { backgroundColor: t.input, color: t.text, borderColor: t.border }]}
              placeholder="Başlangıç adresi" placeholderTextColor={t.sub}
              value={startAddress}
              onChangeText={(tx) => { setStartAddress(tx); setStartPoint(null); dStart(tx); }}
            />
            {startSug.length > 0 && (
              <SuggestionList suggestions={startSug} onSelect={pickStart} onDismiss={() => setStartSug([])} t={t} />
            )}

            {/* Bitiş */}
            <Text style={[ms.fieldLabel, { color: t.sub }]}>🎯 Bitiş</Text>
            <TextInput
              style={[ms.input, { backgroundColor: t.input, color: t.text, borderColor: t.border }]}
              placeholder="Bitiş adresi" placeholderTextColor={t.sub}
              value={endAddress}
              onChangeText={(tx) => { setEndAddress(tx); setEndPoint(null); dEnd(tx); }}
            />
            {endSug.length > 0 && (
              <SuggestionList suggestions={endSug} onSelect={pickEnd} onDismiss={() => setEndSug([])} t={t} />
            )}

            {/* Favorilerden hızlı seç */}
            {favorites.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 8 }} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
                {favorites.map((fav) => (
                  <TouchableOpacity key={fav.id}
                    style={[ms.favChip, { backgroundColor: t.card, borderColor: t.border }]}
                    onPress={() => routeFromFavorite(fav)}>
                    <Text style={[ms.favChipText, { color: t.text }]}>⭐ {fav.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Duraklar */}
            <View style={ms.stopsRow}>
              <Text style={[ms.fieldLabel, { color: t.sub }]}>📦 Duraklar ({stops.length})</Text>
              <TouchableOpacity style={ms.addBtn} onPress={() => setShowStopModal(true)}>
                <Text style={ms.addBtnText}>+ Ekle</Text>
              </TouchableOpacity>
            </View>
            {stops.map((stop, i) => (
              <View key={stop.id} style={[ms.stopRow, { backgroundColor: t.card, borderColor: t.border }]}>
                <Text style={[ms.stopNum, { color: ORANGE }]}>{i + 1}.</Text>
                <Text style={[ms.stopAddr, { color: t.text }]} numberOfLines={1}>{stop.address}</Text>
                <TouchableOpacity onPress={() => setStops((p) => p.filter((x) => x.id !== stop.id))}>
                  <Text style={ms.stopDel}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}

            {/* Hesapla */}
            <TouchableOpacity
              style={[ms.calcBtn, loading && ms.calcBtnDisabled]}
              onPress={calculateRoute} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={ms.calcBtnText}>🗺️ Rota Hesapla</Text>
              }
            </TouchableOpacity>

            {/* Rota chipler */}
            {routes.length > 0 && (
              <View style={ms.routesRow}>
                {routes.map((r, idx) => (
                  <TouchableOpacity key={idx}
                    style={[ms.routeChip, { backgroundColor: t.card, borderColor: selectedIdx === idx ? ORANGE : t.border },
                            selectedIdx === idx && ms.routeChipSel]}
                    onPress={() => setSelectedIdx(idx)}>
                    <Text style={[ms.routeChipText, { color: selectedIdx === idx ? ORANGE : t.text }]}>
                      Rota {idx + 1}
                    </Text>
                    <Text style={[ms.routeChipSub, { color: t.sub }]}>
                      {r.distanceKm}km • {r.durationMinutes}dk
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Başlat */}
            {selectedRoute && (
              <TouchableOpacity style={ms.startBtn} onPress={startNavigation}>
                <Text style={ms.startBtnText}>🚀 Navigasyonu Başlat</Text>
              </TouchableOpacity>
            )}

            {/* Yol tarifi adımları */}
            {selectedRoute?.steps?.length > 0 && (
              <View style={[ms.stepsBox, { backgroundColor: t.card, borderColor: t.border }]}>
                <Text style={[ms.stepsTitle, { color: t.text }]}>📋 Yol Tarifi</Text>
                {selectedRoute.steps.map((step, i) => (
                  <View key={i} style={[ms.stepRow, { borderBottomColor: t.border }]}>
                    <Text style={ms.stepRowIcon}>{stepIcon(step.type)}</Text>
                    <View style={ms.stepRowText}>
                      <Text style={[ms.stepRowInst, { color: t.text }]}>{step.instruction}</Text>
                      <Text style={[ms.stepRowDist, { color: t.sub }]}>
                        {step.distance < 1
                          ? `${Math.round(step.distance * 1000)} m`
                          : `${step.distance.toFixed(1)} km`}
                        {step.duration > 0 ? ` • ${Math.ceil(step.duration / 60)} dk` : ''}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* DURAK MODAL */}
      <Modal visible={showStopModal} transparent animationType="slide"
        onRequestClose={() => setShowStopModal(false)}>
        <TouchableOpacity style={ms.modalOverlay} activeOpacity={1} onPress={() => setShowStopModal(false)}>
          <View style={[ms.modalBox, { backgroundColor: t.sheet }]} onStartShouldSetResponder={() => true}>
            <Text style={[ms.modalTitle, { color: t.text }]}>📦 Durak Ekle</Text>
            <TextInput
              style={[ms.input, { backgroundColor: t.input, color: t.text, borderColor: t.border }]}
              placeholder="Durak adresi" placeholderTextColor={t.sub}
              value={stopText}
              onChangeText={(tx) => { setStopText(tx); setStopPoint(null); dStop(tx); }}
              autoFocus
            />
            {stopSug.length > 0 && (
              <SuggestionList suggestions={stopSug} onSelect={pickStop} onDismiss={() => setStopSug([])} t={t} />
            )}
            <View style={ms.modalBtns}>
              <TouchableOpacity style={ms.modalBtnOk} onPress={addStop}>
                <Text style={ms.modalBtnText}>Ekle</Text>
              </TouchableOpacity>
              <TouchableOpacity style={ms.modalBtnCancel} onPress={() => {
                setShowStopModal(false); setStopText(''); setStopPoint(null); setStopSug([]);
              }}>
                <Text style={ms.modalBtnText}>İptal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}

// Karanlık tema rengi
const DARK = '#2C3E50';

// ── Stiller ────────────────────────────────────────────────────────────────────
const ms = StyleSheet.create({
  root: { flex: 1 },

  // Geçmiş / Favoriler ekranı header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 52 : 32, paddingBottom: 14, paddingHorizontal: 16 },
  headerBack: { color: '#fff', fontSize: 15, fontWeight: '600' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },

  // Özet kartı
  summaryRow: { flexDirection: 'row', marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    borderRadius: 14, borderWidth: 1, padding: 14, alignItems: 'center', justifyContent: 'space-around' },
  summaryItem: { alignItems: 'center' },
  summaryVal: { fontSize: 24, fontWeight: '900' },
  summaryLabel: { fontSize: 11, marginTop: 2 },
  summaryDivider: { width: 1, height: 36 },

  // Geçmiş kart
  histCard: { borderRadius: 12, borderWidth: 1, padding: 13, marginBottom: 10 },
  histCardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  histDate: { fontSize: 12 },
  histKm: { fontSize: 14, fontWeight: '800' },
  histFrom: { fontSize: 13, marginBottom: 2 },
  histTo:   { fontSize: 13, marginBottom: 6 },
  histFooter: { flexDirection: 'row', gap: 12 },
  histTag: { fontSize: 12 },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 15 },

  // Favori kart
  favCard: { borderRadius: 12, borderWidth: 1, padding: 13, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', gap: 10 },
  favName: { fontSize: 15, fontWeight: '700' },
  favAddr: { fontSize: 12, marginTop: 2 },
  favRouteBtn: { backgroundColor: ORANGE, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  favRouteTxt: { color: '#fff', fontSize: 13, fontWeight: '600' },
  favDelBtn: { padding: 6 },
  favDelTxt: { fontSize: 18 },

  // Navigasyon üst panel
  stepPanel: { position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 52 : 32, paddingBottom: 16,
    paddingHorizontal: 12, gap: 8 },
  stepArrow: { padding: 8 },
  stepArrowText: { color: '#fff', fontSize: 28, fontWeight: '300' },
  stepIconTxt: { fontSize: 30 },
  stepTextBox: { flex: 1 },
  stepInstruction: { color: '#fff', fontSize: 16, fontWeight: '700' },
  stepDist: { color: '#BDC3C7', fontSize: 13, marginTop: 3 },
  stopNavBtn: { backgroundColor: RED, borderRadius: 20,
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  stopNavText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  // Navigasyon alt bar
  navBar: { position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', paddingVertical: 14,
    paddingBottom: Platform.OS === 'ios' ? 30 : 14,
    alignItems: 'center', justifyContent: 'space-around' },
  navBarItem: { alignItems: 'center' },
  navBarValue: { color: '#fff', fontSize: 22, fontWeight: '900' },
  navBarLabel: { color: '#7F8C8D', fontSize: 11, marginTop: 2 },
  navBarDiv: { width: 1, height: 36, backgroundColor: '#34495E' },
  voiceBtn: { backgroundColor: '#34495E', borderRadius: 20,
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  voiceBtnText: { fontSize: 18 },

  // Alt sheet
  bottomSheet: { position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    maxHeight: SH * 0.60, paddingHorizontal: 16, paddingTop: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15, shadowRadius: 10, elevation: 24 },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#DDE1E7',
    borderRadius: 2, alignSelf: 'center', marginBottom: 10 },

  // Üst bar
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sheetTitle: { fontSize: 17, fontWeight: '800' },
  iconBtn: { padding: 6 },
  iconBtnText: { fontSize: 20 },

  // Form
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  input: { borderRadius: 10, paddingHorizontal: 13, paddingVertical: 10,
    fontSize: 14, marginBottom: 6, borderWidth: 1 },

  // Favori chip
  favChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  favChipText: { fontSize: 13, fontWeight: '600' },

  // Duraklar
  stopsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  addBtn: { backgroundColor: GREEN, paddingHorizontal: 13, paddingVertical: 6, borderRadius: 8 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  stopRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 9, marginBottom: 5, borderWidth: 1 },
  stopNum: { fontSize: 13, fontWeight: '700', marginRight: 8, width: 20 },
  stopAddr: { flex: 1, fontSize: 13 },
  stopDel: { fontSize: 17, color: ORANGE, paddingLeft: 8 },

  // Hesapla
  calcBtn: { backgroundColor: ORANGE, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginVertical: 8 },
  calcBtnDisabled: { opacity: 0.55 },
  calcBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Rota chipler
  routesRow: { flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  routeChip: { flex: 1, minWidth: 90, borderRadius: 10, borderWidth: 2,
    paddingVertical: 8, alignItems: 'center' },
  routeChipSel: { borderColor: ORANGE },
  routeChipText: { fontSize: 13, fontWeight: '700' },
  routeChipSub: { fontSize: 11, marginTop: 2 },

  // Başlat
  startBtn: { backgroundColor: GREEN, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  startBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Adımlar
  stepsBox: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 10 },
  stepsTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10,
    gap: 10, paddingBottom: 10, borderBottomWidth: 1 },
  stepRowIcon: { fontSize: 20, width: 28 },
  stepRowText: { flex: 1 },
  stepRowInst: { fontSize: 13, fontWeight: '500' },
  stepRowDist: { fontSize: 11, marginTop: 2 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '75%' },
  modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 12 },
  modalBtnOk:     { flex: 1, backgroundColor: ORANGE, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  modalBtnCancel: { flex: 1, backgroundColor: '#7F8C8D', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  modalBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Geçmiş/favori modal input
  input: { borderRadius: 10, paddingHorizontal: 13, paddingVertical: 10,
    fontSize: 14, marginBottom: 6, borderWidth: 1 },
});
