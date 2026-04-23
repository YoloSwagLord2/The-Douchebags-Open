import { useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { RuleBuilder } from "../components/RuleBuilder";
import type { AchievementIconPreset, AchievementRuleResponse, NavigationTournament, RuleNode } from "../lib/types";

const initialRule: RuleNode = { op: "and", conditions: [{ field: "round_stableford", operator: "gte", value: 4 }] };

export function AdminAchievementRulesPage() {
  const { token } = useAuth();
  const [rules, setRules] = useState<AchievementRuleResponse[]>([]);
  const [navigation, setNavigation] = useState<NavigationTournament[]>([]);
  const [scopeType, setScopeType] = useState<"round" | "tournament">("round");
  const [scopeId, setScopeId] = useState("");
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [icon, setIcon] = useState<AchievementIconPreset>("star");
  const [definition, setDefinition] = useState<RuleNode>(initialRule);

  const load = async () => {
    if (!token) return;
    const [ruleData, nav] = await Promise.all([api.adminAchievementRules(token), api.navigation(token)]);
    setRules(ruleData);
    setNavigation(nav);
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, [token]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    await api.createAchievementRule(
      {
        name,
        scope_type: scopeType,
        round_id: scopeType === "round" ? scopeId : null,
        tournament_id: scopeType === "tournament" ? scopeId : null,
        title_template: title,
        message_template: message,
        definition,
        icon_preset: icon,
        enabled: true,
      },
      token,
    );
    await load();
  };

  return (
    <div className="admin-grid">
      <section className="detail-panel">
        <p className="eyebrow">Exceptional events</p>
        <h2>Create achievement rule</h2>
        <form className="stack-form" onSubmit={submit}>
          <input placeholder="Rule name" value={name} onChange={(event) => setName(event.target.value)} />
          <input placeholder="Popup title" value={title} onChange={(event) => setTitle(event.target.value)} />
          <textarea placeholder="Message template" value={message} onChange={(event) => setMessage(event.target.value)} />
          <select value={scopeType} onChange={(event) => setScopeType(event.target.value as "round" | "tournament")}>
            <option value="round">Round scoped</option>
            <option value="tournament">Tournament scoped</option>
          </select>
          <select value={scopeId} onChange={(event) => setScopeId(event.target.value)}>
            <option value="">Select scope</option>
            {scopeType === "tournament"
              ? navigation.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))
              : navigation.flatMap((item) =>
                  item.rounds.map((round) => (
                    <option key={round.id} value={round.id}>
                      {item.name} • Round {round.round_number}
                    </option>
                  )),
                )}
          </select>
          <select value={icon} onChange={(event) => setIcon(event.target.value as AchievementIconPreset)}>
            <option value="star">Star</option>
            <option value="ace">Ace</option>
            <option value="flame">Flame</option>
            <option value="trophy">Trophy</option>
          </select>
          <RuleBuilder value={definition} onChange={setDefinition} />
          <button className="button-primary" type="submit">Save achievement rule</button>
        </form>
      </section>
      <section className="detail-panel">
        <p className="eyebrow">Configured rules</p>
        <h2>Existing achievement rules</h2>
        <div className="list-stack">
          {rules.map((rule) => (
            <article className="detail-panel detail-panel--nested" key={rule.id}>
              <strong>{rule.name}</strong>
              <p>{rule.scope_type}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
