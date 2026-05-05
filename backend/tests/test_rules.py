from app.services.rules import evaluate_rule, validate_rule_definition


def test_rule_validation_accepts_nested_groups() -> None:
    definition = {
        "op": "and",
        "conditions": [
            {"field": "strokes", "operator": "gte", "value": 10},
            {
                "op": "or",
                "conditions": [
                    {"field": "hole_number", "operator": "eq", "value": 1},
                    {"field": "hole_number", "operator": "eq", "value": 18},
                ],
            },
        ],
    }

    validate_rule_definition(definition)


def test_rule_validation_accepts_net_par_streak_field() -> None:
    validate_rule_definition({"field": "round_net_par_streak", "operator": "gte", "value": 3})


def test_rule_engine_evaluates_predicates_and_groups() -> None:
    definition = {
        "op": "and",
        "conditions": [
            {"field": "strokes", "operator": "gte", "value": 10},
            {"field": "round_stableford", "operator": "lt", "value": 8},
        ],
    }
    context = {"strokes": 11, "round_stableford": 5}
    assert evaluate_rule(definition, context) is True
    assert evaluate_rule(definition, {"strokes": 8, "round_stableford": 5}) is False
