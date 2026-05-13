import { useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { RuleBuilder } from "../components/RuleBuilder";
import type {
  BonusAnimationPreset,
  BonusAwardTiming,
  BonusRepeatLimit,
  BonusRuleOverviewResponse,
  BonusRuleResponse,
  BonusWinnerSelection,
  RoundResponse,
  RuleNode,
  TournamentResponse,
} from "../lib/types";
import { t } from "../lib/i18n";

const initialRule: RuleNode = { op: "and", conditions: [{ field: "strokes", operator: "gte", value: 10 }] };
const bonusAnimationPreset: BonusAnimationPreset = "confetti";
const repeatLimitLabels: Record<BonusRepeatLimit, string> = {
  every_qualifying_event: "Every time it qualifies",
  one_batch_until_reset: "One winner batch until reset",
  once_per_player_until_reset: "Once per player until reset",
  once_per_player_per_round: "Once per player per round",
};
const winnerSelectionLabels: Record<BonusWinnerSelection, string> = {
  all_matching: "All matching players",
  top_x: "Top X",
  bottom_x: "Bottom X",
  top_half: "Top half",
  bottom_half: "Bottom half",
};

function displayRoundName(round: { round_number: number; name?: string | null }) {
  return round.name?.trim() || `Round ${round.round_number}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not won yet";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function cloneRule(node: RuleNode): RuleNode {
  return JSON.parse(JSON.stringify(node)) as RuleNode;
}

export function AdminBonusRulesPage() {
  const { token } = useAuth();
  const [rules, setRules] = useState<BonusRuleOverviewResponse[]>([]);
  const [tournaments, setTournaments] = useState<TournamentResponse[]>([]);
  const [rounds, setRounds] = useState<RoundResponse[]>([]);
  const [scopeType, setScopeType] = useState<"round" | "tournament">("round");
  const [scopeId, setScopeId] = useState("");
  const [name, setName] = useState("");
  const [points, setPoints] = useState(1);
  const [message, setMessage] = useState("");
  const [definition, setDefinition] = useState<RuleNode>(() => cloneRule(initialRule));
  const [awardTiming, setAwardTiming] = useState<BonusAwardTiming>("live");
  const [repeatLimit, setRepeatLimit] = useState<BonusRepeatLimit>("every_qualifying_event");
  const [winnerSelection, setWinnerSelection] = useState<BonusWinnerSelection>("all_matching");
  const [winnerSelectionCount, setWinnerSelectionCount] = useState(1);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    if (!token) return;
    setLoadError(null);
    const [ruleData, tournamentData, roundData] = await Promise.all([
      api.adminBonusRules(token),
      api.adminTournaments(token),
      api.adminRounds(token),
    ]);
    setRules(ruleData);
    setTournaments(tournamentData);
    setRounds(roundData);
  };

  useEffect(() => {
    load().catch((err) => {
      setLoadError(err instanceof Error ? err.message : "Failed to load bonus rule scopes");
    });
  }, [token]);

  const resetForm = () => {
    setEditingRuleId(null);
    setScopeType("round");
    setScopeId("");
    setName("");
    setPoints(1);
    setMessage("");
    setDefinition(cloneRule(initialRule));
    setAwardTiming("live");
    setRepeatLimit("every_qualifying_event");
    setWinnerSelection("all_matching");
    setWinnerSelectionCount(1);
  };

  const editRule = (rule: BonusRuleResponse) => {
    setEditingRuleId(rule.id);
    setScopeType(rule.scope_type);
    setScopeId(rule.scope_type === "round" ? rule.round_id ?? "" : rule.tournament_id ?? "");
    setName(rule.name);
    setPoints(rule.points);
    setMessage(rule.winner_message);
    setDefinition(cloneRule(rule.definition_jsonb));
    setAwardTiming(rule.award_timing);
    setRepeatLimit(rule.repeat_limit);
    setWinnerSelection(rule.winner_selection);
    setWinnerSelectionCount(rule.winner_selection_count ?? 1);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !scopeId) return;
    const payload = {
      name,
      scope_type: scopeType,
      round_id: scopeType === "round" ? scopeId : null,
      tournament_id: scopeType === "tournament" ? scopeId : null,
      points,
      winner_message: message,
      definition,
      animation_preset: bonusAnimationPreset,
      animation_lottie_url: null,
      award_timing: awardTiming,
      repeat_limit: repeatLimit,
      winner_selection: awardTiming === "round_close" ? winnerSelection : "all_matching",
      winner_selection_count:
        awardTiming === "round_close" && (winnerSelection === "top_x" || winnerSelection === "bottom_x")
          ? winnerSelectionCount
          : null,
      enabled: true,
    };
    if (editingRuleId) {
      await api.updateBonusRule(editingRuleId, payload, token);
    } else {
      await api.createBonusRule(payload, token);
    }
    resetForm();
    await load();
  };

  const resetAwards = async (rule: BonusRuleOverviewResponse) => {
    if (!token) return;
    const confirmed = window.confirm(`Reset active awards for "${rule.name}"?`);
    if (!confirmed) return;
    await api.resetBonusRuleAwards(rule.id, token);
    await load();
  };

  const toggleRule = async (rule: BonusRuleOverviewResponse) => {
    if (!token) return;
    await api.updateBonusRule(rule.id, { enabled: !rule.enabled }, token);
    await load();
  };

  const tournamentNameById = new Map(tournaments.map((item) => [item.id, item.name]));
  const roundNameById = new Map(
    rounds.map((round) => [
      round.id,
      `${tournamentNameById.get(round.tournament_id) ?? "Tournament"} • ${displayRoundName(round)}`,
    ]),
  );
  const scopeOptions =
    scopeType === "tournament"
      ? tournaments.map((item) => ({ id: item.id, label: item.name }))
      : rounds.map((round) => ({
          id: round.id,
          label: `${tournamentNameById.get(round.tournament_id) ?? "Tournament"} • ${displayRoundName(round)}`,
        }));
  const scopeLabel = (rule: BonusRuleResponse) =>
    rule.scope_type === "tournament"
      ? tournamentNameById.get(rule.tournament_id ?? "") ?? "Tournament"
      : roundNameById.get(rule.round_id ?? "") ?? "Round";
  const ruleModeLabel = (rule: BonusRuleResponse) => {
    const timing = rule.award_timing === "round_close" ? "Round close" : "Live";
    const repeat = repeatLimitLabels[rule.repeat_limit];
    const selection =
      rule.award_timing === "round_close"
        ? ` · ${winnerSelectionLabels[rule.winner_selection]}${rule.winner_selection_count ? ` ${rule.winner_selection_count}` : ""}`
        : "";
    return `${timing} · ${repeat}${selection}`;
  };

  return (
    <div className="admin-grid">
      <section className="detail-panel">
        <p className="eyebrow">{t('bonusRules.eyebrow')}</p>
        <h2>{editingRuleId ? "Edit bonus rule" : t('bonusRules.createTitle')}</h2>
        {loadError ? <p className="form-error">{loadError}</p> : null}
        <form className="stack-form" onSubmit={submit}>
          <input required placeholder="Rule name" value={name} onChange={(event) => setName(event.target.value)} />
          <select
            value={scopeType}
            onChange={(event) => {
              setScopeType(event.target.value as "round" | "tournament");
              setScopeId("");
            }}
          >
            <option value="round">{t('bonusRules.scopeRound')}</option>
            <option value="tournament">{t('bonusRules.scopeTournament')}</option>
          </select>
          <select required value={scopeId} onChange={(event) => setScopeId(event.target.value)}>
            <option value="">{t('bonusRules.selectScope')}</option>
            {scopeOptions.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
          {!loadError && !scopeOptions.length ? (
            <p className="muted-copy">
              {scopeType === "round" ? "Create a round before adding a round-scoped bonus." : "Create a tournament before adding a tournament-scoped bonus."}
            </p>
          ) : null}
          <input min={1} required type="number" value={points} onChange={(event) => setPoints(Number(event.target.value))} />
          <textarea required placeholder="Winner message" value={message} onChange={(event) => setMessage(event.target.value)} />
          <select value={awardTiming} onChange={(event) => setAwardTiming(event.target.value as BonusAwardTiming)}>
            <option value="live">Live while scoring</option>
            <option value="round_close">When round closes</option>
          </select>
          <select value={repeatLimit} onChange={(event) => setRepeatLimit(event.target.value as BonusRepeatLimit)}>
            {Object.entries(repeatLimitLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          {awardTiming === "round_close" ? (
            <>
              <select
                value={winnerSelection}
                onChange={(event) => setWinnerSelection(event.target.value as BonusWinnerSelection)}
              >
                {Object.entries(winnerSelectionLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              {winnerSelection === "top_x" || winnerSelection === "bottom_x" ? (
                <input
                  min={1}
                  required
                  type="number"
                  value={winnerSelectionCount}
                  onChange={(event) => setWinnerSelectionCount(Number(event.target.value))}
                />
              ) : null}
            </>
          ) : null}
          <RuleBuilder value={definition} onChange={setDefinition} />
          <div className="form-actions">
            <button className="button-primary" type="submit">
              {editingRuleId ? "Save changes" : t('bonusRules.save')}
            </button>
            {editingRuleId ? (
              <button className="button-ghost" onClick={resetForm} type="button">
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>
      </section>
      <section className="detail-panel">
        <p className="eyebrow">Configured rules</p>
        <h2>Existing bonus rules</h2>
        <div className="list-stack">
          {rules.map((rule) => (
            <article className="detail-panel detail-panel--nested bonus-rule-card" key={rule.id}>
              <div className="bonus-rule-card__header">
                <div>
                  <strong>{rule.name}</strong>
                  <p className="muted-copy">
                    +{rule.points} points · {rule.scope_type} · {scopeLabel(rule)}
                  </p>
                  <p className="muted-copy">{ruleModeLabel(rule)}</p>
                </div>
                <label className="admin-toggle">
                  <input checked={rule.enabled} onChange={() => toggleRule(rule)} type="checkbox" />
                  <span>{rule.enabled ? "Active" : "Inactive"}</span>
                </label>
              </div>

              <div className="bonus-rule-card__stats">
                <span>
                  <small>Won</small>
                  <strong>{rule.active_awards_count ?? rule.active_awards?.length ?? 0}</strong>
                </span>
                <span>
                  <small>Latest</small>
                  <strong>{formatDateTime(rule.latest_awarded_at)}</strong>
                </span>
              </div>

              {rule.active_awards?.length ? (
                <div className="bonus-rule-card__awards">
                  {rule.active_awards.map((award) => (
                    <div className="bonus-rule-card__award" key={award.id}>
                      <span>
                        <strong>{award.player_name}</strong>
                        <small>{formatDateTime(award.awarded_at)}</small>
                      </span>
                      <b>+{award.points_snapshot}</b>
                    </div>
                  ))}
                  {(rule.active_awards_count ?? 0) > rule.active_awards.length ? (
                    <p className="muted-copy">+{rule.active_awards_count - rule.active_awards.length} more active awards</p>
                  ) : null}
                </div>
              ) : (
                <p className="muted-copy">No active winners yet.</p>
              )}

              <div className="form-actions">
                <button className="button-secondary" onClick={() => editRule(rule)} type="button">
                  Edit
                </button>
                <button className="button-ghost" onClick={() => resetAwards(rule)} type="button">
                  Reset awards
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
