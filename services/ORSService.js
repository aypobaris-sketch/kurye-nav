/**
 * OpenRouteService + Nominatim/Photon
 * Geometry: GeoJSON formatında istiyoruz (decode gerekmez)
 */

import axios from 'axios';
import { ORS_CONFIG } from '../config/orsConfig';

class ORSService {
  constructor() {
    this.cfg = ORS_CONFIG;
    this.apiKey = this.cfg.API_KEY;
    this.profile = this.cfg.COURIER_SETTINGS.profile;

    this.orsClient = axios.create({
      baseURL: 'https://api.openrouteservice.org',
      headers: {
        Authorization: this.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json, application/geo+json',
      },
    });

    this.nominatimClient = axios.create({
      baseURL: 'https://nominatim.openstreetmap.org',
      headers: {
        'User-Agent': 'KuryeNavPro/1.0',
        'Accept-Language': 'tr,en',
      },
    });
  }

  // ── 1. ADRES ARAMA ────────────────────────────────────────────────────────
  async searchAddress(address) {
    try {
      const res = await this.nominatimClient.get('/search', {
        params: { q: address, format: 'json', limit: 5, addressdetails: 1, countrycodes: 'tr' },
      });
      if (!res.data || res.data.length === 0)
        return { success: false, message: 'Adres bulunamadı' };

      const results = res.data.map((item) => ({
        address: item.display_name,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
      }));
      return { success: true, results };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  // ── 2. TERS GEOCODİNG ─────────────────────────────────────────────────────
  async reverseGeocode(latitude, longitude) {
    try {
      const res = await this.nominatimClient.get('/reverse', {
        params: { lat: latitude, lon: longitude, format: 'json' },
      });
      if (!res.data?.display_name) return { success: false, message: 'Adres bulunamadı' };
      return { success: true, address: res.data.display_name };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  // ── 3. ADRES ÖNERİLERİ ───────────────────────────────────────────────────
  async getSuggestions(text) {
    try {
      const res = await axios.get('https://photon.komoot.io/api/', {
        params: { q: text, limit: 8, lang: 'tr', bbox: '25.6,35.8,44.8,42.1' },
      });
      if (!res.data?.features?.length) return { success: true, results: [] };

      const results = res.data.features.map((f) => {
        const p = f.properties;
        const parts = [p.name, p.street, p.city, p.country].filter(Boolean);
        return {
          title: parts[0] || 'Bilinmeyen',
          subtitle: parts.slice(1).join(', '),
          latitude: f.geometry.coordinates[1],
          longitude: f.geometry.coordinates[0],
        };
      });
      return { success: true, results };
    } catch (err) {
      return { success: false, results: [] };
    }
  }

  // ── 4. ROTA HESAPLAMA ─────────────────────────────────────────────────────
  // geometry_simplify: false → tam detay
  // format: geojson → koordinat dizisi direkt kullanılabilir
  async calculateRoute(startPoint, endPoint, waypoints = []) {
    try {
      const coordinates = [
        [startPoint.longitude, startPoint.latitude],
        ...waypoints.map((wp) => [wp.longitude, wp.latitude]),
        [endPoint.longitude, endPoint.latitude],
      ];

      const body = {
        coordinates,
        preference: this.cfg.COURIER_SETTINGS.preference,
        units: 'km',
        language: 'tr',
        instructions: true,
        instructions_format: 'text',
        geometry: true,
        // GeoJSON formatında geometry iste
        alternative_routes: {
          target_count: 3,
          weight_factor: 1.4,
          share_factor: 0.6,
        },
        options: {
          avoid_features: this.cfg.COURIER_SETTINGS.avoid_features,
        },
      };

      // GeoJSON endpoint
      const res = await this.orsClient.post(
        `/v2/directions/${this.profile}/geojson`,
        body
      );

      const features = res.data?.features;
      if (!features || features.length === 0)
        return { success: false, message: 'Rota bulunamadı' };

      const routes = features.map((feature, idx) => {
        const props = feature.properties;
        const summary = props.summary;

        // GeoJSON coordinates: [lon, lat] → react-native-maps: {latitude, longitude}
        const polylineCoords = feature.geometry.coordinates.map(([lon, lat]) => ({
          latitude: lat,
          longitude: lon,
        }));

        // Adım adım talimatlar
        const steps = [];
        if (props.segments) {
          props.segments.forEach((seg) => {
            seg.steps.forEach((step) => {
              steps.push({
                instruction: step.instruction,
                distance: step.distance,
                duration: step.duration,
                type: step.type,
                name: step.name,
              });
            });
          });
        }

        return {
          id: idx,
          distance: summary.distance * 1000,
          duration: summary.duration,
          durationMinutes: Math.ceil(summary.duration / 60),
          distanceKm: summary.distance.toFixed(2),
          polylineCoords,  // haritada çizmek için
          steps,           // yön talimatları
          summary,
        };
      });

      return { success: true, routes };
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message;
      console.error('[ORSService] calculateRoute:', msg);
      return { success: false, message: msg };
    }
  }

  // ── 5. OPTİMİZASYON ──────────────────────────────────────────────────────
  async optimizeRoute(startPoint, stops) {
    try {
      const destinations = stops.slice(0, -1);
      const endPoint = stops[stops.length - 1];

      if (destinations.length === 0) {
        const result = await this.calculateRoute(startPoint, endPoint);
        if (result.success) {
          const r = result.routes[0];
          return { success: true, routes: result.routes,
            totalDistanceKm: r.distanceKm, totalDurationMinutes: r.durationMinutes };
        }
        return result;
      }

      const vehicles = [{
        id: 0, profile: this.profile,
        start: [startPoint.longitude, startPoint.latitude],
        end: [endPoint.longitude, endPoint.latitude],
        time_window: [0, 86400],
      }];

      const jobs = destinations.map((stop, idx) => ({
        id: idx + 1,
        location: [stop.longitude, stop.latitude],
        service: 120,
      }));

      const res = await this.orsClient.post('/optimization', { vehicles, jobs });

      if (!res.data?.routes?.length) return this._nnFallback(startPoint, stops);

      const optimizedStops = res.data.routes[0].steps
        .filter((s) => s.type === 'job')
        .map((s) => destinations[s.id - 1]);
      optimizedStops.push(endPoint);

      return this._routeAlongStops(startPoint, optimizedStops);
    } catch (err) {
      return this._nnFallback(startPoint, stops);
    }
  }

  async _nnFallback(startPoint, stops) {
    return this._routeAlongStops(startPoint, this._nearestNeighborTSP(startPoint, stops));
  }

  async _routeAlongStops(startPoint, orderedStops) {
    const endPoint = orderedStops[orderedStops.length - 1];
    const waypoints = orderedStops.slice(0, -1);
    const result = await this.calculateRoute(startPoint, endPoint, waypoints);
    if (!result.success) return result;
    const best = result.routes[0];
    return {
      success: true, routes: result.routes,
      totalDistanceKm: best.distanceKm,
      totalDurationMinutes: best.durationMinutes,
      stops: orderedStops,
    };
  }

  _nearestNeighborTSP(startPoint, stops) {
    const unvisited = [...stops];
    const visited = [];
    let current = startPoint;
    while (unvisited.length > 0) {
      let ni = 0, nd = this._haversine(current, unvisited[0]);
      for (let i = 1; i < unvisited.length; i++) {
        const d = this._haversine(current, unvisited[i]);
        if (d < nd) { nd = d; ni = i; }
      }
      const nearest = unvisited.splice(ni, 1)[0];
      visited.push(nearest);
      current = nearest;
    }
    return visited;
  }

  _haversine(p1, p2) {
    const R = 6371;
    const dLat = ((p2.latitude - p1.latitude) * Math.PI) / 180;
    const dLon = ((p2.longitude - p1.longitude) * Math.PI) / 180;
    const a = Math.sin(dLat/2)**2 +
      Math.cos(p1.latitude*Math.PI/180)*Math.cos(p2.latitude*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }
}

export default new ORSService();
