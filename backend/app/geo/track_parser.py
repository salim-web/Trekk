"""Backend Multi-Format Track Parser (.GPX, .TCX, .FIT) and CartoDEM Snapping Bridge."""

import io
import math
import struct
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple
from app.schemas.geo_schemas import RawGpsPoint
from app.geo.cartodem import cartodem_engine


class BackendTrackParser:
    """Parses .gpx, .tcx, or binary .fit files into normalized trackpoints and snaps them to CartoDEM."""

    @classmethod
    def parse_file(cls, filename: str, content_bytes: bytes) -> Dict[str, Any]:
        lower_name = filename.lower()
        if lower_name.endswith(".gpx"):
            points = cls.parse_gpx(content_bytes)
        elif lower_name.endswith(".tcx"):
            points = cls.parse_tcx(content_bytes)
        elif lower_name.endswith(".fit"):
            points = cls.parse_fit(content_bytes)
        else:
            # Check content prefix
            if b"<gpx" in content_bytes[:200]:
                points = cls.parse_gpx(content_bytes)
            elif b"<TrainingCenterDatabase" in content_bytes[:200]:
                points = cls.parse_tcx(content_bytes)
            else:
                points = cls.parse_fit(content_bytes)

        if not points:
            raise ValueError(f"No valid GPS trackpoints found in {filename}")

        # Snap to CartoDEM
        snap_response = cartodem_engine.snap_track(points, apply_smoothing=True)

        return {
            "filename": filename,
            "total_points": len(snap_response.points),
            "total_gain_m": snap_response.total_gain_m,
            "total_loss_m": snap_response.total_loss_m,
            "max_elevation_m": snap_response.max_elevation_m,
            "min_elevation_m": snap_response.min_elevation_m,
            "points": [p.model_dump() for p in snap_response.points],
        }

    @staticmethod
    def parse_gpx(content_bytes: bytes) -> List[RawGpsPoint]:
        root = ET.fromstring(content_bytes)
        # Handle default namespace
        ns = {"gpx": root.tag.split("}")[0].strip("{")} if "}" in root.tag else {}
        prefix = "gpx:" if ns else ""

        points = []
        base_time = datetime.now(timezone.utc).timestamp()
        idx = 0

        for trkpt in root.iter(f"{'{' + ns['gpx'] + '}' if ns else ''}trkpt"):
            lat = float(trkpt.attrib["lat"])
            lon = float(trkpt.attrib["lon"])

            ele_elem = trkpt.find(f"{prefix}ele", ns)
            ele = float(ele_elem.text) if ele_elem is not None and ele_elem.text else 0.0

            time_elem = trkpt.find(f"{prefix}time", ns)
            if time_elem is not None and time_elem.text:
                try:
                    dt = datetime.fromisoformat(time_elem.text.replace("Z", "+00:00"))
                    t = dt.timestamp()
                except Exception:
                    t = base_time + idx * 5.0
            else:
                t = base_time + idx * 5.0

            points.append(RawGpsPoint(lat=lat, lon=lon, ele=ele, timestamp=t))
            idx += 1

        return points

    @staticmethod
    def parse_tcx(content_bytes: bytes) -> List[RawGpsPoint]:
        root = ET.fromstring(content_bytes)
        points = []
        base_time = datetime.now(timezone.utc).timestamp()
        idx = 0

        for tp in root.iter():
            if tp.tag.endswith("Trackpoint"):
                lat_elem = None
                lon_elem = None
                alt_elem = None
                time_elem = None

                for child in tp.iter():
                    if child.tag.endswith("LatitudeDegrees"):
                        lat_elem = child
                    elif child.tag.endswith("LongitudeDegrees"):
                        lon_elem = child
                    elif child.tag.endswith("AltitudeMeters"):
                        alt_elem = child
                    elif child.tag.endswith("Time"):
                        time_elem = child

                if lat_elem is not None and lon_elem is not None and lat_elem.text and lon_elem.text:
                    lat = float(lat_elem.text)
                    lon = float(lon_elem.text)
                    ele = float(alt_elem.text) if alt_elem is not None and alt_elem.text else 0.0

                    if time_elem is not None and time_elem.text:
                        try:
                            dt = datetime.fromisoformat(time_elem.text.replace("Z", "+00:00"))
                            t = dt.timestamp()
                        except Exception:
                            t = base_time + idx * 5.0
                    else:
                        t = base_time + idx * 5.0

                    points.append(RawGpsPoint(lat=lat, lon=lon, ele=ele, timestamp=t))
                    idx += 1

        return points

    @staticmethod
    def parse_fit(content_bytes: bytes) -> List[RawGpsPoint]:
        """Binary FIT parser extracting Global Message #20 (Record) coordinates."""
        if len(content_bytes) < 14:
            raise ValueError("Invalid FIT file length")

        header_size = content_bytes[0]
        points = []
        semicircles_to_deg = 180.0 / 2147483648.0
        fit_epoch_offset = 631065600
        base_time = datetime.now(timezone.utc).timestamp()
        idx = 0

        # Scan for records
        offset = header_size
        local_defs = {}

        while offset < len(content_bytes) - 1:
            header_byte = content_bytes[offset]
            offset += 1
            is_def = (header_byte & 0x40) != 0
            local_type = header_byte & 0x0F

            if is_def:
                if offset + 5 > len(content_bytes):
                    break
                arch = content_bytes[offset + 1]
                endian = "<" if arch == 0 else ">"
                global_num = struct.unpack(f"{endian}H", content_bytes[offset + 2 : offset + 4])[0]
                num_fields = content_bytes[offset + 4]
                offset += 5

                fields = []
                total_size = 0
                for _ in range(num_fields):
                    if offset + 3 > len(content_bytes):
                        break
                    f_num = content_bytes[offset]
                    f_size = content_bytes[offset + 1]
                    f_type = content_bytes[offset + 2]
                    offset += 3
                    fields.append((f_num, f_size, f_type))
                    total_size += f_size

                local_defs[local_type] = (global_num, endian, fields, total_size)
            else:
                if local_type not in local_defs:
                    break
                global_num, endian, fields, total_size = local_defs[local_type]
                if offset + total_size > len(content_bytes):
                    break

                if global_num == 20:  # Record message
                    field_offset = offset
                    lat, lon, ele, t = None, None, 0.0, base_time + idx * 5.0
                    for f_num, f_size, _ in fields:
                        if f_num == 0 and f_size == 4:
                            raw = struct.unpack(f"{endian}i", content_bytes[field_offset : field_offset + 4])[0]
                            if raw != 0x7FFFFFFF:
                                lat = raw * semicircles_to_deg
                        elif f_num == 1 and f_size == 4:
                            raw = struct.unpack(f"{endian}i", content_bytes[field_offset : field_offset + 4])[0]
                            if raw != 0x7FFFFFFF:
                                lon = raw * semicircles_to_deg
                        elif f_num == 2 and f_size == 2:
                            raw = struct.unpack(f"{endian}H", content_bytes[field_offset : field_offset + 2])[0]
                            if raw != 0xFFFF:
                                ele = (raw / 5.0) - 500.0
                        elif f_num == 253 and f_size == 4:
                            raw = struct.unpack(f"{endian}I", content_bytes[field_offset : field_offset + 4])[0]
                            if raw != 0xFFFFFFFF:
                                t = raw + fit_epoch_offset
                        field_offset += f_size

                    if lat is not None and lon is not None:
                        points.append(RawGpsPoint(lat=lat, lon=lon, ele=ele, timestamp=t))
                        idx += 1

                offset += total_size

        return points


backend_track_parser = BackendTrackParser()
