const state = { a: null, b: null, type: "nonpen", mode: "density", metric: "shots90", pinned: null };
const SHORT = new Map([
  [4953, "Rijkaard"], [36, "Guardiola"], [1001722, "Vilanova"],
  [163, "Martino"], [793, "Luis Enrique"], [227, "Valverde"],
  [238, "Setién"], [676, "Koeman"]
]);
const COLOR = { a: "#a50044", b: "#004d98", goal: "#edbb00", neutral: "#77777e" };
const fmt = d3.format(",.2f");
const fmt1 = d3.format(".1f");
const formatInt = d3.format(",.0f");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let shots = [], periods = [], audit = {}, initialized = false, metricsInitialized = false;

function shortName(period) { return SHORT.get(+period.manager_id) || period.manager.split(" ").at(-1); }
function findPeriod(id) { return periods.find(d => +d.manager_id === +id); }
function eligible(d) { return state.type === "nonpen" ? d.shot_type !== "Penalty" : d.shot_type === state.type; }
function shotsFor(id) { return shots.filter(d => +d.manager_id === +id && eligible(d)); }
function typeLabel() { return state.type === "nonpen" ? "non-penalty" : state.type === "Open Play" ? "open-play" : "direct free-kick"; }
function periodMetric(period, metric = state.metric) {
  const rows = shotsFor(period.manager_id);
  const xg = d3.sum(rows, d => d.xg);
  if (metric === "shots90") return rows.length * 90 / period.minutes;
  if (metric === "npxg90") return xg * 90 / period.minutes;
  return rows.length ? xg / rows.length : 0;
}
function transitionOf(selection, duration = 500) {
  return initialized && !reduceMotion ? selection.transition().duration(duration).ease(d3.easeCubicOut) : selection;
}

function renderRail() {
  const maxMinutes = d3.max(periods, d => d.minutes);
  const cards = d3.select("#manager-rail").selectAll("button.period").data(periods, d => d.manager_id).join("button")
    .attr("class", "period").attr("type", "button")
    .attr("data-selected", d => +d.manager_id === +state.a && +d.manager_id === +state.b ? "both" : +d.manager_id === +state.a ? "a" : +d.manager_id === +state.b ? "b" : null)
    .attr("aria-pressed", d => +d.manager_id === +state.a || +d.manager_id === +state.b ? "true" : "false")
    .attr("aria-label", d => `${shortName(d)}, ${d.matches} appearances, ${formatInt(d.minutes)} regulation minutes. Set as comparison period B.`)
    .html(d => {
      const selected = +d.manager_id === +state.a && +d.manager_id === +state.b ? "A/B" : +d.manager_id === +state.a ? "A" : +d.manager_id === +state.b ? "B" : "";
      return `${selected ? `<span class="period-slot">${selected}</span>` : ""}<span class="period-name">${shortName(d)}</span><span class="period-date">${d.first.slice(0, 4)}–${d.last.slice(0, 4)} · ${d.matches} apps</span><span class="period-bar"><span style="width:${100 * d.minutes / maxMinutes}%"></span></span>`;
    })
    .on("click", (_, d) => {
      if (+d.manager_id === +state.a) return;
      state.b = +d.manager_id;
      state.pinned = null;
      render();
    });
  cards.order();
  d3.select("#manager-a").property("value", state.a);
  d3.select("#manager-b").property("value", state.b);
  const a = findPeriod(state.a), b = findPeriod(state.b);
  d3.select("#comparison-note").text(`${a.matches} vs ${b.matches} appearances · ${formatInt(a.minutes)} vs ${formatInt(b.minutes)} regulation minutes`);
}

