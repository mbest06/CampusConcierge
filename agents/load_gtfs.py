"""Turn a transit agency's GTFS zip into data/transit.json for the transit agent.

Usage (from the repo root):
    python agents/load_gtfs.py path/to/google_transit.zip

Get the zip from the transit agency's OFFICIAL site (Blacksburg Transit publishes a GTFS feed;
check the current download link and its terms of use there, or via the MobilityDatabase listing).
Standard library only - nothing to pip install.

What it writes: one item per bus stop that has service:
    title  = stop name          detail = "Served by routes: ..."
    lat/lng = stop location     tags   = route names (so questions mentioning a route match)
It does NOT compute live arrival times. `when` points people to the official schedule page.
"""
import csv
import io
import json
import sys
import zipfile
from collections import defaultdict
from datetime import date
from pathlib import Path

SCHEDULE_URL = "https://ridebt.org/schedules"  # official BT schedules page (change if you use another agency)
OUT = Path(__file__).resolve().parent.parent / "data" / "transit.json"


def read_csv(z: zipfile.ZipFile, name: str):
    """Yield rows of a GTFS text file as dicts (handles the BOM some feeds include)."""
    with z.open(name) as raw:
        text = io.TextIOWrapper(raw, encoding="utf-8-sig", newline="")
        yield from csv.DictReader(text)


def main(zip_path: str) -> None:
    with zipfile.ZipFile(zip_path) as z:
        names = set(z.namelist())
        for needed in ("routes.txt", "stops.txt", "trips.txt", "stop_times.txt"):
            if needed not in names:
                sys.exit(f"{needed} not found in {zip_path}. Is this a GTFS zip?")

        # Is the feed current? (calendar.txt has start_date / end_date as YYYYMMDD)
        if "calendar.txt" in names:
            starts, ends = [], []
            for row in read_csv(z, "calendar.txt"):
                starts.append(row.get("start_date", ""))
                ends.append(row.get("end_date", ""))
            if starts and ends:
                first, last = min(starts), max(ends)
                today = date.today().strftime("%Y%m%d")
                print(f"Feed service dates: {first} to {last}")
                if not (first <= today <= last):
                    print("WARNING: today is outside this feed's service dates. Download the latest feed.")

        route_name = {}
        for r in read_csv(z, "routes.txt"):
            route_name[r["route_id"]] = (r.get("route_short_name") or r.get("route_long_name") or r["route_id"]).strip()

        trip_route = {t["trip_id"]: t["route_id"] for t in read_csv(z, "trips.txt")}

        stop_routes = defaultdict(set)
        for st in read_csv(z, "stop_times.txt"):
            rid = trip_route.get(st["trip_id"])
            if rid:
                stop_routes[st["stop_id"]].add(route_name.get(rid, rid))

        items = []
        for s in read_csv(z, "stops.txt"):
            routes = sorted(stop_routes.get(s["stop_id"], []))
            if not routes:
                continue  # skip stops with no service
            try:
                lat, lng = float(s["stop_lat"]), float(s["stop_lon"])
            except (KeyError, ValueError):
                continue
            name = s["stop_name"].strip()
            items.append(
                {
                    "title": name,
                    "detail": f"Bus stop served by routes: {', '.join(routes)}",
                    "when": "Times vary by day - check the official schedule",
                    "where": name,
                    "sourceUrl": SCHEDULE_URL,
                    "costUsd": None,
                    "tags": ["bus", "stop", "transit"] + routes,
                    "lat": round(lat, 6),
                    "lng": round(lng, 6),
                }
            )

    doc = {"dataAsOf": date.today().isoformat(), "isSample": False, "items": items}
    OUT.write_text(json.dumps(doc, indent=2), encoding="utf-8")
    print(f"Wrote {len(items)} stops to {OUT}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Usage: python agents/load_gtfs.py path/to/google_transit.zip")
    main(sys.argv[1])
