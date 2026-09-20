const CONCIERGE_API_URL = "http://localhost:8000/api/concierge";

async function askConcierge(message) {
  const location = window.userLocation;
  const response = await fetch(CONCIERGE_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      latitude: location?.lat ?? null,
      longitude: location?.lng ?? null
    })
  });

  if (!response.ok) {
    throw new Error(`Concierge request failed (${response.status})`);
  }

  return response.json();
}

window.askConcierge = askConcierge;
