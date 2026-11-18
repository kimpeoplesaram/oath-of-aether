import { useEffect, useState } from "react";
import type { JobDefinition } from "../types";

interface Props {
  job: JobDefinition;
  onContinue: () => void;
}

const PARAGRAPHS = [
  "먼 옛날, 이 세계의 모든 생명과 마법은 하나의 근원에서 흘러나왔다. 사람들은 그것을 '에테르'라 불렀다.",
  "에테르는 너무도 강력했기에, 선조들은 그 힘이 세상을 집어삼키지 않도록 '서약'을 맺었다. 빛과 어둠, 질서와 혼돈이 서로의 경계를 지키기로 한 약속. 그 서약이 지켜지는 동안, 세상은 균형 속에서 평화를 누렸다.",
  "그러나 서약은 영원하지 않았다. 아무도 그 이유를 정확히 알지 못한다 — 누군가의 욕심 때문이었는지, 혹은 에테르 스스로가 오래된 약속에 지쳤던 것인지. 확실한 것은, 서약이 깨지는 순간 하늘과 땅 사이에 수많은 균열이 생겨났다는 사실이다.",
  "균열 너머에서 쏟아져 나온 것은 괴물들이었다. 슬라임과 고블린 같은 작은 것들부터, 숲의 수호자, 얼음 망령, 용암 골렘처럼 하나의 재앙이라 불릴 만한 존재들까지. 마을은 하나둘 버려졌고, 사람들은 각자의 방식으로 살아남는 법을 배워야 했다.",
  "그 사이, 몇몇은 에테르의 파편을 몸에 받아들여 평범한 사람보다 강한 힘을 갖게 되었다. 검과 활, 지팡이와 노래, 그 어떤 것을 들어도 — 정확한 의지와 말로 그것을 벼려낼 수 있는 자들. 사람들은 그들을 '모험가'라 부르기 시작했다.",
];

/** 캐릭터를 처음 생성했을 때 보여주는 세계관 인트로. 문단이 순서대로 떠오르듯
 * 나타나고, 언제든 건너뛸 수 있다. */
export function StoryIntroScreen({ job, onContinue }: Props) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (visibleCount >= PARAGRAPHS.length) {
      setDone(true);
      return;
    }
    const t = setTimeout(() => setVisibleCount((c) => c + 1), 1500);
    return () => clearTimeout(t);
  }, [visibleCount]);

  return (
    <div className="story-intro-screen">
      <button type="button" className="story-skip-btn" onClick={onContinue}>
        건너뛰기 »
      </button>

      <div className="story-intro-content">
        <h2 className="title-font story-intro-title">에테르의 서약</h2>
        <div className="story-paragraphs">
          {PARAGRAPHS.slice(0, visibleCount).map((p, i) => (
            <p key={i} className="story-paragraph" style={{ animationDelay: "0s" }}>
              {p}
            </p>
          ))}
        </div>

        {done && (
          <div className="story-final">
            <p className="story-paragraph story-final-line">
              이제 {job.name} {job.icon}으로서, 당신만의 서약을 써나갈 시간이다.
            </p>
            <button type="button" className="btn-primary story-continue-btn" onClick={onContinue}>
              모험을 시작한다
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
