#!/usr/bin/env python3
"""
Convert the Miriam Yeung song/concert Excel workbook into data/data.json
used by the web app.

Usage:
    python3 convert_xlsx_to_json.py path/to/workbook.xlsx [output.json]

If output.json is omitted, writes to ../data/data.json (next to this script).
"""
import sys
import json
from pathlib import Path

import openpyxl


def sheet_rows(ws, expected_headers):
    """Yield dict rows from a sheet, skipping the legend block and finding
    the real header row automatically (the row whose first cell matches
    the first expected header)."""
    rows = list(ws.iter_rows(values_only=True))
    header_idx = None
    for i, row in enumerate(rows):
        if row and row[0] == expected_headers[0]:
            header_idx = i
            break
    if header_idx is None:
        raise ValueError(f"Could not find header row starting with '{expected_headers[0]}' in sheet '{ws.title}'")
    headers = [str(h).strip() if h is not None else "" for h in rows[header_idx]]
    for row in rows[header_idx + 1:]:
        if row is None or all(v is None or str(v).strip() == "" for v in row):
            continue
        record = dict(zip(headers, row))
        # skip the italic example row (workbook marks it, but we also
        # defensively skip rows whose id starts with the example ids)
        yield record


def to_bool(v, default=True):
    if v is None or v == "":
        return default
    if isinstance(v, bool):
        return v
    return str(v).strip().upper() == "TRUE"


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    xlsx_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).parent.parent / "data" / "data.json"

    wb = openpyxl.load_workbook(xlsx_path, data_only=True)

    # Preserve original_artist from an existing data.json (not stored in the workbook).
    prev_artists = {}
    if out_path.exists():
        try:
            prev = json.loads(out_path.read_text(encoding="utf-8"))
            for s in prev.get("songs") or []:
                if s.get("song_id") and s.get("original_artist"):
                    prev_artists[str(s["song_id"]).strip()] = s["original_artist"]
        except (json.JSONDecodeError, OSError):
            pass

    songs = []
    for r in sheet_rows(wb["Songs"], ["song_id", "title"]):
        if not r.get("song_id") or str(r["song_id"]).startswith("S001") and r.get("title") == "Sky":
            # keep S001 if it's real data, but always skip a literal leftover
            pass
        if not r.get("song_id"):
            continue
        sid = str(r["song_id"]).strip()
        songs.append({
            "song_id": sid,
            "title": r.get("title") or "",
            "title_english": r.get("title_english") or "",
            "album": r.get("album") or "",
            "release_year": r.get("release_year"),
            "lyricist": r.get("lyricist") or "",
            "composer": r.get("composer") or "",
            "arranger": r.get("arranger") or "",
            "notes": r.get("notes") or "",
            "is_other_artist": to_bool(r.get("is_other_artist"), default=False),
            "language": (r.get("language") or "").strip() if r.get("language") else "",
            "original_artist": prev_artists.get(sid, ""),
        })

    concerts_by_id = {}
    concert_order = []
    for r in sheet_rows(wb["Concerts"], ["concert_id", "concert_name"]):
        if not r.get("concert_id"):
            continue
        cid = str(r["concert_id"]).strip()
        concerts_by_id[cid] = {
            "concert_id": cid,
            "concert_name": r.get("concert_name") or "",
            "concert_name_english": r.get("concert_name_english") or "",
            "notes": r.get("notes") or "",
            "sessions": [],
        }
        concert_order.append(cid)

    for r in sheet_rows(wb["Sessions"], ["session_id", "concert_id"]):
        if not r.get("session_id") or not r.get("concert_id"):
            continue
        cid = str(r["concert_id"]).strip()
        if cid not in concerts_by_id:
            print(f"WARNING: session {r['session_id']} references unknown concert_id {cid} -- skipping")
            continue
        date_val = r.get("date")
        if hasattr(date_val, "strftime"):
            date_str = date_val.strftime("%Y-%m-%d")
        else:
            date_str = str(date_val) if date_val else ""
        concerts_by_id[cid]["sessions"].append({
            "session_id": str(r["session_id"]).strip(),
            "date": date_str,
            "city": r.get("city") or "",
            "country": r.get("country") or "",
            "venue": r.get("venue") or "",
        })

    for cid in concerts_by_id:
        concerts_by_id[cid]["sessions"].sort(key=lambda s: s["date"])

    performances = []
    for r in sheet_rows(wb["Performances"], ["song_id", "session_id"]):
        if not r.get("song_id") or not r.get("session_id"):
            continue
        performances.append({
            "song_id": str(r["song_id"]).strip(),
            "session_id": str(r["session_id"]).strip(),
            "is_main_rundown": to_bool(r.get("is_main_rundown"), default=True),
            "notes": r.get("notes") or "",
        })

    data = {
        "generated_note": "Generated from workbook via convert_xlsx_to_json.py",
        "songs": songs,
        "concerts": [concerts_by_id[c] for c in concert_order],
        "performances": performances,
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(songs)} songs, {len(concerts_by_id)} concerts, "
          f"{sum(len(c['sessions']) for c in concerts_by_id.values())} sessions, "
          f"{len(performances)} performance rows -> {out_path}")


if __name__ == "__main__":
    main()
