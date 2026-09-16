// js/gmaps-config.js
//
// Put your own Google Maps JavaScript API key below. Get one at
// https://console.cloud.google.com/google/maps-apis — enable the
// "Maps JavaScript API", "Directions API", and "Distance Matrix API".
// Restrict the key to your domain(s) in the Cloud Console.
//
// Every page that needs real driving directions / ETA (reserve.html,
// navigate.html) includes this file and calls loadGoogleMaps(callback).

const GOOGLE_MAPS_API_KEY = 'YOUR_GOOGLE_MAPS_API_KEY';

let _gmapsLoadingPromise = null;
let _gmapsLoadedLanguage = null;

// Pass the current UI language (from ?lang=) so Google returns its own
// turn-by-turn instructions in Bangla too, not just VoltSpot's own text.
function loadGoogleMaps(language) {
  const lang = language === 'bn' ? 'bn' : 'en';

  // Google Maps' language is fixed once the script tag loads — if the
  // driver switches language after that, reload with the new language.
  if (window.google && window.google.maps && _gmapsLoadedLanguage === lang) {
    return Promise.resolve(window.google.maps);
  }
  if (_gmapsLoadingPromise && _gmapsLoadedLanguage === lang) return _gmapsLoadingPromise;

  _gmapsLoadingPromise = new Promise((resolve, reject) => {
    if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'YOUR_GOOGLE_MAPS_API_KEY') {
      reject(new Error('No Google Maps API key configured yet — add one in js/gmaps-config.js'));
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry&language=${lang}`;
    script.async = true;
    script.onload = () => { _gmapsLoadedLanguage = lang; resolve(window.google.maps); };
    script.onerror = () => reject(new Error('Google Maps failed to load.'));
    document.head.appendChild(script);
  });

  return _gmapsLoadingPromise;
}
