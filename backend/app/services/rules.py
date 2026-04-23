from collections.abc import Mapping
from typing import Any


ALLOWED_FIELDS = {
    "distance",
    "gross_to_par",
    "hole_number",
    "net_to_par",
    "par",
    "round_holes_played",
    "round_net_strokes",
    "round_stableford",
    "round_total_strokes",
    "stroke_index",
    "strokes",
    "tournament_holes_played",
    "tournament_net_strokes",
    "tournament_stableford",
    "tournament_total_strokes",
}
ALLOWED_OPERATORS = {"eq", "ne", "gt", "gte", "lt", "lte", "in"}


def validate_rule_definition(definition: Mapping[str, Any]) -> None:
    if "op" in definition:
        op = definition["op"]
        if op not in {"and", "or"}:
            raise ValueError("Rule group op must be 'and' or 'or'")
        conditions = definition.get("conditions")
        if not isinstance(conditions, list) or not conditions:
            raise ValueError("Rule group must contain at least one condition")
        for condition in conditions:
            if not isinstance(condition, Mapping):
                raise ValueError("Each condition must be an object")
            validate_rule_definition(condition)
        return

    field = definition.get("field")
    operator = definition.get("operator")
    if field not in ALLOWED_FIELDS:
        raise ValueError(f"Unsupported rule field: {field}")
    if operator not in ALLOWED_OPERATORS:
        raise ValueError(f"Unsupported operator: {operator}")
    if "value" not in definition:
        raise ValueError("Rule predicate must include value")


def evaluate_rule(definition: Mapping[str, Any], context: Mapping[str, Any]) -> bool:
    if "op" in definition:
        evaluator = all if definition["op"] == "and" else any
        return evaluator(evaluate_rule(condition, context) for condition in definition["conditions"])

    field = definition["field"]
    operator = definition["operator"]
    expected = definition["value"]
    actual = context.get(field)

    if operator == "eq":
        return actual == expected
    if operator == "ne":
        return actual != expected
    if operator == "gt":
        return actual is not None and actual > expected
    if operator == "gte":
        return actual is not None and actual >= expected
    if operator == "lt":
        return actual is not None and actual < expected
    if operator == "lte":
        return actual is not None and actual <= expected
    if operator == "in":
        return actual in expected
    return False

