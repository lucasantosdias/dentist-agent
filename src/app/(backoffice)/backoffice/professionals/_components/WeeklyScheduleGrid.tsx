"use client";

import { Button, Empty, Spin, Tooltip } from "antd";
import { CloseOutlined } from "@ant-design/icons";

type AvailabilityRule = {
  id: string;
  professional_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number | null;
  location_id: string | null;
};

type WeeklyScheduleGridProps = {
  rules: AvailabilityRule[];
  onDeleteRule: (ruleId: string) => void;
  loading?: boolean;
};

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const GRID_START = 6;
const GRID_END = 22;
const TOTAL_HOURS = GRID_END - GRID_START;
const HOUR_MARKERS = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => GRID_START + i);

function timeToFraction(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h + m / 60 - GRID_START) / TOTAL_HOURS;
}

export function WeeklyScheduleGrid({
  rules,
  onDeleteRule,
  loading,
}: WeeklyScheduleGridProps) {
  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <Spin />
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <Empty
        description="Nenhuma regra de disponibilidade cadastrada"
        style={{ padding: "32px 0" }}
      />
    );
  }

  const rulesByDay = new Map<number, AvailabilityRule[]>();
  for (const rule of rules) {
    const existing = rulesByDay.get(rule.weekday) ?? [];
    existing.push(rule);
    rulesByDay.set(rule.weekday, existing);
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ minWidth: 480 }}>
        {/* Time header */}
        <div
          style={{
            display: "flex",
            marginLeft: 48,
            marginBottom: 4,
            position: "relative",
            height: 20,
          }}
        >
          {HOUR_MARKERS.map((hour) => (
            <div
              key={hour}
              style={{
                position: "absolute",
                left: `${((hour - GRID_START) / TOTAL_HOURS) * 100}%`,
                transform: "translateX(-50%)",
                fontSize: 10,
                color: "#94a3b8",
                userSelect: "none",
              }}
            >
              {String(hour).padStart(2, "0")}
            </div>
          ))}
        </div>

        {/* Day rows */}
        {DAY_ORDER.map((day) => {
          const dayRules = rulesByDay.get(day) ?? [];
          return (
            <div
              key={day}
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: 6,
                height: 36,
              }}
            >
              <div
                style={{
                  width: 48,
                  flexShrink: 0,
                  fontSize: 12,
                  fontWeight: 500,
                  color: dayRules.length > 0 ? "#1e293b" : "#cbd5e1",
                }}
              >
                {WEEKDAY_LABELS[day]}
              </div>

              <div
                style={{
                  flex: 1,
                  position: "relative",
                  height: 32,
                  background: "#f8fafc",
                  borderRadius: 6,
                  border: "1px solid #e2e8f0",
                }}
              >
                {HOUR_MARKERS.map((hour) => (
                  <div
                    key={hour}
                    style={{
                      position: "absolute",
                      left: `${((hour - GRID_START) / TOTAL_HOURS) * 100}%`,
                      top: 0,
                      bottom: 0,
                      width: 1,
                      background: "#f1f5f9",
                    }}
                  />
                ))}

                {dayRules.map((rule) => {
                  const left = timeToFraction(rule.start_time) * 100;
                  const right = timeToFraction(rule.end_time) * 100;
                  const width = right - left;
                  return (
                    <Tooltip
                      key={rule.id}
                      title={`${rule.start_time} — ${rule.end_time}`}
                    >
                      <div
                        style={{
                          position: "absolute",
                          left: `${left}%`,
                          width: `${width}%`,
                          top: 3,
                          bottom: 3,
                          background: "linear-gradient(135deg, #2563eb, #3b82f6)",
                          borderRadius: 4,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "0 6px",
                          cursor: "default",
                          minWidth: 40,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 10,
                            color: "#fff",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {rule.start_time}–{rule.end_time}
                        </span>
                        <Button
                          type="text"
                          size="small"
                          icon={<CloseOutlined style={{ fontSize: 10, color: "#fff" }} />}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteRule(rule.id);
                          }}
                          style={{
                            minWidth: 16,
                            width: 16,
                            height: 16,
                            padding: 0,
                            flexShrink: 0,
                          }}
                        />
                      </div>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
