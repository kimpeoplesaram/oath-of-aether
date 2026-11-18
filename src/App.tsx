import { useEffect, useState } from "react";
import { playSfx, startBgm, toggleMuted, unlockAudio, isMuted } from "./audio/engine";
import { TitleScreen } from "./screens/TitleScreen";
import { CharacterCreateScreen, type MultiplayerJoinInput } from "./screens/CharacterCreateScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { ResumeScreen } from "./screens/ResumeScreen";
import { OverworldScreen, type QuestStatus } from "./screens/OverworldScreen";
import { CombatScreen } from "./screens/CombatScreen";
import { CoopCombatScreen } from "./screens/CoopCombatScreen";
import { getMonster } from "./data/monsters";
import { JOB_QUESTS } from "./data/quests";
import { DUNGEON_PORTALS, MONSTER_RESPAWN_MS, MONSTER_SPAWNS } from "./data/overworld";
import { computeStats, gainXp, maybeEquip } from "./combat/growth";
import { getEquipment } from "./data/equipment";
import { GRADE_LABELS } from "./data/grades";
import { getConsumable } from "./data/items";
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
  const [muted, setMutedState] = useState(() => isMuted());

  // 화면/전투 상황에 맞춰 배경음악(BGM)을 전환한다. 첫 사용자 클릭에서
  // AudioContext 잠금을 풀기 위한 리스너도 여기서 같이 등록한다.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: false });
    window.addEventListener("keydown", unlock, { once: false });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    if (screen === "combat" && encounter) {
      const isBossFight = getMonster(encounter.monsterId).isBoss;
      startBgm(isBossFight ? "boss" : "combat");
    } else if (screen === "overworld") {
      startBgm("overworld");
    } else {
      startBgm("title");
    }
  }, [screen, encounter]);

  function handleToggleMute() {
    const nowMuted = toggleMuted();
    setMutedState(nowMuted);
  }

  function showToast(text: string) {
    setToast(text);
    setTimeout(() => setToast((cur) => (cur === text ? null : cur)), 2800);
  }

  // 로그인된 계정이면 레벨/경험치/장비/체력/퀘스트 진행도를 서버에 저장한다
  // (최선 노력, 실패해도 게임은 계속된다). quest를 넘기지 않으면 현재 state
  // 값을 그대로 사용한다 (패배 후 부활처럼 퀘스트 진행이 바뀌지 않은 경우).
  function persistCharacter(p: PlayerCharacter, quest?: { questIndex: number; questKillCount: number }) {
    if (!accountSession) return;
    saveCharacter(accountSession.apiBaseUrl, accountSession.token, {
      level: p.level,
      xp: p.xp,
      equipment: p.equipment,
      hp: p.hp,
      questIndex: quest?.questIndex ?? questIndex,
      questKillCount: quest?.questKillCount ?? questKillCount,
      inventory: p.inventory,
      gold: p.gold,
    }).catch(() => {
      /* 저장 실패는 조용히 무시 — 다음 기회에 다시 저장됨 */
    });
  }

  // 몬스터 처치를 경험치/장비/퀘스트에 모두 반영하고, 메시지 배열을 돌려준다.
  function applyVictoryRewards(
    base: PlayerCharacter,
    monsterId: MonsterId
  ): { player: PlayerCharacter; messages: string[]; newQuestIndex: number; newQuestKillCount: number } {
    const monsterDef = getMonster(monsterId);
    const messages: string[] = [`${monsterDef.name} 처치! 경험치 +${monsterDef.xpReward}`];
    let newQuestIndex = questIndex;
    let newQuestKillCount = questKillCount;

    const { player: afterXp, leveledUp, levelsGained } = gainXp(base, monsterDef.xpReward);
    let updated = afterXp;
    if (leveledUp) {
      messages.push(`레벨 업! Lv.${updated.level} (+${levelsGained})`);
      playSfx("levelUp");
    }

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
      const gradeLabel = GRADE_LABELS[getEquipment(dropId)?.grade ?? "common"];
      if (equipped) messages.push(`[${gradeLabel}] ${itemName} 획득! 자동 장착`);
      else if (monsterDef.isBoss) messages.push(`[${gradeLabel}] ${itemName} 획득! (이미 더 좋은 장비 보유)`);
    }

    // 포션 드랍 (장비 드랍과 별개로 판정). 들판 몬스터는 가끔, 보스는 항상 더 좋은 포션을 떨군다.
    const potionDrops: string[] = monsterDef.isBoss
      ? ["potion_hp_large", "potion_mp_large"]
      : [
          ...(Math.random() < 0.4 ? ["potion_hp_small"] : []),
          ...(Math.random() < 0.25 ? ["potion_mp_small"] : []),
        ];
    if (potionDrops.length > 0) {
      const nextInventory = { ...updated.inventory };
      for (const itemId of potionDrops) {
        nextInventory[itemId] = (nextInventory[itemId] ?? 0) + 1;
        const item = getConsumable(itemId);
        if (item) messages.push(`[${GRADE_LABELS[item.grade]}] ${item.name} 획득!`);
      }
      updated = { ...updated, inventory: nextInventory };
    }

    // 골드 획득: 들판 몬스터는 소액, 보스는 큰 액수를 떨군다.
    const goldReward = monsterDef.isBoss
      ? 30 + Math.floor(Math.random() * 31) // 30~60
      : 3 + Math.floor(Math.random() * 6); // 3~8
    updated = { ...updated, gold: updated.gold + goldReward };
    messages.push(`골드 +${goldReward}`);

    const quest = JOB_QUESTS[base.job.id][questIndex];
    if (quest && (!quest.targetMonsterId || quest.targetMonsterId === monsterId)) {
      const nextCount = questKillCount + 1;
      if (nextCount >= quest.targetCount) {
        const { player: afterQuestXp, leveledUp: questLevelUp, levelsGained: questLevels } = gainXp(
          updated,
          quest.rewardXp
        );
        updated = afterQuestXp;
        messages.push(`퀘스트 완료: ${quest.title}! 보너스 경험치 +${quest.rewardXp}`);
        if (questLevelUp) {
          messages.push(`레벨 업! Lv.${updated.level} (+${questLevels})`);
          playSfx("levelUp");
        }
        newQuestIndex = questIndex + 1;
        newQuestKillCount = 0;
        setQuestIndex(newQuestIndex);
        setQuestKillCount(0);
      } else {
        newQuestKillCount = nextCount;
        setQuestKillCount(nextCount);
      }
    }

    return { player: updated, messages, newQuestIndex, newQuestKillCount };
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
            const { player: updated, messages, newQuestIndex, newQuestKillCount } = applyVictoryRewards(
              { ...p, hp: yourHp },
              cur.monsterId
            );
            playSfx("victory");
            showToast(messages.join("  ·  "));
            persistCharacter(updated, { questIndex: newQuestIndex, questKillCount: newQuestKillCount });
            return updated;
          }
          playSfx("defeat");
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

  // 인벤토리에서 아이템 1개를 소모한다 (수량만 변경). 실제 체력/마나 회복 효과는
  // 호출한 쪽(오버월드는 바로, 전투 중이면 useCombat/useCoopCombat)에서 적용한다.
  function consumeInventoryItem(itemId: string): boolean {
    if (!player) return false;
    const count = player.inventory[itemId] ?? 0;
    if (count <= 0) return false;
    const nextInventory = { ...player.inventory, [itemId]: count - 1 };
    if (nextInventory[itemId] <= 0) delete nextInventory[itemId];
    const updated = { ...player, inventory: nextInventory };
    setPlayer(updated);
    persistCharacter(updated);
    return true;
  }

  // 오버월드(전투 밖)에서 포션을 사용한다. 체력 포션만 의미가 있다 (마나는 전투 중에만 존재).
  function handleUsePotionOverworld(itemId: string) {
    if (!player) return;
    const item = getConsumable(itemId);
    if (!item) return;
    if (item.kind === "manaPotion") {
      showToast("마나 포션은 전투 중에만 사용할 수 있습니다.");
      return;
    }
    if (!consumeInventoryItem(itemId)) return;
    const stats = computeStats(player);
    playSfx("heal");
    setPlayer((p) => {
      if (!p) return p;
      const healed = { ...p, hp: Math.min(stats.maxHp, p.hp + item.restoreAmount) };
      persistCharacter(healed);
      return healed;
    });
    showToast(`${item.name} 사용! 체력 +${item.restoreAmount}`);
  }

  // 상점에서 골드로 포션을 구매한다.
  function handleBuyItem(itemId: string) {
    if (!player) return;
    const item = getConsumable(itemId);
    if (!item) return;
    if (player.gold < item.price) {
      showToast("골드가 부족합니다.");
      return;
    }
    const nextInventory = { ...player.inventory, [itemId]: (player.inventory[itemId] ?? 0) + 1 };
    const updated = { ...player, gold: player.gold - item.price, inventory: nextInventory };
    setPlayer(updated);
    persistCharacter(updated);
    playSfx("click");
    showToast(`${item.name} 구매! (-${item.price} G)`);
  }

  function handleCreate(
    character: PlayerCharacter,
    mpJoin: MultiplayerJoinInput | null,
    resumeProgress?: { questIndex: number; questKillCount: number }
  ) {
    setPlayer(character);
    setClearedInstanceIds([]);
    setQuestIndex(resumeProgress?.questIndex ?? 0);
    setQuestKillCount(resumeProgress?.questKillCount ?? 0);
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
    // 보스(던전 입구) 전투만 같은 방의 친구와 함께 싸운다. 들판의 슬라임/고블린은
    // 직업별 초반 퀘스트 대상이라 멀티플레이 중이어도 각자 혼자 처치한다.
    const isBossEncounter = DUNGEON_PORTALS.some((p) => p.instanceId === instanceId);
    const coop = isBossEncounter && !!multiplayer && mp.status === "connected";
    setEncounter({ instanceId, monsterId, mode: coop ? "coop" : "solo" });
    setScreen("combat");
  }

  // 솔로 전투 결과 처리 (협동 전투는 onEncounterEnded 핸들러가 처리)
  function handleResolvedSolo(result: CombatResult, finalHp: number) {
    if (!player || !encounter) return;

    if (result === "victory") {
      const { player: updated, messages, newQuestIndex, newQuestKillCount } = applyVictoryRewards(
        { ...player, hp: finalHp },
        encounter.monsterId
      );
      showToast(messages.join("  ·  "));
      setPlayer(updated);
      persistCharacter(updated, { questIndex: newQuestIndex, questKillCount: newQuestKillCount });
      const instanceId = encounter.instanceId;
      setClearedInstanceIds((prev) => (prev.includes(instanceId) ? prev : [...prev, instanceId]));
      // 들판 몬스터(슬라임/고블린)는 일정 시간 뒤 다시 나타난다. 던전 보스는 포탈 자체가
      // clearedInstanceIds로 가려지지 않으므로 그대로 둬도 반복 도전이 가능하다.
      if (MONSTER_SPAWNS.some((s) => s.instanceId === instanceId)) {
        setTimeout(() => {
          setClearedInstanceIds((prev) => prev.filter((id) => id !== instanceId));
        }, MONSTER_RESPAWN_MS);
      }
    } else if (result === "flee") {
      // 도망치기: 체력은 그대로(회복 없이) 유지한 채 전장에서 빠져나온다.
      // 몬스터는 처치된 것으로 치지 않으므로 clearedInstanceIds에 추가하지 않는다.
      playSfx("flee");
      const fled = { ...player, hp: finalHp };
      setPlayer(fled);
      persistCharacter(fled);
      showToast("전장에서 도망쳤습니다.");
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
    playSfx("flee");
    setEncounter(null);
    setScreen("overworld");
  }

  const jobQuests = player ? JOB_QUESTS[player.job.id] : [];
  const questsComplete = questIndex >= jobQuests.length;

  const quest = jobQuests[questIndex];
  const questStatus: QuestStatus | null = player
    ? quest
      ? { title: quest.title, description: quest.description, progress: questKillCount, target: quest.targetCount, done: false }
      : { title: "", description: "", progress: 0, target: 0, done: true }
    : null;

  return (
    <div
      className={`app-shell${
        screen === "login" ? " app-shell-wide" : screen === "overworld" || screen === "combat" ? " app-shell-game" : ""
      }`}
    >
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
          onUseItem={handleUsePotionOverworld}
          onBuyItem={handleBuyItem}
        />
      )}

      {screen === "combat" && player && encounter && encounter.mode === "solo" && (
        <CombatScreen
          player={player}
          monster={getMonster(encounter.monsterId)}
          startHp={player.hp}
          stats={computeStats(player)}
          inventory={player.inventory}
          onUseItem={consumeInventoryItem}
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
          inventory={player.inventory}
          onUseItem={consumeInventoryItem}
          onLeave={handleLeaveCoop}
        />
      )}

      {toast && <div className="toast">{toast}</div>}

      <button
        type="button"
        className="sound-toggle-btn"
        onClick={handleToggleMute}
        title={muted ? "소리 켜기" : "소리 끄기"}
      >
        {muted ? "🔇" : "🔊"}
      </button>
    </div>
  );
}
