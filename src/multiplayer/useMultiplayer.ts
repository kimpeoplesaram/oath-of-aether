import { useEffect, useRef, useState } from "react";
import type { Direction } from "../render/sprites";
import type { JobId } from "../types";

export interface RemotePlayer {
  id: string;
  name: string;
  jobId: JobId;
  x: number;
  y: number;
  dir: Direction;
  moving: boolean;
  hp: number;
  maxHp: number;
  level: number;
}

export interface PartyMember {
  id: string;
  name: string;
  jobId: JobId;
}

export interface PartyState {
  partyId: string;
  leaderId: string;
  members: PartyMember[];
}

export interface PartyInviteReceived {
  fromId: string;
  fromName: string;
}

export interface PartyChatMessage {
  id: string;
  fromId: string;
  fromName: string;
  text: string;
  ts: number;
}

export interface EncounterParticipant {
  id: string;
  name: string;
  jobId: JobId;
  hp: number;
  maxHp: number;
}

export interface PendingAttackInfo {
  targetId: string;
  telegraphText: string;
  dodgePhrase: string;
  windupMs: number;
  deadlineAt: number;
}

export interface EncounterState {
  instanceId: string;
  monsterId: string;
  monsterHp: number;
  monsterMaxHp: number;
  participants: EncounterParticipant[];
  pendingAttack: PendingAttackInfo | null;
  partyBuffUntil: number;
  monsterDebuffUntil?: number;
  /** pendingAttack이 없을 때 다음 공격이 시작될 예정 시각 (없으면 null) */
  nextAttackAt?: number | null;
}

export type ConnectionStatus = "idle" | "connecting" | "connected" | "error";

let partyChatSeq = 0;

interface JoinInfo {
  serverUrl: string; // 예: wss://oath-of-aether-server.onrender.com
  room: string;
  name: string;
  jobId: JobId;
  hp?: number;
  maxHp?: number;
  level?: number;
}

interface MultiplayerHandlers {
  onMonsterCleared?: (instanceId: string) => void;
  /** yourHp/yourMaxHp: participants 배열에서 내 id의 항목을 이미 찾아 전달한 값 */
  onEncounterEnded?: (instanceId: string, result: "victory" | "defeat", yourHp: number, yourMaxHp: number) => void;
}

/**
 * 오버월드 위치 + 협동 전투(인카운터) 상태를 멀티플레이 서버와 동기화한다.
 * serverUrl/room이 비어있으면 연결을 시도하지 않는다 (싱글플레이).
 */
