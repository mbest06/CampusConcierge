// CampusConcierge Google Maps initialization

const VIRGINIA_TECH = {
  lat: 37.2296,
  lng: -80.4264
};

function initMap() {
  const mapElement = document.getElementById("map");

  if (!mapElement) {
    console.error('CampusConcierge: missing element with id="map".');
    return;
  }

  const map = new google.maps.Map(mapElement, {
    center: VIRGINIA_TECH,
    zoom: 16,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
    zoomControl: true,
    gestureHandling: "greedy"
  });

  new google.maps.Marker({
    map,
    position: VIRGINIA_TECH,
    title: "Virginia Tech"
  });

  // Available globally for future agent results and map markers.
  window.campusMap = map;
}

// Called if the Google Maps script fails to load.
window.gm_authFailure = () => {
  console.error("CampusConcierge: Google Maps authentication failed.");
};