function addPitchBase(svg, toX, toY, letter) {
  const defs = svg.append("defs");
  defs.append("clipPath").attr("id", `pitch-clip-${letter}`).append("rect")
    .attr("x", toX(0)).attr("y", toY(120)).attr("width", toX(80) - toX(0)).attr("height", toY(60) - toY(120));
  const grass = svg.append("g").attr("aria-hidden", "true");
  d3.range(8).forEach(i => grass.append("rect")
    .attr("x", toX(0)).attr("y", toY(120 - i * 7.5))
    .attr("width", toX(80) - toX(0)).attr("height", Math.abs(toY(112.5) - toY(120)) + .5)
    .attr("fill", i % 2 ? "#237f51" : "#20784d"));
  grass.append("rect").attr("x", toX(0)).attr("y", toY(120)).attr("width", toX(80) - toX(0)).attr("height", toY(60) - toY(120)).attr("fill", "#0d3e2a").attr("opacity", .05);

  const goal = svg.append("g").attr("class", "goal-net pitch-line").attr("aria-hidden", "true");
  const gx1 = toX(36), gx2 = toX(44), goalY = toY(120), backY = goalY - 13;
  goal.append("path").attr("d", `M${gx1},${goalY} L${gx1},${backY} L${gx2},${backY} L${gx2},${goalY}`);
  d3.range(37, 44, 1.4).forEach(y => goal.append("line").attr("class", "soft").attr("x1", toX(y)).attr("x2", toX(y)).attr("y1", backY).attr("y2", goalY));
  d3.range(backY + 3, goalY, 3).forEach(y => goal.append("line").attr("class", "soft").attr("x1", gx1).attr("x2", gx2).attr("y1", y).attr("y2", y));

  const line = svg.append("g").attr("class", "pitch-line").attr("aria-hidden", "true");
  const rect = (x1, y1, x2, y2) => line.append("rect").attr("x", toX(y1)).attr("y", toY(x2)).attr("width", toX(y2) - toX(y1)).attr("height", toY(x1) - toY(x2));
  rect(60, 0, 120, 80);
  rect(102, 18, 120, 62);
  rect(114, 30, 120, 50);
  line.append("line").attr("x1", toX(0)).attr("x2", toX(80)).attr("y1", toY(60)).attr("y2", toY(60));
  const arc = d3.range(61).map(i => {
    const angle = 2 * Math.PI / 3 + i * (2 * Math.PI / 3) / 60;
    return [toX(40 + 12 * Math.sin(angle)), toY(108 + 12 * Math.cos(angle))];
  });
  line.append("path").attr("d", d3.line()(arc));
  line.append("circle").attr("cx", toX(40)).attr("cy", toY(108)).attr("r", 2.6).attr("fill", "rgba(255,255,255,.9)").attr("stroke", "none");
  svg.append("g").attr("class", "data-layer").attr("clip-path", `url(#pitch-clip-${letter})`);
}

function binsFor(rows) {
  const bins = d3.range(8).flatMap(xBin => d3.range(8).map(yBin => ({ xBin, yBin, count: 0, share: 0 })));
  const lookup = new Map(bins.map(d => [`${d.xBin}-${d.yBin}`, d]));
  rows.forEach(shot => {
    const xBin = Math.max(0, Math.min(7, Math.floor((shot.x - 60) / 7.5)));
    const yBin = Math.max(0, Math.min(7, Math.floor(shot.y / 10)));
    lookup.get(`${xBin}-${yBin}`).count += 1;
  });
  bins.forEach(d => { d.share = rows.length ? d.count / rows.length : 0; });
  return bins;
}

function densityColor(letter, share, maxShare) {
  if (!share) return "transparent";
  const t = Math.max(.12, Math.min(1, share / maxShare));
  return d3.interpolateRgb(letter === "a" ? "#f8dce7" : "#dbeafa", COLOR[letter])(t);
}

function zoneText(d) {
  const x0 = 60 + d.xBin * 7.5, x1 = x0 + 7.5;
  const y0 = d.yBin * 10, y1 = y0 + 10;
  return `StatsBomb coordinates x ${fmt1(x0)}–${fmt1(x1)}, y ${y0}–${y1}`;
}

function positionTooltip(event) {
  const node = document.querySelector("#shot-tooltip");
  if (node.hidden) return;
  const source = event.currentTarget?.getBoundingClientRect();
  const pointerX = Number.isFinite(event.clientX) && event.clientX ? event.clientX : source ? source.left + source.width / 2 : 12;
  const pointerY = Number.isFinite(event.clientY) && event.clientY ? event.clientY : source ? source.top : 12;
  const x = Math.min(window.innerWidth - node.offsetWidth - 10, pointerX + 13);
  const y = Math.min(window.innerHeight - node.offsetHeight - 10, pointerY + 13);
  node.style.left = Math.max(8, x) + "px";
  node.style.top = Math.max(8, y) + "px";
}

