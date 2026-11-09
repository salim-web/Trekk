"""Photo EXIF DateTimeOriginal Extraction & GPX Timestamp Spatial Pinning.

Extracts photo capture timestamp from EXIF and linearly interpolates against
adjacent GPS trackpoints to assign accurate 3D coordinates (lat, lon, elevation_m).
"""

import io
from datetime import datetime, timezone
from typing import List, Tuple, Optional
from PIL import Image, ExifTags
import gpxpy


class ExifSpatialPinningEngine:
    """Pins photos to high-altitude trail coordinates via timestamp matching."""

    @staticmethod
    def extract_exif_timestamp(image_bytes: bytes) -> Optional[datetime]:
        """Reads DateTimeOriginal from JPEG/HEIC EXIF metadata."""
        try:
            img = Image.open(io.BytesIO(image_bytes))
            exif = img.getexif()
            if not exif:
                return None

            # Look through main EXIF and IFD sub-dictionaries
            datetime_str = None
            for tag_id, value in exif.items():
                tag_name = ExifTags.TAGS.get(tag_id, tag_id)
                if tag_name in ("DateTimeOriginal", "DateTime"):
                    datetime_str = str(value)
                    break

            # Search in Exif IFD (tag 0x8769)
            if not datetime_str:
                if 0x8769 in exif:
                    sub_ifd = exif.get_ifd(0x8769)
                    for sub_tag, sub_val in sub_ifd.items():
                        tag_name = ExifTags.TAGS.get(sub_tag, sub_tag)
                        if tag_name == "DateTimeOriginal":
                            datetime_str = str(sub_val)
                            break

            if datetime_str:
                # Format: "YYYY:MM:DD HH:MM:SS"
                parsed = datetime.strptime(datetime_str, "%Y:%m:%d %H:%M:%S")
                return parsed.replace(tzinfo=timezone.utc)
        except Exception:
            pass
        return None

    @staticmethod
    def interpolate_trackpoints(
        photo_time: datetime,
        trackpoints: List[Tuple[datetime, float, float, float]],
    ) -> Optional[Tuple[float, float, float]]:
        """Given a photo timestamp and a sorted list of (time, lat, lon, ele),

        finds flanking points P_A and P_B and performs linear spatial interpolation.
        Returns (lat, lon, ele).
        """
        if not trackpoints:
            return None

        if photo_time.tzinfo is None:
            photo_time = photo_time.replace(tzinfo=timezone.utc)

        # Normalize trackpoint timestamps to UTC
        normalized_pts = []
        for t, lat, lon, ele in trackpoints:
            if t.tzinfo is None:
                t = t.replace(tzinfo=timezone.utc)
            normalized_pts.append((t, lat, lon, ele))

        normalized_pts.sort(key=lambda x: x[0])

        # Exact bounds check
        if photo_time <= normalized_pts[0][0]:
            _, lat, lon, ele = normalized_pts[0]
            return lat, lon, ele
        if photo_time >= normalized_pts[-1][0]:
            _, lat, lon, ele = normalized_pts[-1]
            return lat, lon, ele

        # Binary or linear scan for bracket [T_A, T_B]
        for i in range(len(normalized_pts) - 1):
            t_a, lat_a, lon_a, ele_a = normalized_pts[i]
            t_b, lat_b, lon_b, ele_b = normalized_pts[i + 1]

            if t_a <= photo_time <= t_b:
                total_duration = (t_b - t_a).total_seconds()
                if total_duration <= 0.001:
                    return lat_a, lon_a, ele_a

                alpha = (photo_time - t_a).total_seconds() / total_duration

                lat_interp = lat_a + alpha * (lat_b - lat_a)
                lon_interp = lon_a + alpha * (lon_b - lon_a)
                ele_interp = ele_a + alpha * (ele_b - ele_a)

                return (
                    round(lat_interp, 6),
                    round(lon_interp, 6),
                    round(ele_interp, 1),
                )

        return None

    @classmethod
    def parse_gpx_and_interpolate(
        cls,
        photo_bytes: bytes,
        gpx_xml_string: str,
    ) -> Tuple[Optional[datetime], Optional[Tuple[float, float, float]]]:
        """Helper combining EXIF extraction with GPX XML parsing."""
        dt = cls.extract_exif_timestamp(photo_bytes)
        if not dt:
            return None, None

        gpx = gpxpy.parse(gpx_xml_string)
        pts = []
        for track in gpx.tracks:
            for segment in track.segments:
                for p in segment.points:
                    if p.time:
                        pts.append((p.time, p.latitude, p.longitude, p.elevation or 0.0))

        if not pts:
            return dt, None

        coords = cls.interpolate_trackpoints(dt, pts)
        return dt, coords
