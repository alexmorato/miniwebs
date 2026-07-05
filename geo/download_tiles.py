#!/usr/bin/env python3
"""Download slippy map tiles into a local folder structure: tiles/z/x/y.png.

Example:
    python download_tiles.py \
        --route-file ./ruta.gpx \
        --min-zoom 12 --max-zoom 16 \
        --out ./tiles
"""

from __future__ import annotations

import argparse
import json
import math
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

MIN_LAT = -85.05112878
MAX_LAT = 85.05112878


def clamp_lat(lat: float) -> float:
    return max(MIN_LAT, min(MAX_LAT, lat))


def lon_to_xtile(lon: float, zoom: int) -> int:
    n = 2**zoom
    x = (lon + 180.0) / 360.0 * n
    return int(math.floor(x))


def lat_to_ytile(lat: float, zoom: int) -> int:
    lat = clamp_lat(lat)
    lat_rad = math.radians(lat)
    n = 2**zoom
    y = (1.0 - math.log(math.tan(lat_rad) + (1 / math.cos(lat_rad))) / math.pi) / 2.0 * n
    return int(math.floor(y))


def clamp_tile(value: int, zoom: int) -> int:
    max_idx = (2**zoom) - 1
    return max(0, min(max_idx, value))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Download map tiles to local folder")
    source_group = parser.add_mutually_exclusive_group(required=True)
    source_group.add_argument(
        "--bbox",
        nargs=4,
        type=float,
        metavar=("MIN_LON", "MIN_LAT", "MAX_LON", "MAX_LAT"),
        help="Bounding box in WGS84",
    )
    source_group.add_argument(
        "--route-file",
        help="Route file (.gpx, .kml, .geojson, .json) used to auto-calculate bbox",
    )
    parser.add_argument("--min-zoom", type=int, required=True, help="Minimum zoom level")
    parser.add_argument("--max-zoom", type=int, required=True, help="Maximum zoom level")
    parser.add_argument("--out", default="./tiles", help="Output folder")
    parser.add_argument(
        "--padding-km",
        type=float,
        default=0.5,
        help="Extra margin around auto bbox when using --route-file",
    )
    parser.add_argument(
        "--url-template",
        default="https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        help="Tile URL template",
    )
    parser.add_argument("--sleep", type=float, default=0.05, help="Delay between requests (seconds)")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing files")
    parser.add_argument("--dry-run", action="store_true", help="Only print summary")
    return parser.parse_args()


def _extract_points_from_geojson(data: dict) -> list[tuple[float, float]]:
    out: list[tuple[float, float]] = []

    def add_coords(coords):
        for item in coords:
            if isinstance(item, (list, tuple)) and item and isinstance(item[0], (list, tuple)):
                add_coords(item)
            elif isinstance(item, (list, tuple)) and len(item) >= 2:
                lon = float(item[0])
                lat = float(item[1])
                out.append((lon, lat))

    def scan(obj):
        if not isinstance(obj, dict):
            return
        t = obj.get("type")
        if t in ("LineString", "MultiLineString"):
            add_coords(obj.get("coordinates", []))
            return
        if t == "Feature":
            scan(obj.get("geometry"))
            return
        if t == "FeatureCollection":
            for f in obj.get("features", []):
                scan(f)

    scan(data)
    return out


def _extract_points_from_gpx(text: str) -> list[tuple[float, float]]:
    root = ET.fromstring(text)
    points: list[tuple[float, float]] = []
    for node in root.iter():
        tag = node.tag.split("}")[-1]
        if tag in ("trkpt", "rtept"):
            lat = node.attrib.get("lat")
            lon = node.attrib.get("lon")
            if lat is None or lon is None:
                continue
            points.append((float(lon), float(lat)))
    return points


def _extract_points_from_kml(text: str) -> list[tuple[float, float]]:
    root = ET.fromstring(text)
    points: list[tuple[float, float]] = []
    for node in root.iter():
        tag = node.tag.split("}")[-1]
        if tag != "coordinates":
            continue
        if node.text is None:
            continue
        for token in node.text.strip().split():
            parts = token.split(",")
            if len(parts) < 2:
                continue
            lon = float(parts[0])
            lat = float(parts[1])
            points.append((lon, lat))
    return points


def _expand_bbox(min_lon: float, min_lat: float, max_lon: float, max_lat: float, padding_km: float):
    if padding_km <= 0:
        return min_lon, min_lat, max_lon, max_lat

    center_lat = (min_lat + max_lat) / 2.0
    lat_pad_deg = padding_km / 111.32
    cos_lat = max(0.01, abs(math.cos(math.radians(center_lat))))
    lon_pad_deg = padding_km / (111.32 * cos_lat)

    return (
        max(-180.0, min_lon - lon_pad_deg),
        max(MIN_LAT, min_lat - lat_pad_deg),
        min(180.0, max_lon + lon_pad_deg),
        min(MAX_LAT, max_lat + lat_pad_deg),
    )


