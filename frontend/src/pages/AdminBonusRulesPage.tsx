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
  const [definition, setDefinition] = useState<RuleNode>(initialRule);

  const load = async () => {
    if (!token) return;
    const [ruleData, nav] = await Promise.all([api.adminBonusRules(token), api.navigation(token)]);
    setRules(ruleData);
    setNavigation(nav);
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, [token]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    await api.createBonusRule(
      {
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
      },
      token,
    );
    await load();
  };

  return (
    <div className="admin-grid">
      <section className="detail-panel">
        <p className="eyebrow">{t('bonusRules.eyebrow')}</p>
        <h2>{t('bonusRules.createTitle')}</h2>
        <form className="stack-form" onSubmit={submit}>
          <input placeholder="Rule name" value={name} onChange={(event) => setName(event.target.value)} />
          <select value={scopeType} onChange={(event) => setScopeType(event.target.value as "round" | "tournament")}>
            <option value="round">{t('bonusRules.scopeRound')}</option>
            <option value="tournament">{t('bonusRules.scopeTournament')}</option>
          </select>
          <select value={scopeId} onChange={(event) => setScopeId(event.target.value)}>
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
          <input type="number" value={points} onChange={(event) => setPoints(Number(event.target.value))} />
          <textarea placeholder="Winner message" value={message} onChange={(event) => setMessage(event.target.value)} />
          <select value={preset} onChange={(event) => setPreset(event.target.value as BonusAnimationPreset)}>
            <option value="confetti">{t('bonusRules.animConfetti')}</option>
            <option value="fireworks">{t('bonusRules.animFireworks')}</option>
            <option value="spotlight">{t('bonusRules.animSpotlight')}</option>
            <option value="chaos">{t('bonusRules.animChaos')}</option>
          </select>
          <input placeholder="Optional Lottie URL" value={lottieUrl} onChange={(event) => setLottieUrl(event.target.value)} />
          <RuleBuilder value={definition} onChange={setDefinition} />
          <button className="button-primary" type="submit">{t('bonusRules.save')}</button>
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
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
