// CampusConcierge Google Maps initialization


const VIRGINIA_TECH = {
  lat: 37.2296,
  lng: -80.4264
};

const BOUNDS = {
  north: 37.26,
  south: 37.16,
  east: -80.39,
  west: -80.45
};

(function () {
  const script = document.createElement("script");
  script.src =
    "https://maps.googleapis.com/maps/api/js?key=AIzaSyBB1KdfAYLCo-tgcG-lABhrHkw2tQzB42A&loading=async&callback=initMap";
  script.async = true;
  document.head.appendChild(script);
})();

function initMap() {
  const mapElement = document.getElementById("map");

  if (!mapElement) {
    console.error('CampusConcierge: missing element with id="map".');
    return;
  }

  const map = new google.maps.Map(mapElement, {
    center: VIRGINIA_TECH,
    zoom: 16,
    mapId: "9cbe5199cbcc608c4302f8a8",
    restriction: {
      latLngBounds: BOUNDS,
      strictBounds: true,
    },
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
    zoomControl: true,
    gestureHandling: "greedy"
  });

  // Available globally for future agent results and map markers.
  window.campusMap = map;

  if (!navigator.geolocation) {
    console.warn(
      "CampusConcierge: geolocation is not supported. Using Virginia Tech."
    );
    return;
  }

  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      const userLocation = {
        lat: coords.latitude,
        lng: coords.longitude
      };

      map.setCenter(userLocation);
      map.setZoom(16);

      window.userLocation = userLocation;
      window.userLocationMarker = new google.maps.Marker({
        map,
        position: userLocation,
        title: "Your location",
        label: "You"
      });
    },
    (error) => {
      console.warn(
        `CampusConcierge: location unavailable (${error.message}). Using Virginia Tech.`
      );
      // No marker is added when location access fails.
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000
    }
  );
}

// Called if the Google Maps script fails to load.
window.gm_authFailure = () => {
  console.error("CampusConcierge: Google Maps authentication failed.");
};