import { useState } from "react";
import { TitleScreen } from "./screens/TitleScreen";
import { CharacterCreateScreen, type MultiplayerJoinInput } from "./screens/CharacterCreateScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { ResumeScreen } from "./screens/ResumeScreen";
import { OverworldScreen, type QuestStatus } from "./screens/OverworldScreen";
import { CombatScreen } from "./screens/CombatScreen";
import { CoopCombatScreen } from "./screens/CoopCombatScreen";
import { getMonster } from "./data/monsters";
import { QUESTS } from "./data/quests";
import { computeStats, gainXp, maybeEquip } from "./combat/growth";
import { getEquipment } from "./data/equipment";
import type { CombatResult } from "./combat/useCombat";
import { useMultiplayer } from "./multiplayer/useMultiplayer";
import { logout as apiLogout, saveCharacter, type AccountPayload } from "./multiplayer/accountApi";
import type { AccountSession, GameScreen, MonsterId, PlayerCharacter } from "./types";

interface ActiveEncounter {
  instanceId: string;
  monsterId: MonsterId;
  mode: "solo" | "coop";
}

export function App() {
  const [screen, setScreen] = useState<GameScreen>("title");
  const [player, setPlayer] = useState<PlayerCharacter | null>(null);
  const [clearedInstanceIds, setClearedInstanceIds] = useState<string[]>([]);
  const [encounter, setEncounter] = useState<ActiveEncounter | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [multiplayer, setMultiplayer] = useState<MultiplayerJoinInput | null>(null);
  const [questIndex, setQuestIndex] = useState(0);
  const [questKillCount, setQuestKillCount] = useState(0);
  const [accountSession, setAccountSession] = useState<AccountSession | null>(null);
  const [pendingAccount, setPendingAccount] = useState<AccountPayload | null>(null);
  const [pendingWsServerUrl, setPendingWsServerUrl] = useState("ws://localhost:8787");

  function showToast(text: string) {
    setToast(text);
    setTimeout(() => setToast((cur) => (cur === text ? null : cur)), 2800);
  }

  // 로그인된 계정이면 레벨/경험치/장비/체력을 서버에 저장한다 (최선 노력, 실패해도 게임은 계속된다).
  function persistCharacter(p: PlayerCharacter) {
    if (!accountSession) return;
    saveCharacter(accountSession.apiBaseUrl, accountSession.token, {
      level: p.level,
      xp: p.xp,
      equipment: p.equipment,
      hp: p.hp,
    }).catch(() => {
      /* 저장 실패는 조용히 무시 — 다음 기회에 다시 저장됨 */
    });
  }

  // 몬스터 처치를 경험치/장비/퀘스트에 모두 반영하고, 메시지 배열을 돌려준다.
  function applyVictoryRewards(base: PlayerCharacter, monsterId: MonsterId): { player: PlayerCharacter; messages: string[] } {
    const monsterDef = getMonster(monsterId);
    const messages: string[] = [`${monsterDef.name} 처치! 경험치 +${monsterDef.xpReward}`];

    const { player: afterXp, leveledUp, levelsGained } = gainXp(base, monsterDef.xpReward);
    let updated = afterXp;
    if (leveledUp) messages.push(`레벨 업! Lv.${updated.level} (+${levelsGained})`);

    const dropChance = monsterDef.isBoss ? 1 : 0.5;
    if (monsterDef.lootTable.length > 0 && Math.random() < dropChance) {
      let pool = monsterDef.lootTable;
      if (monsterDef.isBoss) {
        // 보스는 플레이어 직업이 실제로 쓸 수 있는 장비(무기는 직업 일치, 방어구는 공용) 중에서만 드랍
        const usable = pool.filter((id) => {
          const item = getEquipment(id);
          return !!item && (item.slot === "armor" || item.jobId === updated.job.id);
        });
        if (usable.length > 0) pool = usable;
      }
      const dropId = pool[Math.floor(Math.random() * pool.length)];
      const { player: afterEquip, equipped, itemName } = maybeEquip(updated, dropId);
      updated = afterEquip;
      if (equipped) messages.push(`${itemName} 획득! 자동 장착`);
      else if (monsterDef.isBoss) messages.push(`${itemName} 획득! (이미 더 좋은 장비 보유)`);
    }

    const quest = QUESTS[questIndex];
    if (quest && (!quest.targetMonsterId || quest.targetMonsterId === monsterId)) {
      const nextCount = questKillCount + 1;
      if (nextCount >= quest.targetCount) {
        const { player: afterQuestXp, leveledUp: questLevelUp, levelsGained: questLevels } = gainXp(
          updated,
          quest.rewardXp
        );
        updated = afterQuestXp;
        messages.push(`퀘스트 완료: ${quest.title}! 보너스 경험치 +${quest.rewardXp}`);
        if (questLevelUp) messages.push(`레벨 업! Lv.${updated.level} (+${questLevels})`);
        setQuestIndex((i) => i + 1);
        setQuestKillCount(0);
      } else {
        setQuestKillCount(nextCount);
      }
    }

    return { player: updated, messages };
  }

  const joinInfo =
    player && multiplayer
      ? { serverUrl: multiplayer.serverUrl, room: multiplayer.room, name: player.name, jobId: player.job.id }
      : null;

  const mp = useMultiplayer(joinInfo, {
    onMonsterCleared: (instanceId) => {
      setClearedInstanceIds((prev) => (prev.includes(instanceId) ? prev : [...prev, instanceId]));
    },
    onEncounterEnded: (instanceId, result, yourHp) => {
      setEncounter((cur) => {
        if (!cur || cur.instanceId !== instanceId) return cur;
        setPlayer((p) => {
          if (!p) return p;
          if (result === "victory") {
            const { player: updated, messages } = applyVictoryRewards({ ...p, hp: yourHp }, cur.monsterId);
            showToast(messages.join("  ·  "));
            persistCharacter(updated);
            return updated;
          }
          const stats = computeStats(p);
          showToast("쓰러졌지만 다시 일어났습니다. 체력을 회복했습니다.");
          const revived = { ...p, hp: stats.maxHp };
          persistCharacter(revived);
          return revived;
        });
        setScreen("overworld");
        return null;
      });
    },
  });

  function handleCreate(character: PlayerCharacter, mpJoin: MultiplayerJoinInput | null) {
    setPlayer(character);
    setClearedInstanceIds([]);
    setQuestIndex(0);
    setQuestKillCount(0);
    setMultiplayer(mpJoin);
    setScreen("overworld");
  }

  function handleLoggedIn(session: AccountSession, account: AccountPayload, wsServerUrl: string) {
    setAccountSession(session);
    setPendingAccount(account);
    setPendingWsServerUrl(wsServerUrl);
    setScreen("resume");
  }

  function handleLogout() {
    if (accountSession) apiLogout(accountSession.apiBaseUrl, accountSession.token).catch(() => {});
    setAccountSession(null);
    setPendingAccount(null);
    setScreen("title");
  }

  function handleEncounter(instanceId: string, monsterId: MonsterId) {
    const coop = !!multiplayer && mp.status === "connected";
    setEncounter({ instanceId, monsterId, mode: coop ? "coop" : "solo" });
    setScreen("combat");
  }

  // 솔로 전투 결과 처리 (협동 전투는 onEncounterEnded 핸들러가 처리)
  function handleResolvedSolo(result: CombatResult, finalHp: number) {
    if (!player || !encounter) return;

    if (result === "victory") {
      const { player: updated, messages } = applyVictoryRewards({ ...player, hp: finalHp }, encounter.monsterId);
      showToast(messages.join("  ·  "));
      setPlayer(updated);
      persistCharacter(updated);
      setClearedInstanceIds((prev) => [...prev, encounter.instanceId]);
    } else {
      const stats = computeStats(player);
      const revived = { ...player, hp: stats.maxHp };
      setPlayer(revived);
      persistCharacter(revived);
      showToast("쓰러졌지만 다시 일어났습니다. 체력을 회복했습니다.");
    }

    setEncounter(null);
    setScreen("overworld");
  }

  function handleLeaveCoop() {
    if (encounter) mp.leaveEncounter(encounter.instanceId);
    setEncounter(null);
    setScreen("overworld");
  }

  const questsComplete = questIndex >= QUESTS.length;

  const quest = QUESTS[questIndex];
  const questStatus: QuestStatus | null = player
    ? quest
      ? { title: quest.title, description: quest.description, progress: questKillCount, target: quest.targetCount, done: false }
      : { title: "", description: "", progress: 0, target: 0, done: true }
    : null;

  return (
    <div className={`app-shell${screen === "login" ? " app-shell-wide" : ""}`}>
      {screen === "title" && (
        <TitleScreen
          onStart={() => setScreen("create")}
          onLogin={() => setScreen(accountSession ? "resume" : "login")}
        />
      )}

      {screen === "create" && <CharacterCreateScreen onCreate={handleCreate} />}

      {screen === "login" && <LoginScreen onLoggedIn={handleLoggedIn} onBack={() => setScreen("title")} />}

      {screen === "resume" && pendingAccount && accountSession && (
        <ResumeScreen
          account={pendingAccount}
          session={accountSession}
          defaultServerUrl={pendingWsServerUrl}
          onLogout={handleLogout}
          onStart={handleCreate}
          onGuildChanged={(guildId) =>
            setPendingAccount((acc) => (acc ? { ...acc, guildId } : acc))
          }
        />
      )}

      {screen === "overworld" && player && (
        <OverworldScreen
          player={player}
          stats={computeStats(player)}
          clearedInstanceIds={clearedInstanceIds}
          multiplayerActive={!!multiplayer}
          mpStatus={mp.status}
          mpErrorMessage={mp.errorMessage}
          remotePlayers={mp.remotePlayers}
          sendMove={mp.sendMove}
          mp={mp}
          questStatus={questStatus}
          questsComplete={questsComplete}
          onEncounter={handleEncounter}
          onPortalLocked={() => showToast("던전 입구가 잠겨 있습니다. 모든 퀘스트를 먼저 완료하세요.")}
          onExitToTitle={() => setScreen("title")}
        />
      )}

      {screen === "combat" && player && encounter && encounter.mode === "solo" && (
        <CombatScreen
          player={player}
          monster={getMonster(encounter.monsterId)}
          startHp={player.hp}
          stats={computeStats(player)}
          onResolved={handleResolvedSolo}
        />
      )}

      {screen === "combat" && player && encounter && encounter.mode === "coop" && (
        <CoopCombatScreen
          mp={mp}
          instanceId={encounter.instanceId}
          monsterId={encounter.monsterId}
          player={player}
          stats={computeStats(player)}
          onLeave={handleLeaveCoop}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
