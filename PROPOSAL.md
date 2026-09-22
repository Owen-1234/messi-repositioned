# Individual Project Proposal: Messi's Shot Profile Across Barcelona Managers

**Course:** STATS 401, Visualization Critique and Redesign  
**Working title:** *Messi, Repositioned: Comparing His La Liga Shot Profile Across Barcelona Managers*  
**Format:** A focused D3.js redesign on the course GitHub Pages website, with a separate 500-800 word critique report.  
**Status:** Design proposal. The descriptive findings will be written only after the complete shot-level dataset is audited.

## Question and Argument

How do the locations, frequency, and modeled quality of Lionel Messi's **non-penalty La Liga shots** compare across the Barcelona manager periods recorded in StatsBomb's match metadata from 2004/05 through 2020/21?

This is a comparison of observed periods, not an estimate of a manager's causal effect. The central visualization argument is more specific: the [original two-part shot-map series][original] makes the geography of Messi's attempts visible, but overlap, unequal period lengths, and separated panels make cross-period comparisons difficult. A compact, linked redesign can retain the pitch context while making spatial patterns and standardized rates easier to read.

**Audience:** football-interested readers who understand a pitch and a goal but do not need prior knowledge of expected goals. The page will define xG in one concise caption as a model-estimated probability that a shot becomes a goal.

**Reader tasks:**

1. **Locate:** Where are Messi's non-penalty attempts concentrated within a selected manager period?
2. **Compare:** How do shot frequency and average modeled chance quality compare when playing time and penalties are handled consistently?
3. **Identify change:** Which manager periods differ most clearly in shot location or quality, and what does the sample size permit us to say?

## Existing Visualization and Critique

The object of critique is Abhilash Prakash's [*Lionel Messi Shots and Goals Under Different Managers*][original]. Its [early-period image][early] and [late-period image][late] show shot locations on repeated pitches, grouped by eight manager periods. The author's [README][original] identifies StatsBomb for earlier years and Understat for 2014-2021. The original images will appear on the published page with title, creator, link, alt text, and source credit.

**Strengths.** First, pitch coordinates let viewers connect the marks to recognizable attacking areas instead of interpreting abstract axes. Second, repeating a pitch for each named period gives the series a useful small-multiple comparison structure. The original also makes actual goals visibly distinct from other attempts.

**Opportunities for improvement.**

| Observed issue | Why it matters for the reader's task | Proposed response |
| --- | --- | --- |
| Many marks occupy the same central shooting areas. | Overplotting obscures where attempts are concentrated and hides individual attempts beneath one another. | Toggle between an individual-event map and spatial density aggregated into fixed pitch bins. |
| Periods of very different lengths appear as piles of raw attempts and totals. | The eye can mistake time under a manager for a higher shooting rate. | Provide minutes and match context alongside non-penalty shots/90 and NPxG/90; never compare raw totals as rates. |
| Early and late periods are placed in separate images, with small annotations. | The viewer must remember the first group while examining the second, making cross-period comparison cumbersome. | One ordered selector and one aligned metric chart containing every verified period. |
| The README describes a StatsBomb/Understat split. | Cross-provider differences in event coding or xG models can complicate comparisons across the dividing year. | Rebuild every period from one pinned StatsBomb open-data release; disclose remaining historical coding limits. |
| The spatial view alone does not separate open-play shots from free kicks or penalties. | Shot type can change apparent distance and opportunity quality without a general shift in open-play shooting position. | Default to non-penalty shots and offer an Open play / Free kick filter; keep penalties as a separate contextual count. |

The first three rows are the core visualization critique. The last two strengthen the redesign's data validity rather than serving as cosmetic objections. The report will also acknowledge the cost of aggregation: density makes patterns legible but cannot preserve every event's exact location, which is why the event view remains available.

## Evidence Already Checked

These are checks on the **available source records**, not the eventual number of shots or verified minutes played:

| Checked source | Direct observation | Consequence |
| --- | --- | --- |
| [StatsBomb release announcement][release] | The Messi Data Biography is described as his Barcelona **La Liga** career across 2004/05-2020/21, not all competitions. | The title, captions, data documentation, and report will consistently say La Liga. |
| [StatsBomb La Liga match JSON][matches] at commit `4b73468fc5b0f1950f9f66fada70ad3a4f9327cb` | The 17 available season files contain **524 Barcelona match records**. Counts of Messi appearances and shots still require the lineup/event audit. | Do not equate available match files with appearances. |
| [2019/20 match JSON][season-2019] | Its 33 Barcelona records identify **14** with Ernesto Valverde Tejedor and **19** with Enrique Setien Solar in manager metadata. | A season-level manager label would misclassify this transition. |
| [2004/05 lineup example][lineup-early] | Messi's recorded appearance in one match has two adjacent position intervals, split by a tactical shift at 81:54. | Merge intervals before calculating playing time; do not add each position as a separate appearance. |
| Match metadata sampled across all 17 seasons | Observed `data_version` is `1.1.0` and `shot_fidelity_version` is `2`; `xy_fidelity_version` is `2` or absent in some 2017/18-2018/19 records. | Audit versions across every included match and report missing metadata honestly. |

