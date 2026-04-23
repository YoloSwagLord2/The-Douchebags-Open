import type { RuleField, RuleNode, RuleOperator } from "../lib/types";

const FIELDS: RuleField[] = [
  "strokes",
  "par",
  "stroke_index",
  "hole_number",
  "distance",
  "gross_to_par",
  "net_to_par",
  "round_holes_played",
  "round_total_strokes",
  "round_net_strokes",
  "round_stableford",
  "tournament_holes_played",
  "tournament_total_strokes",
  "tournament_net_strokes",
  "tournament_stableford",
];

const OPERATORS: RuleOperator[] = ["eq", "ne", "gt", "gte", "lt", "lte", "in"];

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
            {operator}
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
                ? event.target.value.split(",").map((item) => item.trim())
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

