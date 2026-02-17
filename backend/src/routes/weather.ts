import { Router } from 'express';
import prisma from '../prisma';
import { isAuthenticated, getFamilyId } from '../middleware/auth';

const router = Router();

const weatherCodeMap: Record<number, string> = {
  0: 'Sereno',
  1: 'Prevalentemente sereno',
  2: 'Parzialmente nuvoloso',
  3: 'Nuvoloso',
  45: 'Nebbia',
  48: 'Nebbia con brina',
  51: 'Pioviggine',
  53: 'Pioviggine moderata',
  55: 'Pioviggine intensa',
  61: 'Pioggia debole',
  63: 'Pioggia moderata',
  65: 'Pioggia intensa',
  71: 'Neve debole',
  73: 'Neve moderata',
  75: 'Neve intensa',
  80: 'Rovesci',
  81: 'Rovesci moderati',
  82: 'Rovesci intensi',
  95: 'Temporale',
  96: 'Temporale con grandine',
  99: 'Temporale con grandine intensa',
};

router.get('/cities', isAuthenticated, async (req, res, next) => {
  try {
    const query = typeof req.query.query === 'string' ? req.query.query.trim() : '';
    const scope = typeof req.query.scope === 'string' ? req.query.scope.trim().toLowerCase() : 'world';

    if (query.length < 2) {
      return res.json({ results: [] });
    }

    const countryCode = scope === 'it' ? 'IT' : undefined;
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      query
    )}&count=8&language=it&format=json${countryCode ? `&countryCode=${countryCode}` : ''}`;

    const geoResp = await fetch(geoUrl);
    if (!geoResp.ok) {
      return res.status(502).json({ error: 'City search failed' });
    }

    const geoData = (await geoResp.json()) as any;
    const results = Array.isArray(geoData?.results) ? geoData.results : [];

    res.json({
      results: results.map((place: any) => {
        const name = place?.name || '';
        const admin = place?.admin1 || place?.admin2 || place?.admin3 || '';
        const country = place?.country || '';
        const displayName = [name, admin, country].filter(Boolean).join(', ');

        return {
          name,
          displayName,
          country,
          timezone: place?.timezone || undefined,
          latitude: place?.latitude,
          longitude: place?.longitude,
        };
      }),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const family = await prisma.family.findUnique({ where: { id: familyId } });

    const city = family?.city || 'Roma';
    const familyLatitude = family?.cityLatitude;
    const familyLongitude = family?.cityLongitude;
    let latitude = familyLatitude;
    let longitude = familyLongitude;
    let resolvedCity = family?.cityDisplayName || city;
    let timezone = family?.cityTimezone || 'Europe/Rome';

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        city
      )}&count=1&language=it&format=json`;

      const geoResp = await fetch(geoUrl);
      if (!geoResp.ok) {
        return res.status(502).json({ error: 'Weather geocoding failed' });
      }
      const geoData = (await geoResp.json()) as any;
      const place = geoData?.results?.[0];
      if (!place) {
        return res.status(404).json({ error: 'City not found' });
      }

      latitude = place.latitude;
      longitude = place.longitude;
      timezone = place.timezone || timezone;
      const displayName = [place.name, place.admin1, place.country].filter(Boolean).join(', ');
      resolvedCity = displayName || place.name || city;
    }

    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=${encodeURIComponent(timezone)}`;
    const forecastResp = await fetch(forecastUrl);
    if (!forecastResp.ok) {
      return res.status(502).json({ error: 'Weather fetch failed' });
    }
    const forecast = (await forecastResp.json()) as any;
    const current = forecast?.current;

    const temperature = current?.temperature_2m;
    const code = current?.weather_code;
    const description = typeof code === 'number' ? weatherCodeMap[code] || 'Meteo' : 'Meteo';

    res.json({
      city: resolvedCity,
      temperature,
      description,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