The 524 figure describes the competition's released Barcelona match files, including any match in which Messi might not have played. It will not be used as a claim about his appearances. The manager list and period-level sample sizes in the finished chart will be computed from verified lineup and event records rather than hard-coded as eight groups.

## Data and Comparison Contract

**Source and snapshot.** Use the [StatsBomb open-data repository][statsbomb], pinned to the verified commit above. The preprocessing script will read competition/season metadata, each Barcelona match's metadata, its lineup, and its events. It will output small documented CSV/JSON files committed alongside the D3 page. The repo's [README][statsbomb] asks published analyses to credit StatsBomb and display its logo; the page will honor this attribution and state the non-commercial source terms described in the release announcement. No live API call is needed on GitHub Pages.

**Unit of analysis.** An observed Messi shot event in a Barcelona La Liga match; player `id=5503` where provided. Assign the period from that match's Barcelona manager metadata, not from the season. A named interim/acting manager stays a distinct observed category if present; missing or ambiguous manager metadata is flagged for audit, never silently assigned to a neighboring period. A manager label records the source metadata, not necessarily who stood on the touchline at every moment.

**Primary scope.** Non-penalty shots, including direct free kicks, by default. A shot-type control switches between **All non-penalty**, **Open play**, and **Direct free kick** when the event coding supports those categories. Penalties are excluded from the primary map and xG comparisons and shown separately as contextual totals. Do not compare a filtered numerator to an unlabeled or incompatible metric denominator. If free-kick classification or an xG field differs in any period, the audit will determine whether the affected view can be shown or must be simplified.

**Minutes and rates.** For each included match, form the union of Messi's lineup-position intervals, treating tactical shifts as continuous play rather than extra minutes, then cross-check starts/substitutions against events. For the regulation-time per-90 denominator, clip the match clock to 0-90 minutes, excluding stoppage-time additions consistently; document the treatment of null `to` values and substitutions. A 90-minute start-to-finish appearance contributes 90 regulation minutes. The denominator for every manager-period rate is his summed on-pitch minutes in that period, including matches with zero shots. Playing time is not `matches x 90` and is not inferred from shot events.

**Measures.** For each manager period, report match appearances, regulation minutes, non-penalty shots, and non-penalty goals as context. The primary comparison offers `non-penalty shots / minutes x 90` and `sum(non-penalty shot xG) / minutes x 90` (NPxG/90). A third selectable metric, `NPxG / non-penalty shot`, distinguishes mean chance quality from shooting volume. The same selected shot-type filter changes the relevant shot and xG numerators, while the on-pitch-minutes denominator remains his total observed playing time for that period. Label the metric accordingly, such as "Open-play shots / 90." An approximate shot-distance measure may be added only if the pitch-coordinate conversion is verified and clearly labeled. Goals minus xG will not be presented as a pure finishing-skill score.

**Validation gates.** The processing script will check unique match/event IDs, one manager resolution per included match, shot outcomes, nonnegative xG, missing coordinates, missing/overlapping lineup intervals, zero-minute records, seasonal coverage, version metadata, and reconciliation of chart totals with processed records. It will write a compact audit summary with the snapshot commit, included/excluded counts, and the precise transformation rules. Counts in this proposal are preliminary evidence; the final page will use only audited outputs.

## Redesign Specification

The published first screen will be the working visualization, not a decorative landing page. It contains three coordinated components:

1. **Ordered manager selector.** Each period shows its observed date span, Messi appearances, and minutes. A reader selects one period or compares two; short periods are visibly identified by their smaller exposure without implying statistical certainty.
2. **Pitch view.** A same-scale attacking pitch shows either individual shots or fixed-bin density. The density encoding uses the *share of that period's filtered shots* per bin, with a consistent color scale and fixed grid across comparisons; a separate count conveys the number of attempts. This prevents a long period from dominating the spatial pattern purely through more observations. The event view distinguishes goals using shape/outline as well as color and supplies date, opponent, minute, shot type, outcome, and xG on focus/hover. A two-period comparison uses aligned pitches with identical geometry and legend.
3. **Aligned metric dot plot.** All validated manager categories remain visible in chronological order. A small metric selector switches between non-penalty shots/90, NPxG/90, and NPxG/shot. Direct labels and a zero-based quantitative scale support precise comparisons; selected periods are highlighted but other periods remain for context. Values, appearances, and minutes are accessible in text as well as SVG.