function showDensity(event, d, period, letter, pin = false) {
  if (!d.count) return;
  const message = `${shortName(period)} · ${d.count} ${typeLabel()} ${d.count === 1 ? "shot" : "shots"} · ${fmt1(d.share * 100)}% of the period total · ${zoneText(d)}`;
  d3.select("#event-detail-text").text(message);
  const tip = document.querySelector("#shot-tooltip");
  tip.innerHTML = `<strong>${d.count} ${d.count === 1 ? "shot" : "shots"} · ${fmt1(d.share * 100)}%</strong><span class="tooltip-meta">${shortName(period)} · ${zoneText(d)}</span>`;
  tip.hidden = false;
  positionTooltip(event);
  if (pin) state.pinned = { kind: "cell", letter, key: `${d.xBin}-${d.yBin}` };
}

function showShot(event, d, period, letter, pin = false) {
  const message = `${shortName(period)} · ${d.date} · Barcelona vs ${d.opponent} · ${d.minute}' · ${d.shot_type} · ${d.outcome} · xG ${fmt(d.xg)}`;
  d3.select("#event-detail-text").text(message);
  const tip = document.querySelector("#shot-tooltip");
  tip.innerHTML = `<strong>${d.outcome} · xG ${fmt(d.xg)}</strong><span class="tooltip-meta">${d.date} · ${d.opponent}<br>${d.minute}' · ${d.shot_type} · ${d.body_part}</span>`;
  tip.hidden = false;
  positionTooltip(event);
  if (pin) state.pinned = { kind: "shot", letter, key: d.event_id };
}

function resetDetail() {
  if (state.pinned) return;
  document.querySelector("#shot-tooltip").hidden = true;
  d3.select("#event-detail-text").text(state.mode === "density" ? "Hover or focus a density cell to inspect its count and share." : "Hover or focus a shot; select it to pin the match details. Gold diamonds are goals.");
}

function drawPitch(selector, managerId, letter, maxShare) {
  const rows = shotsFor(managerId);
  const period = findPeriod(managerId);
  const host = d3.select(selector);
  let svg = host.select("svg");
  const toX = d3.scaleLinear().domain([0, 80]).range([44, 596]);
  const toY = d3.scaleLinear().domain([60, 120]).range([420, 30]);
  if (svg.empty()) {
    svg = host.append("svg").attr("viewBox", "0 0 640 452").attr("role", "img");
    svg.append("title");
    svg.append("desc");
    addPitchBase(svg, toX, toY, letter);
  }
  svg.select("title").text(`${shortName(period)} attacking-half shot map`);
  svg.select("desc").text(`${rows.length} selected shots. The attacking goal is at the top; only the attacking half is shown because every included shot is beyond x 66.3.`);
  const layer = svg.select("g.data-layer");
  layer.selectAll(".mode-layer").filter(function() { return !d3.select(this).classed(`mode-${state.mode}`); }).remove();
  let modeLayer = layer.select(`g.mode-${state.mode}`);
  if (modeLayer.empty()) modeLayer = layer.append("g").attr("class", `mode-layer mode-${state.mode}`);

  if (state.mode === "density") {
    const cells = modeLayer.selectAll("rect.density-cell").data(binsFor(rows), d => `${d.xBin}-${d.yBin}`).join(
      enter => enter.append("rect").attr("class", "density-cell").attr("opacity", 0),
      update => update,
      exit => transitionOf(exit).attr("opacity", 0).remove()
    )
      .attr("x", d => toX(d.yBin * 10) + 1.3)
      .attr("y", d => toY(60 + (d.xBin + 1) * 7.5) + 1.3)
      .attr("width", toX(10) - toX(0) - 2.6)
      .attr("height", toY(60) - toY(67.5) - 2.6)
      .attr("rx", 1.5)
      .attr("tabindex", d => d.count ? 0 : null)
      .attr("role", d => d.count ? "button" : null)
      .attr("aria-label", d => d.count ? `${shortName(period)}, ${d.count} ${d.count === 1 ? "shot" : "shots"}, ${fmt1(d.share * 100)} percent, ${zoneText(d)}` : null)
      .style("pointer-events", d => d.count ? "all" : "none")
      .on("mouseenter focus", (event, d) => showDensity(event, d, period, letter))
      .on("mousemove", positionTooltip)
      .on("click", (event, d) => showDensity(event, d, period, letter, true))
      .on("keydown", (event, d) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); showDensity(event, d, period, letter, true); } })
      .on("mouseleave blur", resetDetail);
    transitionOf(cells).attr("fill", d => densityColor(letter, d.share, maxShare)).attr("opacity", d => d.count ? .86 : 0);
  } else {
    const symbol = d3.symbol();
    const marks = modeLayer.selectAll("path.shot").data(rows, d => d.event_id).join(
      enter => enter.append("path").attr("class", "shot").attr("opacity", 0).attr("transform", d => `translate(${toX(d.y)},${toY(d.x)}) scale(.2)`),
      update => update,
      exit => transitionOf(exit, 260).attr("opacity", 0).attr("transform", d => `translate(${toX(d.y)},${toY(d.x)}) scale(.2)`).remove()
    )
      .attr("d", d => symbol.type(d.outcome === "Goal" ? d3.symbolDiamond : d3.symbolCircle).size(22 + Math.sqrt(d.xg) * 105)())
      .attr("fill", d => d.outcome === "Goal" ? COLOR.goal : COLOR[letter])
      .attr("stroke", d => d.outcome === "Goal" ? "#312800" : "#fff")
      .attr("stroke-width", d => d.outcome === "Goal" ? 1.6 : .75)
      .attr("tabindex", 0).attr("role", "button")
      .attr("aria-label", d => `${d.date}, Barcelona against ${d.opponent}, ${d.outcome}, xG ${fmt(d.xg)}`)
      .on("mouseenter focus", (event, d) => showShot(event, d, period, letter))
      .on("mousemove", positionTooltip)
      .on("click", (event, d) => showShot(event, d, period, letter, true))
      .on("keydown", (event, d) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); showShot(event, d, period, letter, true); } })
      .on("mouseleave blur", resetDetail);
    transitionOf(marks).attr("opacity", .76).attr("transform", d => `translate(${toX(d.y)},${toY(d.x)}) scale(1)`);
  }
  svg.selectAll(".goal-net,.pitch-line").raise();
  const goals = rows.filter(d => d.outcome === "Goal").length;
  d3.select(`#pitch-${letter}-title`).text(shortName(period));
  d3.select(`#pitch-${letter}-meta`).text(`${formatInt(rows.length)} shots · ${formatInt(goals)} goals · ${formatInt(period.minutes)} min`);
}

