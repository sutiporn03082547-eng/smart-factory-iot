"""
สร้าง Grafana dashboards (Flux / InfluxDB 2.x) -> grafana/dashboards/*.json
  python tools/build_dashboards.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "grafana" / "dashboards"
DS = {"type": "influxdb", "uid": "influxdb-factory"}
B = 'from(bucket: "machines")'

STATE_MAP = [{
    "type": "value",
    "options": {
        "0": {"text": "STOPPED", "color": "#8e8e8e", "index": 0},
        "1": {"text": "RUNNING", "color": "green", "index": 1},
        "2": {"text": "ALARM", "color": "red", "index": 2},
        "3": {"text": "MAINTENANCE", "color": "orange", "index": 3},
    },
}]
STATE_TEXT_MAP = [{
    "type": "value",
    "options": {
        "STOPPED": {"color": "#8e8e8e", "index": 0},
        "RUNNING": {"color": "green", "index": 1},
        "ALARM": {"color": "red", "index": 2},
        "MAINTENANCE": {"color": "orange", "index": 3},
    },
}]
OEE_STEPS = {"mode": "absolute", "steps": [
    {"color": "red", "value": None}, {"color": "orange", "value": 0.6}, {"color": "green", "value": 0.85}]}

_pid = [0]


def panel(ptype, title, x, y, w, h, query, defaults=None, options=None, overrides=None, desc=""):
    _pid[0] += 1
    return {
        "id": _pid[0], "type": ptype, "title": title, "description": desc,
        "gridPos": {"h": h, "w": w, "x": x, "y": y},
        "datasource": DS,
        "targets": [{"refId": "A", "datasource": DS, "query": query}],
        "fieldConfig": {"defaults": defaults or {}, "overrides": overrides or []},
        "options": options or {},
    }


def last_by_machine(field, flt=""):
    return (f'{B}\n  |> range(start: -1h)\n'
            f'  |> filter(fn: (r) => r._measurement == "machine" and r._field == "{field}"{flt})\n'
            f'  |> last()\n  |> keep(columns: ["_time", "_value", "machine"])')


def series(field, flt="", fn="mean"):
    return (f'{B}\n  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)\n'
            f'  |> filter(fn: (r) => r._measurement == "machine" and r._field == "{field}"{flt})\n'
            f'  |> aggregateWindow(every: v.windowPeriod, fn: {fn}, createEmpty: false)\n'
            f'  |> keep(columns: ["_time", "_value", "machine"])')


def factory_agg(field, agg):
    return (f'{B}\n  |> range(start: -1h)\n'
            f'  |> filter(fn: (r) => r._measurement == "machine" and r._field == "{field}")\n'
            f'  |> last()\n  |> group()\n  |> {agg}()')


ALARMS_NOW = (f'{B}\n  |> range(start: -1h)\n'
              '  |> filter(fn: (r) => r._measurement == "machine" and r._field == "state_code")\n'
              '  |> last()\n  |> filter(fn: (r) => r._value == 2)\n  |> group()\n  |> count()')

EVENTS = (f'{B}\n  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)\n'
          '  |> filter(fn: (r) => r._measurement == "event" and r._field == "message")\n'
          '  |> group()\n  |> keep(columns: ["_time", "machine", "level", "type", "_value"])\n'
          '  |> rename(columns: {_value: "message"})\n  |> sort(columns: ["_time"], desc: true)\n  |> limit(n: 100)')

EVENTS_COUNT = (f'{B}\n  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)\n'
                '  |> filter(fn: (r) => r._measurement == "event" and r._field == "value" and (r.level == "critical" or r.level == "warning"))\n'
                '  |> group()\n  |> count()')

LABEL = "${__field.labels.machine}"
LEVEL_COLORS = [{"matcher": {"id": "byName", "options": "level"}, "properties": [
    {"id": "custom.cellOptions", "value": {"type": "color-background"}},
    {"id": "mappings", "value": [{"type": "value", "options": {
        "critical": {"color": "red", "index": 0}, "warning": {"color": "orange", "index": 1},
        "info": {"color": "green", "index": 2}}}]},
    {"id": "custom.width", "value": 90}]},
    {"matcher": {"id": "byName", "options": "_time"}, "properties": [{"id": "custom.width", "value": 170}, {"id": "displayName", "value": "เวลา"}]},
    {"matcher": {"id": "byName", "options": "machine"}, "properties": [{"id": "custom.width", "value": 80}]},
    {"matcher": {"id": "byName", "options": "type"}, "properties": [{"id": "custom.width", "value": 120}]}]


def ts_defaults(unit, steps=None, threshold_lines=False, **custom):
    d = {"unit": unit, "displayName": LABEL,
         "custom": {"lineWidth": 2, "fillOpacity": 8, "showPoints": "never", "spanNulls": True, **custom}}
    if steps:
        d["thresholds"] = {"mode": "absolute", "steps": steps}
        if threshold_lines:
            d["custom"]["thresholdsStyle"] = {"mode": "line+area"}
    return d


def dashboard(uid, title, panels, variables=None, refresh="5s", time_from="now-30m", tags=None):
    return {
        "uid": uid, "title": title, "tags": tags or ["smart-factory"], "timezone": "browser",
        "schemaVersion": 39, "version": 1, "editable": True, "graphTooltip": 1,
        "refresh": refresh, "time": {"from": time_from, "to": "now"},
        "templating": {"list": variables or []}, "annotations": {"list": []}, "panels": panels,
    }


# ============================ ENGINEER ============================
_pid[0] = 0
MF = ' and r.machine =~ /^${machine:regex}$/'
eng = [
    panel("stat", "สถานะเครื่องจักร", 0, 0, 16, 5, last_by_machine("state_code", MF),
          {"mappings": STATE_MAP, "displayName": LABEL, "color": {"mode": "thresholds"},
           "thresholds": {"mode": "absolute", "steps": [{"color": "green", "value": None}]}},
          {"colorMode": "background", "graphMode": "none", "textMode": "value_and_name", "justifyMode": "center",
           "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False}, "orientation": "auto"}),
    panel("gauge", "OEE โรงงาน", 16, 0, 4, 5, factory_agg("oee", "mean"),
          {"unit": "percentunit", "min": 0, "max": 1, "decimals": 1, "thresholds": OEE_STEPS},
          {"reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False}, "showThresholdMarkers": True}),
    panel("stat", "เครื่องที่ Trip ตอนนี้", 20, 0, 4, 5, ALARMS_NOW,
          {"noValue": "0", "thresholds": {"mode": "absolute", "steps": [{"color": "green", "value": None}, {"color": "red", "value": 1}]}, "unit": "none"},
          {"colorMode": "background", "graphMode": "none", "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False}}),
    panel("timeseries", "อุณหภูมิ (°C)", 0, 5, 12, 9, series("temp", MF),
          ts_defaults("celsius", [{"color": "green", "value": None}, {"color": "orange", "value": 85}, {"color": "red", "value": 95}], True),
          {"legend": {"displayMode": "table", "placement": "right", "calcs": ["lastNotNull", "max"]}, "tooltip": {"mode": "multi"}},
          desc="เส้นเตือน 85°C / Trip 95°C"),
    panel("timeseries", "ความสั่นสะเทือน (mm/s RMS, ISO 10816)", 12, 5, 12, 9, series("vibration", MF),
          ts_defaults("none", [{"color": "green", "value": None}, {"color": "yellow", "value": 4.5}, {"color": "orange", "value": 7.1}, {"color": "red", "value": 11}], True),
          {"legend": {"displayMode": "table", "placement": "right", "calcs": ["lastNotNull", "max"]}, "tooltip": {"mode": "multi"}},
          desc="โซน ISO 10816: A/B < 4.5, C 4.5–7.1, D > 11 (Trip)"),
    panel("bargauge", "OEE รายเครื่อง", 0, 14, 8, 8, last_by_machine("oee", MF),
          {"unit": "percentunit", "min": 0, "max": 1, "decimals": 1, "displayName": LABEL, "thresholds": OEE_STEPS},
          {"displayMode": "gradient", "orientation": "horizontal", "showUnfilled": True,
           "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False}}),
    panel("timeseries", "ยอดผลิตสะสมในกะ (ชิ้น)", 8, 14, 8, 8, series("count_total", MF, fn="last"),
          ts_defaults("none"), {"legend": {"displayMode": "list", "placement": "bottom"}, "tooltip": {"mode": "multi"}}),
    panel("timeseries", "RPM", 16, 14, 8, 8, series("rpm", MF),
          ts_defaults("rotrpm"), {"legend": {"displayMode": "list", "placement": "bottom"}, "tooltip": {"mode": "multi"}}),
    panel("table", "Alarm / Event Log", 0, 22, 24, 9, EVENTS,
          {"custom": {"align": "auto", "cellOptions": {"type": "auto"}}}, {"showHeader": True, "footer": {"show": False}},
          LEVEL_COLORS),
]
machine_var = {
    "name": "machine", "label": "เครื่องจักร", "type": "query", "datasource": DS,
    "query": 'import "influxdata/influxdb/schema"\nschema.tagValues(bucket: "machines", tag: "machine")',
    "definition": 'import "influxdata/influxdb/schema"\nschema.tagValues(bucket: "machines", tag: "machine")',
    "multi": True, "includeAll": True, "allValue": ".*", "refresh": 2, "sort": 1,
    "current": {"selected": True, "text": ["All"], "value": ["$__all"]},
}

# ============================ EXECUTIVE ============================
_pid[0] = 0
exe = [
    panel("gauge", "OEE โรงงาน", 0, 0, 6, 7, factory_agg("oee", "mean"),
          {"unit": "percentunit", "min": 0, "max": 1, "decimals": 1, "thresholds": OEE_STEPS},
          {"reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False}, "showThresholdMarkers": True},
          desc="OEE = Availability × Performance × Quality (World class ≥ 85%)"),
    panel("stat", "Availability", 6, 0, 4, 7, factory_agg("availability", "mean"),
          {"unit": "percentunit", "decimals": 1, "thresholds": OEE_STEPS}, {"colorMode": "value", "graphMode": "none", "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False}}),
    panel("stat", "Performance", 10, 0, 4, 7, factory_agg("performance", "mean"),
          {"unit": "percentunit", "decimals": 1, "thresholds": OEE_STEPS}, {"colorMode": "value", "graphMode": "none", "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False}}),
    panel("stat", "Quality", 14, 0, 4, 7, factory_agg("quality", "mean"),
          {"unit": "percentunit", "decimals": 1, "thresholds": OEE_STEPS}, {"colorMode": "value", "graphMode": "none", "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False}}),
    panel("stat", "ยอดผลิตรวมในกะ", 18, 0, 3, 7, factory_agg("count_total", "sum"),
          {"unit": "none", "thresholds": {"mode": "absolute", "steps": [{"color": "blue", "value": None}]}},
          {"colorMode": "value", "graphMode": "none", "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False}}),
    panel("stat", "จำนวน Alarm", 21, 0, 3, 7, EVENTS_COUNT,
          {"unit": "none", "noValue": "0", "thresholds": {"mode": "absolute", "steps": [{"color": "green", "value": None}, {"color": "orange", "value": 1}, {"color": "red", "value": 5}]}},
          {"colorMode": "background", "graphMode": "none", "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False}}),
    panel("state-timeline", "ไทม์ไลน์สถานะเครื่องจักร", 0, 7, 24, 8, series("state", fn="last"),
          {"mappings": STATE_TEXT_MAP, "displayName": LABEL, "color": {"mode": "thresholds"},
           "thresholds": {"mode": "absolute", "steps": [{"color": "green", "value": None}]},
           "custom": {"fillOpacity": 85, "lineWidth": 0}},
          {"showValue": "never", "mergeValues": True, "rowHeight": 0.85, "legend": {"showLegend": True, "displayMode": "list", "placement": "bottom"}}),
    panel("bargauge", "OEE รายเครื่อง", 0, 15, 10, 9, last_by_machine("oee"),
          {"unit": "percentunit", "min": 0, "max": 1, "decimals": 1, "displayName": LABEL, "thresholds": OEE_STEPS},
          {"displayMode": "lcd", "orientation": "horizontal", "showUnfilled": True,
           "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False}}),
    panel("table", "เหตุการณ์ล่าสุด", 10, 15, 14, 9, EVENTS,
          {"custom": {"align": "auto", "cellOptions": {"type": "auto"}}}, {"showHeader": True}, LEVEL_COLORS),
]

OUT.mkdir(parents=True, exist_ok=True)
for name, d in [("factory-engineer.json", dashboard("sf-engineer", "Smart Factory – Engineer", eng, [machine_var])),
                ("factory-executive.json", dashboard("sf-executive", "Smart Factory – Executive", exe, refresh="10s", time_from="now-3h"))]:
    (OUT / name).write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")
    print("wrote", name, len(d["panels"]), "panels")
