# Messi, Repositioned

An interactive D3.js critique and redesign for the STATS 401 individual project. The page compares Lionel Messi's La Liga shot profile across FC Barcelona manager periods from 2004/05 through 2020/21.

The first screen is the working visualization: an eight-period selector, two synchronized attacking-half pitches, and a normalized comparison plot. The original visualization, critique, audit, and 500–800 word report are included below the interactive analysis.

**[Explore the published visualization](https://owen-1234.github.io/messi-repositioned/)** · **[Read the project report](https://owen-1234.github.io/messi-repositioned/report.html)**

## Files

- `index.html`, `style.css`, `main.js`: interactive visualization and critique page
- `report.html`: 500–800 word project report
- `prepare_data.py`: reproducible acquisition, validation, and transformation script
- `data/shots.csv`: compact shot-level data loaded by D3
- `data/appearances.csv`: match-level exposure and manager data
- `data/audit.json`: source snapshot, validation counts, inferred fields, and period totals
- `assets/`: credited original images, StatsBomb attribution, and a screenshot of the redesign

## Reproduce

The data build uses only Python's standard library and a pinned StatsBomb commit:

```bash
python3 prepare_data.py
```

Serve the repository root so the browser can load external CSV/JSON:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

## Measurement rules

- Scope: Barcelona La Liga, 2004/05–2020/21
- Player: StatsBomb player ID `5503`
- Manager: Barcelona manager in match metadata; a missing value is filled only when the season has one known Barcelona manager
- Default shots: all non-penalty shots; penalties remain in the audit as context
- Minutes: union of lineup position intervals, capped at 90 regulation minutes per match
- Per-90 denominator: all positive regulation minutes in the selected manager period, including appearances with zero shots
- Stoppage-time shots: retained in the event numerator
- Density: share of the selected period's filtered shots in fixed 8 × 8 attacking-half cells (StatsBomb x = 60–120, y = 0–80)

## Interaction

Choose A and B from the selectors or click a manager on the chronological rail to replace B. Shot type filters both pitches and the metric numerator. Switch between normalized density and individual attempts; hover or focus a cell for its count and share, or select a shot to pin match details. Gold diamonds identify goals, while shot size encodes xG. Escape clears a pinned detail. The metric selector switches shots/90, NPxG/90, and NPxG/shot without changing the selected periods.

## Data credit

Data provided by [StatsBomb Open Data](https://github.com/statsbomb/open-data) for public, non-commercial analysis, pinned to commit `4b73468fc5b0f1950f9f66fada70ad3a4f9327cb`. The original visualization and reproduced critique screenshots are by [Abhilash Prakash](https://github.com/Abhilashup/Lionel-Messi-Shots-And-Goals-Data-Visualization-Project). This project makes descriptive comparisons, not causal claims about managers.