function renderLegend(maxShare) {
  const legend = d3.select("#density-legend").style("display", state.mode === "density" ? "flex" : "none").html("");
  if (state.mode !== "density") return;
  legend.append("b").text("Share per cell");
  legend.append("span").text("0%");
  ["a", "b"].forEach(letter => {
    legend.append("span").text(letter.toUpperCase());
    d3.range(1, 5).forEach(i => legend.append("span").attr("class", "swatch").style("background", densityColor(letter, i / 4 * maxShare, maxShare)));
  });
  legend.append("span").text(`${fmt1(maxShare * 100)}%+`);
}

function renderPitch() {
  const allBins = periods.flatMap(d => binsFor(shotsFor(d.manager_id)));
  const maxShare = Math.max(.001, d3.max(allBins, d => d.share) || 0);
  drawPitch("#pitch-a", state.a, "a", maxShare);
  drawPitch("#pitch-b", state.b, "b", maxShare);
  renderLegend(maxShare);
  d3.select("#map-description").text(state.mode === "density"
    ? "Fixed 8 × 8 attacking-half cells show each period's share of attempts; both pitches use the same scale."
    : "One mark per shot: size encodes xG, color identifies the period, and gold diamonds identify goals.");
  state.pinned = null;
  resetDetail();
}

function metricMeta() {
  if (state.metric === "shots90") return { label: "Shots / 90", short: "shots per 90", format: fmt1 };
  if (state.metric === "npxg90") return { label: "NPxG / 90", short: "NPxG per 90", format: fmt };
  return { label: "NPxG / shot", short: "NPxG per shot", format: fmt };
}

