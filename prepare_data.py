"""Build auditable, compact Messi La Liga shot data from StatsBomb Open Data."""

from __future__ import annotations

import csv
import json
import math
import os
import sys
import time
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path


COMMIT = "4b73468fc5b0f1950f9f66fada70ad3a4f9327cb"
BASE = f"https://cdn.jsdelivr.net/gh/statsbomb/open-data@{COMMIT}/data"
FALLBACK = f"https://raw.githubusercontent.com/statsbomb/open-data/{COMMIT}/data"
SEASONS = (37, 38, 39, 40, 41, 21, 22, 23, 24, 25, 26, 27, 2, 1, 4, 42, 90)
MESSI_ID = 5503
OUTPUT = Path(__file__).resolve().parent / "data"
HEADERS = {"User-Agent": "STATS401-Messi-visualization/1.0 (educational research)"}


def fetch(path: str):
    error = None
    for attempt in range(4):
        for host in (BASE, FALLBACK):
            try:
                request = urllib.request.Request(f"{host}/{path}", headers=HEADERS)
                with urllib.request.urlopen(request, timeout=70) as response:
                    return json.load(response)
            except (OSError, ValueError, urllib.error.HTTPError) as exc:
                error = exc
        time.sleep(min(2**attempt, 8))
    raise RuntimeError(f"Failed to download {path}: {error}")


def clock(value):
    minutes, seconds = value.split(":")
    return int(minutes) + int(seconds) / 60


def minutes_played(positions):
    """Union regulation-time intervals so tactical position changes do not add time."""
    intervals = []
    for position in positions:
        start = min(90, clock(position["from"]))
        end = min(90, clock(position["to"])) if position["to"] else 90
        if end > start:
            intervals.append((start, end))
    intervals.sort()
    merged = []
    for start, end in intervals:
        if merged and start <= merged[-1][1] + 1 / 60:
            merged[-1] = (merged[-1][0], max(end, merged[-1][1]))
        else:
            merged.append((start, end))
    return sum(end - start for start, end in merged), len(intervals), len(merged)


def match_info(match):
    home = match["home_team"]["home_team_name"] == "Barcelona"
    away = match["away_team"]["away_team_name"] == "Barcelona"
    if home == away:
        raise ValueError(f"Barcelona team ambiguity in match {match['match_id']}")
    club = match["home_team"] if home else match["away_team"]
    managers = club.get("managers") or []
    if len(managers) > 1:
        raise ValueError(f"Expected one Barcelona manager in match {match['match_id']}: {managers}")
    return {
        "match_id": match["match_id"],
        "date": match["match_date"],
        "season": match["season"]["season_name"],
        "manager_id": managers[0]["id"] if managers else None,
        "manager": managers[0]["name"] if managers else None,
        "manager_source": "match" if managers else "missing",
        "opponent": match["away_team"]["away_team_name"] if home else match["home_team"]["home_team_name"],
        "data_version": match.get("metadata", {}).get("data_version"),
        "shot_fidelity": match.get("metadata", {}).get("shot_fidelity_version"),
        "xy_fidelity": match.get("metadata", {}).get("xy_fidelity_version"),
    }


def resolve_managers(matches):
    seasons = defaultdict(list)
    for match in matches:
        seasons[match["season"]].append(match)
    for season, rows in seasons.items():
        rows.sort(key=lambda row: (row["date"], row["match_id"]))
        known = {(row["manager_id"], row["manager"]) for row in rows if row["manager_id"] is not None}
        for index, row in enumerate(rows):
            if row["manager_id"] is not None:
                continue
            if len(known) == 1:
                manager = next(iter(known))
                source = "sole-known-manager-in-season"
            else:
                before = next((candidate for candidate in reversed(rows[:index]) if candidate["manager_id"]), None)
                after = next((candidate for candidate in rows[index + 1:] if candidate["manager_id"]), None)
                if not before or not after or before["manager_id"] != after["manager_id"]:
                    raise ValueError(f"Ambiguous manager in match {row['match_id']} ({season})")
                manager = (before["manager_id"], before["manager"])
                source = "matching-neighbors-in-season"
            row["manager_id"], row["manager"] = manager
            row["manager_source"] = source


def lineup_info(info):
    teams = fetch(f"lineups/{info['match_id']}.json")
    players = [player for team in teams if team["team_name"] == "Barcelona"
               for player in team["lineup"] if player["player_id"] == MESSI_ID]
    if len(players) > 1:
        raise ValueError(f"Multiple Messi lineup entries: {info['match_id']}")
    if not players:
        return None
    positions = players[0]["positions"]
    played, intervals, merged = minutes_played(positions)
    if not positions or not 0 <= played <= 90:
        raise ValueError(f"Invalid playing time: {info['match_id']} {positions}")
    return {**info, "minutes": round(played, 4),
            "position_intervals": intervals, "merged_intervals": merged}


def shots_in_match(info):
    events = fetch(f"events/{info['match_id']}.json")
    shots = []
    seen = set()
    for event in events:
        if event.get("type", {}).get("name") != "Shot" or event.get("player", {}).get("id") != MESSI_ID:
            continue
        event_id = event["id"]
        if event_id in seen:
            raise ValueError(f"Repeated shot event {event_id}")
        seen.add(event_id)
        shot = event["shot"]
        xy = event.get("location") or []
        xg = shot.get("statsbomb_xg")
        if len(xy) < 2 or not all(math.isfinite(float(v)) for v in xy[:2]):
            raise ValueError(f"Missing shot coordinate: {info['match_id']} {event_id}")
        if xg is None or not 0 <= float(xg) <= 1:
            raise ValueError(f"Invalid shot xG: {info['match_id']} {event_id}")
        if event.get("team", {}).get("name") != "Barcelona":
            raise ValueError(f"Non-Barcelona Messi shot: {info['match_id']} {event_id}")
        shots.append({
            "event_id": event_id, "match_id": info["match_id"], "date": info["date"],
            "season": info["season"], "manager_id": info["manager_id"],
            "opponent": info["opponent"], "minute": event["minute"],
            "x": xy[0], "y": xy[1], "xg": xg,
            "shot_type": shot["type"]["name"],
            "outcome": shot["outcome"]["name"],
            "body_part": shot.get("body_part", {}).get("name", "Unknown"),
        })
    return shots


