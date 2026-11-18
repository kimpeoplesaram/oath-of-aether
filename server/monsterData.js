// 서버가 협동 전투(인카운터)를 진행하는 데 필요한 최소한의 몬스터 데이터.
// src/data/monsters.ts 와 내용이 같아야 한다 (수치를 바꾸면 양쪽 다 수정할 것).
export const MONSTERS = {
  forest_slime: {
    name: "숲의 슬라임",
    hp: 80,
    attackIntervalMs: 9000,
    attacks: [
      { telegraphText: "슬라임이 몸을 웅크려 돌진을 준비합니다!", dodgePhrase: "옆으로 구르기", damage: 12, windupMs: 4500 },
      { telegraphText: "슬라임이 산성 점액을 튀기려 합니다!", dodgePhrase: "방패로 막아내기", damage: 16, windupMs: 4000 },
    ],
  },
  goblin_raider: {
    name: "고블린 약탈자",
    hp: 130,
    attackIntervalMs: 7500,
    attacks: [
      { telegraphText: "고블린이 녹슨 칼을 치켜듭니다!", dodgePhrase: "재빠르게 뒤로 물러서기", damage: 18, windupMs: 4200 },
      { telegraphText: "고블린이 돌을 집어 던지려 합니다!", dodgePhrase: "몸을 숙여 피하기", damage: 14, windupMs: 3600 },
    ],
  },
  forest_guardian: {
    isBoss: true,
    name: "숲의 수호자",
    hp: 320,
    attackIntervalMs: 6500,
    attacks: [
      { telegraphText: "수호자가 거대한 주먹을 들어 올립니다!", dodgePhrase: "땅이 흔들리기 전에 굴러라", damage: 24, windupMs: 3800 },
      { telegraphText: "수호자의 발밑에서 뿌리가 솟아오릅니다!", dodgePhrase: "뿌리를 피해 도약하기", damage: 20, windupMs: 3200 },
      { telegraphText: "수호자가 포효하며 돌조각을 흩뿌립니다!", dodgePhrase: "팔로 얼굴을 가리고 버티기", damage: 28, windupMs: 4000 },
    ],
  },
  ice_wraith: {
    isBoss: true,
    name: "얼음 망령",
    hp: 380,
    attackIntervalMs: 6500,
    attacks: [
      { telegraphText: "망령의 주위에 서리 기운이 소용돌이칩니다!", dodgePhrase: "온기를 지키며 버티기", damage: 22, windupMs: 3600 },
      { telegraphText: "망령이 날카로운 얼음 조각을 쏘아냅니다!", dodgePhrase: "재빨리 몸을 숙이기", damage: 26, windupMs: 3200 },
      { telegraphText: "망령이 주변 전체에 눈보라를 일으킵니다!", dodgePhrase: "숨을 참고 눈보라 견디기", damage: 30, windupMs: 4200 },
    ],
  },
  lava_golem: {
    isBoss: true,
    name: "용암 골렘",
    hp: 460,
    attackIntervalMs: 7000,
    attacks: [
      { telegraphText: "골렘의 몸에서 균열이 벌어지며 용암이 솟구칩니다!", dodgePhrase: "갈라진 틈을 피해 물러서기", damage: 26, windupMs: 3800 },
      { telegraphText: "골렘이 불타는 주먹으로 땅을 내리찍으려 합니다!", dodgePhrase: "충격파가 오기 전에 뛰어오르기", damage: 32, windupMs: 3400 },
      { telegraphText: "골렘이 가슴의 화구에서 열기를 내뿜습니다!", dodgePhrase: "뜨거운 숨결 피해 몸을 돌리기", damage: 34, windupMs: 4400 },
    ],
  },
};