function renderMetrics() {
  const container = document.querySelector("#metric-chart");
  const width = Math.max(320, container.clientWidth || 1120);
  const mobile = width < 560;
  const left = mobile ? 92 : 150, right = mobile ? 40 : 100, top = 35, rowHeight = mobile ? 43 : 47, bottom = 38;
  const height = top + periods.length * rowHeight + bottom;
  const values = periods.map(d => periodMetric(d));
  const max = d3.max(values) || 1;
  const x = d3.scaleLinear().domain([0, max * (mobile ? 1.2 : 1.14)]).range([left, width - right]);
  const meta = metricMeta();
  const svg = d3.select(container).selectAll("svg").data([null]).join("svg")
    .attr("viewBox", `0 0 ${width} ${height}`).attr("role", "img").attr("aria-label", `${meta.label} by manager period, in chronological order`);
  svg.selectAll("title").data([null]).join("title").text(`${meta.label} across eight Barcelona manager periods`);
  svg.selectAll("desc").data([null]).join("desc").text(`A zero-based aligned dot plot. Period A is garnet, period B is blue, and all other periods are gray.`);
  const axis = d3.axisBottom(x).ticks(mobile ? 4 : 6).tickSize(-(periods.length * rowHeight)).tickSizeOuter(0).tickFormat(state.metric === "shots90" ? d3.format(".1f") : d3.format(".2f"));
  let axisG = svg.selectAll("g.metric-axis").data([null]).join("g").attr("class", "metric-axis").attr("transform", `translate(0,${height - bottom})`);
  if (metricsInitialized && !reduceMotion) axisG = axisG.transition().duration(500);
  axisG.call(axis);
  svg.selectAll("text.axis-label").data([null]).join("text").attr("class", "axis-label").attr("x", left).attr("y", 17).attr("fill", "#66656c").attr("font-size", 10).attr("font-weight", 700).text(meta.label.toUpperCase());
  svg.selectAll("text.exposure-label").data([null]).join("text").attr("class", "exposure-label").attr("x", width - 2).attr("y", 17).attr("text-anchor", "end").attr("fill", "#66656c").attr("font-size", 9).text(mobile ? "MIN" : "REGULATION MINUTES");

  const rows = svg.selectAll("g.metric-row").data(periods, d => d.manager_id).join(enter => {
    const g = enter.append("g").attr("class", "metric-row");
    g.append("text").attr("class", "metric-row-label");
    g.append("line").attr("class", "metric-stem");
    g.append("circle").attr("class", "metric-dot");
    g.append("text").attr("class", "metric-slot").attr("fill", "#fff").attr("font-size", 8).attr("font-weight", 700).attr("text-anchor", "middle").attr("dominant-baseline", "central");
    g.append("text").attr("class", "metric-value");
    g.append("text").attr("class", "metric-exposure").attr("text-anchor", "end");
    return g;
  }).attr("transform", (_, i) => `translate(0,${top + i * rowHeight + rowHeight / 2})`);
  rows.select(".metric-row-label").attr("x", 0).attr("y", 4).text(d => shortName(d));
  const selectedColor = d => +d.manager_id === +state.a ? COLOR.a : +d.manager_id === +state.b ? COLOR.b : COLOR.neutral;
  const selected = d => +d.manager_id === +state.a || +d.manager_id === +state.b;
  rows.select(".metric-stem").attr("x1", left).attr("y1", 0).attr("y2", 0).attr("stroke", selectedColor);
  transitionOf(rows.select(".metric-stem")).attr("x2", d => x(periodMetric(d)));
  rows.select(".metric-dot").attr("r", d => selected(d) ? 9 : 5.5).attr("fill", selectedColor);
  transitionOf(rows.select(".metric-dot")).attr("cx", d => x(periodMetric(d)));
  rows.select(".metric-slot").attr("y", .5).text(d => +d.manager_id === +state.a ? "A" : +d.manager_id === +state.b ? "B" : "");
  transitionOf(rows.select(".metric-slot")).attr("x", d => x(periodMetric(d)));
  rows.select(".metric-value").attr("y", 4).text(d => meta.format(periodMetric(d)));
  transitionOf(rows.select(".metric-value")).attr("x", d => x(periodMetric(d)) + (selected(d) ? 14 : 11));
  rows.select(".metric-exposure").attr("x", width - 2).attr("y", -9).text(d => mobile ? formatInt(d.minutes) : `${formatInt(d.minutes)} min`);

  const filterName = typeLabel().replace(/^./, c => c.toUpperCase());
  d3.select("#metric-description").text(state.metric === "xgshot"
    ? `${filterName} xG per selected shot. This is average modeled chance quality, not a scoring rate.`
    : `${filterName} ${state.metric === "shots90" ? "shots" : "xG"} per 90 regulation minutes. Stoppage-time shots remain in the numerator.`);
  const a = findPeriod(state.a), b = findPeriod(state.b), av = periodMetric(a), bv = periodMetric(b);
  const higher = av === bv ? null : av > bv ? { p: a, v: av, cls: "a", delta: av - bv } : { p: b, v: bv, cls: "b", delta: bv - av };
  const difference = state.metric === "xgshot" ? d3.format(".3f") : state.metric === "npxg90" ? fmt : fmt1;
  d3.select("#metric-insight").html(higher
    ? `<strong class="${higher.cls}">${shortName(higher.p)}</strong> is ${difference(higher.delta)} higher on ${meta.short}.`
    : `The selected periods are equal on ${meta.short}.`);
  d3.select("#metric-table").html(`<table><caption>${meta.label} by manager period</caption><thead><tr><th>Period</th><th>Value</th><th>Appearances</th><th>Minutes</th></tr></thead><tbody>${periods.map(d => `<tr><td>${shortName(d)}</td><td>${fmt(periodMetric(d))}</td><td>${d.matches}</td><td>${formatInt(d.minutes)}</td></tr>`).join("")}</tbody></table>`);
  metricsInitialized = true;
}

