import type { RuleField, RuleNode, RuleOperator } from "../lib/types";

const FIELDS: RuleField[] = [
  "strokes",
  "par",
  "stroke_index",
  "hole_number",
  "distance",
  "gross_to_par",
  "net_to_par",
  "stableford_points",
  "player_hcp",
  "previous_hole_strokes",
  "previous_hole_gross_to_par",
  "previous_hole_net_to_par",
  "previous_hole_stableford",
  "round_holes_played",
  "round_total_strokes",
  "round_net_strokes",
  "round_net_par_streak",
  "round_stableford",
  "round_stableford_delta_prev",
  "round_zero_stableford_holes",
  "round_one_stableford_holes",
  "round_four_plus_stableford_holes",
  "round_bogey_holes",
  "round_par3_stableford",
  "round_long_hole_stableford",
  "front_nine_stableford",
  "back_nine_stableford",
  "previous_round_stableford",
  "previous_round_total_strokes",
  "previous_round_net_strokes",
  "round_number",
  "total_rounds",
  "is_final_round",
  "tournament_position_before_round",
  "is_bottom_half_before_round",
  "is_outside_top3_before_round",
  "tournament_holes_played",
  "tournament_total_strokes",
  "tournament_net_strokes",
  "tournament_stableford",
];

const OPERATORS: RuleOperator[] = ["eq", "ne", "gt", "gte", "lt", "lte", "in"];

const OPERATOR_LABELS: Record<RuleOperator, string> = {
  eq: "equal to",
  ne: "not equal to",
  gt: "greater than",
  gte: "greater than or equal to",
  lt: "less than",
  lte: "less than or equal to",
  in: "in list",
};

function parseRuleValue(value: string) {
  const numeric = Number(value);
  return Number.isNaN(numeric) || value.trim() === "" ? value.trim() : numeric;
}

interface Props {
  value: RuleNode;
  onChange: (value: RuleNode) => void;
}

function isGroup(node: RuleNode): node is Extract<RuleNode, { op: "and" | "or" }> {
  return "op" in node;
}

function PredicateEditor({ node, onChange }: { node: Extract<RuleNode, { field: RuleField }>; onChange: (value: RuleNode) => void }) {
  return (
    <div className="rule-predicate">
      <select value={node.field} onChange={(event) => onChange({ ...node, field: event.target.value as RuleField })}>
        {FIELDS.map((field) => (
          <option key={field} value={field}>
            {field}
          </option>
        ))}
      </select>
      <select
        value={node.operator}
        onChange={(event) => onChange({ ...node, operator: event.target.value as RuleOperator })}
      >
        {OPERATORS.map((operator) => (
          <option key={operator} value={operator}>
            {OPERATOR_LABELS[operator]}
          </option>
        ))}
      </select>
      <input
        value={Array.isArray(node.value) ? node.value.join(",") : String(node.value)}
        onChange={(event) =>
          onChange({
            ...node,
            value:
              node.operator === "in"
                ? event.target.value.split(",").map(parseRuleValue)
                : Number.isNaN(Number(event.target.value))
                  ? event.target.value
                  : Number(event.target.value),
          })
        }
      />
    </div>
  );
}

export function RuleBuilder({ value, onChange }: Props) {
  if (!isGroup(value)) {
    return <PredicateEditor node={value} onChange={onChange} />;
  }

  return (
    <div className="rule-group">
      <div className="rule-group__header">
        <label>
          Match
          <select value={value.op} onChange={(event) => onChange({ ...value, op: event.target.value as "and" | "or" })}>
            <option value="and">all conditions</option>
            <option value="or">any condition</option>
          </select>
        </label>
        <div className="rule-group__actions">
          <button
            type="button"
            onClick={() =>
              onChange({
                ...value,
                conditions: [
                  ...value.conditions,
                  { field: "strokes", operator: "gte", value: 4 },
                ],
              })
            }
          >
            Add rule
          </button>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...value,
                conditions: [
                  ...value.conditions,
                  { op: "and", conditions: [{ field: "strokes", operator: "gte", value: 10 }] },
                ],
              })
            }
          >
            Add group
          </button>
        </div>
      </div>
      <div className="rule-group__body">
        {value.conditions.map((condition, index) => (
          <div className="rule-group__item" key={index}>
            <RuleBuilder
              value={condition}
              onChange={(next) =>
                onChange({
                  ...value,
                  conditions: value.conditions.map((item, itemIndex) =>
                    itemIndex === index ? next : item,
                  ),
                })
              }
            />
            <button
              type="button"
              className="button-ghost"
              onClick={() =>
                onChange({
                  ...value,
                  conditions: value.conditions.filter((_, itemIndex) => itemIndex !== index),
                })
              }
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