export function useMultiplayer(join: JoinInfo | null, handlers: MultiplayerHandlers = {}) {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [selfId, setSelfId] = useState<string | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [remotePlayers, setRemotePlayers] = useState<RemotePlayer[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [encounterState, setEncounterState] = useState<EncounterState | null>(null);
  const [partyState, setPartyState] = useState<PartyState | null>(null);
  const [pendingInvite, setPendingInvite] = useState<PartyInviteReceived | null>(null);
  const [partyChat, setPartyChat] = useState<PartyChatMessage[]>([]);
  const [partyNotice, setPartyNotice] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const selfIdRef = useRef<string | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!join || !join.serverUrl || !join.room) {
      setStatus("idle");
      return;
    }

    setStatus("connecting");
    let closedByUs = false;
    const ws = new WebSocket(join.serverUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "join",
          room: join.room,
          name: join.name,
          jobId: join.jobId,
          hp: join.hp,
          maxHp: join.maxHp,
          level: join.level,
        })
      );
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "joined") {
          selfIdRef.current = msg.id;
          setSelfId(msg.id);
          setStatus("connected");
        } else if (msg.type === "state") {
          const others: RemotePlayer[] = msg.players.filter((p: RemotePlayer) => p.id !== selfIdRef.current);
          setRemotePlayers(others);
          setHostId(msg.hostId ?? null);
        } else if (msg.type === "encounter_state") {
          setEncounterState(msg);
        } else if (msg.type === "encounter_ended") {
          setEncounterState(null);
          const mine = msg.participants.find((p: { id: string }) => p.id === selfIdRef.current);
          if (mine) {
            handlersRef.current.onEncounterEnded?.(msg.instanceId, msg.result, mine.hp, mine.maxHp);
          }
        } else if (msg.type === "monster_cleared") {
          handlersRef.current.onMonsterCleared?.(msg.instanceId);
        } else if (msg.type === "party_state") {
          setPartyState(msg.partyId ? { partyId: msg.partyId, leaderId: msg.leaderId, members: msg.members } : null);
        } else if (msg.type === "party_invite_received") {
          setPendingInvite({ fromId: msg.fromId, fromName: msg.fromName });
        } else if (msg.type === "party_invite_result") {
          setPartyNotice(msg.accepted ? `${msg.byName}님이 파티 초대를 수락했습니다.` : `${msg.byName}님이 파티 초대를 거절했습니다.`);
        } else if (msg.type === "party_chat") {
          partyChatSeq += 1;
          const entry: PartyChatMessage = { id: String(partyChatSeq), fromId: msg.fromId, fromName: msg.fromName, text: msg.text, ts: msg.ts };
          setPartyChat((prev) => [...prev.slice(-50), entry]);
        } else if (msg.type === "error") {
          setErrorMessage(msg.message);
          setStatus("error");
        }
      } catch {
        // 손상된 메시지는 무시
      }
    };

    ws.onerror = () => {
      if (!closedByUs) {
        setStatus("error");
        setErrorMessage("서버에 연결할 수 없습니다.");
      }
    };

    ws.onclose = () => {
      if (!closedByUs) setStatus("error");
    };

    return () => {
      closedByUs = true;
      ws.close();
      wsRef.current = null;
      setPartyState(null);
      setPendingInvite(null);
      setPartyChat([]);
      setHostId(null);
    };
    // join 객체는 호출부에서 변하지 않는 한 재연결하지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [join?.serverUrl, join?.room, join?.name, join?.jobId]);

  function sendRaw(obj: unknown) {
    const ws = wsRef.current;
    if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
  }

  function sendMove(x: number, y: number, dir: Direction, moving: boolean, hp?: number, maxHp?: number, level?: number) {
    sendRaw({ type: "move", x, y, dir, moving, hp, maxHp, level });
  }

  function sendPartyInvite(targetId: string) {
    sendRaw({ type: "party_invite", targetId });
  }

  function respondPartyInvite(accept: boolean) {
    sendRaw({ type: "party_invite_respond", accept });
    setPendingInvite(null);
  }

  function leaveParty() {
    sendRaw({ type: "party_leave" });
  }

  function kickFromParty(targetId: string) {
    sendRaw({ type: "party_kick", targetId });
  }

  function sendPartyChat(text: string) {
    sendRaw({ type: "party_chat", text });
  }

  function dismissPartyNotice() {
    setPartyNotice(null);
  }

  function joinEncounter(instanceId: string, monsterId: string, hp: number, maxHp: number) {
    sendRaw({ type: "encounter_join", instanceId, monsterId, hp, maxHp });
  }

  function leaveEncounter(instanceId: string) {
    sendRaw({ type: "encounter_leave", instanceId });
  }

  function sendEncounterAction(
    instanceId: string,
    kind: "damage" | "heal" | "buff" | "taunt" | "debuff" | "partyHeal",
    amount?: number,
    durationMs?: number
  ) {
    sendRaw({ type: "encounter_action", instanceId, kind, amount, durationMs });
  }

  function sendDodgeSuccess(instanceId: string) {
    sendRaw({ type: "encounter_dodge_success", instanceId });
  }

  return {
    status,
    selfId,
    hostId,
    room: join?.room ?? null,
    remotePlayers,
    errorMessage,
    encounterState,
    partyState,
    pendingInvite,
    partyChat,
    partyNotice,
    sendMove,
    joinEncounter,
    leaveEncounter,
    sendEncounterAction,
    sendDodgeSuccess,
    sendPartyInvite,
    respondPartyInvite,
    leaveParty,
    kickFromParty,
    sendPartyChat,
    dismissPartyNotice,
  };
}

export type MultiplayerApi = ReturnType<typeof useMultiplayer>;