def bbox_from_route_file(route_file: str, padding_km: float) -> tuple[float, float, float, float]:
    path = Path(route_file)
    if not path.exists():
        raise SystemExit(f"Route file not found: {path}")

    ext = path.suffix.lower()
    text = path.read_text(encoding="utf-8-sig")
    points: list[tuple[float, float]]

    if ext == ".gpx":
        points = _extract_points_from_gpx(text)
    elif ext == ".kml":
        points = _extract_points_from_kml(text)
    elif ext in (".geojson", ".json"):
        data = json.loads(text)
        points = _extract_points_from_geojson(data)
    else:
        raise SystemExit("Unsupported route format. Use .gpx, .kml, .geojson, .json")

    if len(points) < 2:
        raise SystemExit("Route file does not contain enough points")

    lons = [p[0] for p in points]
    lats = [p[1] for p in points]
    min_lon, max_lon = min(lons), max(lons)
    min_lat, max_lat = min(lats), max(lats)

    return _expand_bbox(min_lon, min_lat, max_lon, max_lat, padding_km)


def build_tile_jobs(min_lon: float, min_lat: float, max_lon: float, max_lat: float, z: int):
    x1 = clamp_tile(lon_to_xtile(min_lon, z), z)
    x2 = clamp_tile(lon_to_xtile(max_lon, z), z)
    y1 = clamp_tile(lat_to_ytile(max_lat, z), z)
    y2 = clamp_tile(lat_to_ytile(min_lat, z), z)

    if x2 < x1:
        x1, x2 = x2, x1
    if y2 < y1:
        y1, y2 = y2, y1

    for x in range(x1, x2 + 1):
        for y in range(y1, y2 + 1):
            yield x, y


def download_file(url: str, destination: Path):
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "miniwebs-offline-map-downloader/1.0 (+local-use)",
            "Accept": "image/png,image/*;q=0.8,*/*;q=0.5",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        data = response.read()

    destination.parent.mkdir(parents=True, exist_ok=True)
    with open(destination, "wb") as f:
        f.write(data)


def main() -> int:
    args = parse_args()

    if args.route_file:
        min_lon, min_lat, max_lon, max_lat = bbox_from_route_file(args.route_file, args.padding_km)
        print(
            "Auto bbox from route: "
            f"min_lon={min_lon:.6f} min_lat={min_lat:.6f} "
            f"max_lon={max_lon:.6f} max_lat={max_lat:.6f}"
        )
    else:
        min_lon, min_lat, max_lon, max_lat = args.bbox

    if args.min_zoom < 0 or args.max_zoom < 0:
        raise SystemExit("Zoom must be >= 0")
    if args.max_zoom < args.min_zoom:
        raise SystemExit("max-zoom must be >= min-zoom")

    out_dir = Path(args.out)
    planned = 0
    jobs_by_zoom: dict[int, list[tuple[int, int]]] = {}

    for z in range(args.min_zoom, args.max_zoom + 1):
        jobs = list(build_tile_jobs(min_lon, min_lat, max_lon, max_lat, z))
        jobs_by_zoom[z] = jobs
        planned += len(jobs)

    print(f"Total tiles planned: {planned}")
    if args.dry_run:
        for z in range(args.min_zoom, args.max_zoom + 1):
            print(f"z{z}: {len(jobs_by_zoom[z])} tiles")
        return 0

    done = 0
    skipped = 0
    failed = 0

    for z in range(args.min_zoom, args.max_zoom + 1):
        jobs = jobs_by_zoom[z]
        print(f"Downloading z{z} ({len(jobs)} tiles)...")
        for x, y in jobs:
            rel_path = Path(str(z)) / str(x) / f"{y}.png"
            dest = out_dir / rel_path

            if dest.exists() and not args.overwrite:
                skipped += 1
                continue

            url = args.url_template.format(z=z, x=x, y=y)
            try:
                download_file(url, dest)
                done += 1
            except (urllib.error.URLError, TimeoutError, OSError) as err:
                failed += 1
                print(f"Failed {url}: {err}")

            if args.sleep > 0:
                time.sleep(args.sleep)

    print(f"Done={done} Skipped={skipped} Failed={failed}")
    print(f"Tiles folder: {out_dir.resolve()}")
    return 0 if failed == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
