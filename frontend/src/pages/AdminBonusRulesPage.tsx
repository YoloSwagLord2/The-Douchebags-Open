import { useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { RuleBuilder } from "../components/RuleBuilder";
import type { BonusAnimationPreset, BonusRuleResponse, NavigationTournament, RuleNode } from "../lib/types";
import { t } from "../lib/i18n";

const initialRule: RuleNode = { op: "and", conditions: [{ field: "strokes", operator: "gte", value: 10 }] };

function displayRoundName(round: { round_number: number; name?: string | null }) {
  return round.name?.trim() || `Round ${round.round_number}`;
}

function cloneRule(node: RuleNode): RuleNode {
  return JSON.parse(JSON.stringify(node)) as RuleNode;
}

export function AdminBonusRulesPage() {
  const { token } = useAuth();
  const [rules, setRules] = useState<BonusRuleResponse[]>([]);
  const [navigation, setNavigation] = useState<NavigationTournament[]>([]);
  const [scopeType, setScopeType] = useState<"round" | "tournament">("round");
  const [scopeId, setScopeId] = useState("");
  const [name, setName] = useState("");
  const [points, setPoints] = useState(1);
  const [message, setMessage] = useState("");
  const [preset, setPreset] = useState<BonusAnimationPreset>("confetti");
  const [lottieUrl, setLottieUrl] = useState("");
  const [definition, setDefinition] = useState<RuleNode>(() => cloneRule(initialRule));
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  const load = async () => {
    if (!token) return;
    const [ruleData, nav] = await Promise.all([api.adminBonusRules(token), api.navigation(token)]);
    setRules(ruleData);
    setNavigation(nav);
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, [token]);

  const resetForm = () => {
    setEditingRuleId(null);
    setScopeType("round");
    setScopeId("");
    setName("");
    setPoints(1);
    setMessage("");
    setPreset("confetti");
    setLottieUrl("");
    setDefinition(cloneRule(initialRule));
  };

  const editRule = (rule: BonusRuleResponse) => {
    setEditingRuleId(rule.id);
    setScopeType(rule.scope_type);
    setScopeId(rule.scope_type === "round" ? rule.round_id ?? "" : rule.tournament_id ?? "");
    setName(rule.name);
    setPoints(rule.points);
    setMessage(rule.winner_message);
    setPreset(rule.animation_preset);
    setLottieUrl(rule.animation_lottie_url ?? "");
    setDefinition(cloneRule(rule.definition_jsonb));
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
      animation_preset: preset,
      animation_lottie_url: lottieUrl || null,
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

  const resetAwards = async (rule: BonusRuleResponse) => {
    if (!token) return;
    const confirmed = window.confirm(`Reset active awards for "${rule.name}"?`);
    if (!confirmed) return;
    await api.resetBonusRuleAwards(rule.id, token);
    await load();
  };

  return (
    <div className="admin-grid">
      <section className="detail-panel">
        <p className="eyebrow">{t('bonusRules.eyebrow')}</p>
        <h2>{editingRuleId ? "Edit bonus rule" : t('bonusRules.createTitle')}</h2>
        <form className="stack-form" onSubmit={submit}>
          <input required placeholder="Rule name" value={name} onChange={(event) => setName(event.target.value)} />
          <select value={scopeType} onChange={(event) => setScopeType(event.target.value as "round" | "tournament")}>
            <option value="round">{t('bonusRules.scopeRound')}</option>
            <option value="tournament">{t('bonusRules.scopeTournament')}</option>
          </select>
          <select required value={scopeId} onChange={(event) => setScopeId(event.target.value)}>
            <option value="">{t('bonusRules.selectScope')}</option>
            {scopeType === "tournament"
              ? navigation.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))
              : navigation.flatMap((item) =>
                  item.rounds.map((round) => (
                    <option key={round.id} value={round.id}>
                      {item.name} • {displayRoundName(round)}
                    </option>
                  )),
                )}
          </select>
          <input min={1} required type="number" value={points} onChange={(event) => setPoints(Number(event.target.value))} />
          <textarea required placeholder="Winner message" value={message} onChange={(event) => setMessage(event.target.value)} />
          <select value={preset} onChange={(event) => setPreset(event.target.value as BonusAnimationPreset)}>
            <option value="confetti">{t('bonusRules.animConfetti')}</option>
            <option value="fireworks">{t('bonusRules.animFireworks')}</option>
            <option value="spotlight">{t('bonusRules.animSpotlight')}</option>
            <option value="chaos">{t('bonusRules.animChaos')}</option>
          </select>
          <input placeholder="Optional Lottie URL" value={lottieUrl} onChange={(event) => setLottieUrl(event.target.value)} />
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
            <article className="detail-panel detail-panel--nested" key={rule.id}>
              <strong>{rule.name}</strong>
              <p>+{rule.points} points · {rule.scope_type}</p>
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