The selector coordinates both charts. The shot-type filter changes the map and metric numerators together. This is a deliberately limited interaction set: no season-trend chart unless full-data exploration uncovers a distinct temporal question the three components cannot answer.

| Original problem | Decision | Improvement to test |
| --- | --- | --- |
| Heavy mark overlap | Individual shots / density toggle | Reader can locate dominant shooting zones without losing event-level inspection. |
| Unequal tenure and raw totals | On-pitch-minute denominators and aligned dot plot | Reader compares frequencies and xG on a shared basis. |
| Split images and weak labels | Chronological, linked period selector with one plot for all periods | Reader can make early/late comparisons without relying on memory. |
| Provider and shot-type mixing | Pinned StatsBomb snapshot and explicit non-penalty/shot-type scope | Reader can interpret differences under a stated, reproducible measurement contract. |

The key visualizations will be implemented with D3 scales, axes, data joins, filters, and responsive SVG. Controls will remain keyboard operable. The page will include clear loading/error/empty states, mobile layouts, accessible colors and direct labels, and reduced reliance on a tooltip for essential values.

## Evaluation, Report, and Deliverables

**Evaluation task.** Ask a reader to identify the period with a visibly different shooting concentration, compare two periods' shots/90 and NPxG/shot, and explain why the raw dot count alone is not a rate. Check whether those tasks are faster and less ambiguous in the redesign than in the original. The comparison is about task support, not a claim of causal football discovery.

**Interpretive boundaries.** Differences may coincide with age, role, teammates, tactics, opponents, and sample size. StatsBomb's historical coding and xG model may vary across time even within one provider; metadata checks do not prove identical measurement. A small period may be descriptively interesting but should not receive strong inferential language. Density smooths/aggregates positions, so an individual-event mode remains available.

**Course deliverables.** A website tab titled **Visualization Critique and Redesign** links to the original and source, displays original image(s), provides the D3 redesign, and cites the data, method, and image sources. A separate **500-800 word English report** will include original and redesigned screenshots and cover context (about 110 words), two strengths and at least three evidence-based weaknesses (about 230), three linked design decisions (about 230), and comparison/trade-offs (about 100). The exact wording and figure captions will be finalized after implementation and data audit. The processing script, external chart data files, audit summary, and README will allow someone else to reproduce the figures.

**Completion criteria.** Before publication, verify the data audit, original-vs-redesign mappings, 500-800 word report, source links, attribution, responsive layouts, keyboard and pointer interactions, and GitHub Pages deployment on real desktop/mobile viewports. The finished argument should explain *why the redesign improves the named tasks*, not merely show a more elaborate interface.

## References

- Abhilash Prakash, [*Lionel Messi Shots and Goals Under Different Managers*][original], GitHub project and original visualization images. Accessed 22 September 2026.
- StatsBomb, [*StatsBomb Release Free Lionel Messi Data: All Seasons From 2004/05-2020/21 Now Available*][release], official blog archive.
- StatsBomb, [Open Data repository][statsbomb] and [La Liga match files][matches], commit `4b73468fc5b0f1950f9f66fada70ad3a4f9327cb` (7 September 2026).

[original]: https://github.com/Abhilashup/Lionel-Messi-Shots-And-Goals-Data-Visualization-Project
[early]: https://user-images.githubusercontent.com/66258607/141074960-e1e107d2-bab4-444d-8911-76b78f108e16.png
[late]: https://user-images.githubusercontent.com/66258607/141075116-e78a49bc-bf7e-488e-9b6b-4fe4dce0a8af.png
[release]: https://blogarchive.statsbomb.com/news/statsbomb-release-free-messi-data-all-seasons-from-2004-05-2020-21-now-available/
[statsbomb]: https://github.com/statsbomb/open-data
[matches]: https://github.com/statsbomb/open-data/tree/4b73468fc5b0f1950f9f66fada70ad3a4f9327cb/data/matches/11
[season-2019]: https://github.com/statsbomb/open-data/blob/4b73468fc5b0f1950f9f66fada70ad3a4f9327cb/data/matches/11/42.json
[lineup-early]: https://github.com/statsbomb/open-data/blob/4b73468fc5b0f1950f9f66fada70ad3a4f9327cb/data/lineups/68314.json