def parallel_map(fn, items, label, max_workers=20):
    results = [None] * len(items)
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(fn, item): index for index, item in enumerate(items)}
        for done, future in enumerate(as_completed(futures), 1):
            index = futures[future]
            try:
                results[index] = future.result()
            except Exception:
                for pending in futures:
                    pending.cancel()
                raise
            if done % 50 == 0 or done == len(items):
                print(f"{label}: {done}/{len(items)}", flush=True)
    return results


def write_csv(path, rows, fields):
    with path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def main():
    season_files = parallel_map(lambda season: fetch(f"matches/11/{season}.json"), SEASONS, "Seasons")
    matches = [match_info(match) for season in season_files for match in season
               if match["home_team"]["home_team_name"] == "Barcelona"
               or match["away_team"]["away_team_name"] == "Barcelona"]
    if len({match["match_id"] for match in matches}) != len(matches):
        raise ValueError("Duplicate match IDs")
    matches.sort(key=lambda row: (row["date"], row["match_id"]))
    resolve_managers(matches)
    players = parallel_map(lineup_info, matches, "Lineups")
    zero_minute_lineups = [row for row in players if row is not None and row["minutes"] == 0]
    if zero_minute_lineups:
        zero_shots = parallel_map(shots_in_match, zero_minute_lineups, "Zero-minute event audit")
        if any(zero_shots):
            raise ValueError(f"Shots in zero-regulation-minute appearances: {[(row['match_id'], len(s)) for row, s in zip(zero_minute_lineups, zero_shots) if s]}")
    appearances = [row for row in players if row is not None and row["minutes"] > 0]
    all_shots = parallel_map(shots_in_match, appearances, "Events")
    shots = [shot for match_shots in all_shots for shot in match_shots]
    if len({shot["event_id"] for shot in shots}) != len(shots):
        raise ValueError("Duplicate shot IDs")
    if any(not 0 <= float(shot["x"]) <= 120 or not 0 <= float(shot["y"]) <= 80 for shot in shots):
        raise ValueError("Shot coordinate outside StatsBomb pitch")

    by_manager = defaultdict(list)
    for row in appearances:
        by_manager[row["manager_id"]].append(row)
    shot_types = Counter(shot["shot_type"] for shot in shots)
    periods = []
    for manager_id, rows in by_manager.items():
        period_shots = [shot for shot in shots if shot["manager_id"] == manager_id]
        nonpen = [shot for shot in period_shots if shot["shot_type"] != "Penalty"]
        minutes = sum(row["minutes"] for row in rows)
        periods.append({
            "manager_id": manager_id, "manager": rows[0]["manager"],
            "first": min(row["date"] for row in rows), "last": max(row["date"] for row in rows),
            "matches": len(rows), "minutes": round(minutes, 2),
            "shots": len(nonpen), "goals": sum(s["outcome"] == "Goal" for s in nonpen),
            "npxg": round(sum(float(s["xg"]) for s in nonpen), 4),
            "penalties": len(period_shots) - len(nonpen),
        })
    periods.sort(key=lambda row: row["first"])
    for row in periods:
        if row["minutes"] <= 0:
            raise ValueError(f"Zero minutes for {row['manager']}")

    audit = {
        "source": "StatsBomb Open Data", "commit": COMMIT,
        "season_files": len(SEASONS), "barcelona_match_records": len(matches),
        "messi_appearances": len(appearances), "shot_events": len(shots),
        "non_penalty_shots": sum(s["shot_type"] != "Penalty" for s in shots),
        "shot_types": dict(shot_types),
        "versions": [dict(data_version=d, shot_fidelity=s, xy_fidelity=x, matches=n)
                     for (d, s, x), n in sorted(Counter((m["data_version"], m["shot_fidelity"], m["xy_fidelity"])
                                                       for m in matches).items(), key=lambda item: str(item[0]))],
        "matches_with_tactical_position_splits": sum(row["position_intervals"] > row["merged_intervals"] for row in appearances),
        "matches_with_no_messi_lineup": len(matches) - len(appearances),
        "zero_regulation_minute_lineup_ids": [row["match_id"] for row in zero_minute_lineups],
        "manager_source_counts": dict(Counter(row["manager_source"] for row in matches)),
        "imputed_manager_matches": [{"match_id": row["match_id"], "season": row["season"],
                                     "manager": row["manager"], "rule": row["manager_source"]}
                                    for row in matches if row["manager_source"] != "match"],
        "periods": periods,
        "minutes_definition": "Union of Messi lineup position intervals, capped at 90 regulation minutes per match; stoppage-time shots remain in event numerators.",
    }
    OUTPUT.mkdir(exist_ok=True)
    write_csv(OUTPUT / "shots.csv", shots, list(shots[0]))
    write_csv(OUTPUT / "appearances.csv", appearances, list(appearances[0]))
    (OUTPUT / "audit.json").write_text(json.dumps(audit, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({key: audit[key] for key in ("barcelona_match_records", "messi_appearances", "shot_events", "non_penalty_shots", "shot_types", "periods")}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Data preparation failed: {exc}", file=sys.stderr)
        raise