function render() {
  renderRail();
  renderPitch();
  renderMetrics();
  initialized = true;
}

async function initialize() {
  try {
    if (!window.d3) throw new Error("D3 failed to load. Check the network connection.");
    const [rawShots, record] = await Promise.all([
      d3.csv("data/shots.csv", d => ({ ...d, match_id: +d.match_id, manager_id: +d.manager_id, minute: +d.minute, x: +d.x, y: +d.y, xg: +d.xg })),
      d3.json("data/audit.json")
    ]);
    shots = rawShots;
    audit = record;
    periods = audit.periods.map(d => ({ ...d, manager_id: +d.manager_id }));
    if (!shots.length || periods.length < 2) throw new Error("The audited shot data is incomplete.");
    state.a = periods.find(d => shortName(d) === "Guardiola")?.manager_id || periods[0].manager_id;
    state.b = periods.find(d => shortName(d) === "Luis Enrique")?.manager_id || periods[1].manager_id;
    for (const selector of ["#manager-a", "#manager-b"]) d3.select(selector).selectAll("option").data(periods).join("option")
      .attr("value", d => d.manager_id).text(d => `${shortName(d)} · ${d.matches} appearances`);
    d3.select("#manager-a").on("change", e => {
      state.a = +e.target.value;
      if (state.a === state.b) state.b = periods.find(p => +p.manager_id !== state.a).manager_id;
      state.pinned = null;
      render();
    });
    d3.select("#manager-b").on("change", e => {
      state.b = +e.target.value;
      if (state.a === state.b) state.a = periods.find(p => +p.manager_id !== state.b).manager_id;
      state.pinned = null;
      render();
    });
    d3.select("#shot-type").on("change", e => { state.type = e.target.value; state.pinned = null; render(); });
    d3.select("#metric").on("change", e => { state.metric = e.target.value; renderMetrics(); });
    d3.selectAll("[data-mode]").on("click", e => {
      state.mode = e.currentTarget.dataset.mode;
      state.pinned = null;
      d3.selectAll("[data-mode]").attr("aria-pressed", function() { return this.dataset.mode === state.mode; });
      renderPitch();
    });
    document.addEventListener("keydown", event => { if (event.key === "Escape") { state.pinned = null; resetDetail(); } });
    const all = shots.filter(d => d.shot_type !== "Penalty");
    const leaders = periods.map(d => ({ name: shortName(d), rate: periodMetric(d, "shots90") })).sort((a, b) => b.rate - a.rate);
    d3.select("#finding-text").text(`${formatInt(all.length)} audited non-penalty shots reveal a change in both frequency and location. ${leaders[0].name} has the highest observed shot rate (${fmt1(leaders[0].rate)} per 90), while the linked half-pitches show where each period differs.`);
    d3.select("#scope-appearances").text(formatInt(audit.messi_appearances));
    d3.select("#scope-shots").text(formatInt(audit.non_penalty_shots));
    d3.select("#provenance").text(`Audited source: ${audit.barcelona_match_records} Barcelona match files, ${audit.messi_appearances} Messi lineup appearances and ${formatInt(audit.shot_events)} shot events; ${audit.manager_source_counts?.["sole-known-manager-in-season"] || 0} manager records inferred only in otherwise single-manager seasons. Snapshot ${audit.commit.slice(0, 12)}; all rules and IDs remain available in the audit file.`);
    render();
    let resizeTimer;
    new ResizeObserver(() => { clearTimeout(resizeTimer); resizeTimer = setTimeout(renderMetrics, 100); }).observe(document.querySelector("#metric-chart"));
  } catch (error) {
    console.error(error);
    d3.select("#finding-text").text(`Unable to load the visualization: ${error.message}`);
    d3.select("#comparison-note").text("Serve the project through a local or GitHub Pages web server so the external data files can load.");
  }
}

initialize();
