# 시나리오 쓰기

시나리오는 자바스크립트 객체 하나입니다. 엔진은 그것을 읽기만 하고, 이야기에 관한 것은 엔진에 하나도 없습니다.
가장 빠른 시작은 [`scenarios/ko/parking-scrape.js`](../scenarios/ko/parking-scrape.js)(가장 작음)나
[`scenarios/ko/office-envelope.js`](../scenarios/ko/office-envelope.js)(거의 모든 기능)를 복사해서 고치는 것입니다.
필드 이름과 표는 영어판 [authoring.md](authoring.md)와 같습니다. 여기서는 흐름과 설계 요령을 한국어로 정리합니다.

## 대화가 흘러가는 방식

1. 상대가 지금 **마디(node)**의 말을 합니다.
2. 플레이어는 **태도(stance)** 하나(맞장구·파고들기·편들기·침묵 등, 시나리오가 정함)로 답하거나, **증거**를 내밀거나,
   **동료**에게 신호를 보냅니다. 한 번 고른 대사는 다시 나오지 않습니다.
3. 그 태도의 **규칙** 중 조건이 맞는 첫 번째가 **계기**를 바꾸고, 대사를 고르고, 다음으로 넘기거나, 무언가를 밝히거나,
   경고하거나, 대화를 끝냅니다.
4. **전역 규칙(after)** 중 맞는 것을 모두 적용한 뒤 다음 마디가 시작됩니다.
5. 조각(**revelations**)이 다 나오거나, 턴·경고가 다 차거나, 대본이 끝나거나, 규칙이 `end`를 말하면 **결과(outcomes)** 중 맞는 첫 번째가 결과입니다.

## 설계: 거짓말 사다리

잘 읽히는 장면은 모두 같은 틀이었습니다.

1. **먼저 라포.** 맞장구를 치면 상대가 말이 많아집니다. 자랑을 하게 두고, 그 자랑을 `gain`으로 수첩에 남깁니다.
   이 말이 나중에 그 사람의 거짓말을 깨는 무기가 됩니다.
2. **계기.** 피하고 싶은 화제를 꺼내는 무언가(대개 미리 약속한 동료의 신호).
3. **거짓말 사다리.** 거짓말은 매번 직전 자백에서 한 발 물러선 변명입니다.
   거짓말마다 마디 하나에 `claim`을 달고 `gate`로 막아, 반박하기 전에는 넘어가지 못하게 합니다.
   그러면 상대는 늘 이미 인정한 사실만 전제로 말합니다.
4. **증거는 반박용.** 거짓말이 나와 있을 때 맞는 증거(또는 그가 한 말)를 내면 다음 조각이 나오고,
   그 밖의 때에 내면 대화가 끝납니다. 그래야 증거가 열쇠가 아니라 반박으로 느껴집니다.
5. **코너.** 마지막 거짓말이 깨지고 상대가 날이 서 있습니다. 다그치면 입을 닫고(반쪽),
   침묵하면 — 마지막 한 끗 — 상대가 답답해서 죄를 줄여 말하며 자백합니다.

## 검사

```
node tools/check.js scenarios/ko/내장면.js
node tools/transcript.js scenarios/ko/내장면.js --preset B --noise 0.5 --seed 3
```

- `sim.targets`는 처음 하는 사람 기준(noise 0.5 안팎)으로 맞추세요. 규칙을 다 아는 정책으로 맞추면 실제로는 훨씬 어렵습니다.
- 숫자보다 **대화 예시를 여러 판 읽는 것**이 이음새 문제를 훨씬 빨리 찾습니다.

## 게임에 넣기

```html
<link rel="stylesheet" href="interrogation-view.css">
<script src="interrogation.js"></script>
<script src="interrogation-view.js"></script>
<script src="scenarios/ko/내장면.js"></script>
<script>
  InterrogationView.open({
    scenario: Interrogation.scenarios['내장면-id'],   // 시나리오의 lang:'ko'면 화면 문구도 한국어
    preset: 'A', evidence: ['keybook', 'badge'],
    host: { bust: (id, mood) => `busts/${id}-${mood}.webp`, bg: 'room.webp' },
  }).then((r) => console.log(r.outcome, r.count, r.why));
</script>
```

화면 문구는 `InterrogationView.strings[lang]`에서 오고, 시나리오 `ui`에서 어느 것이든 바꿀 수 있습니다.

## 실제 게임에서 배운 것

이 엔진은 한국어 추리 게임 「21시 40분 — 첫 방문」의 자백 장면에서 나왔습니다.

- 증거를 골라 가게 하면 빠진 증거 때문에 대화가 어긋났습니다. 모은 증거는 전부 들고 가고, 카드는 한 번씩만,
  한 서류로 여러 거짓말을 깨야 하면 쪽으로 나눕니다(`evidenceAlias`).
- 선택지에 태도 이름(맞장구·파고들기)을 붙이면 대사 대신 이름을 보고 고릅니다. 숨기는 게 낫습니다.
- 미리 약속한 신호로 끼어드는 동료가, 플레이어가 마음대로 부리는 동료보다 훨씬 자연스럽습니다.
- 가장 반응이 좋았던 순간은 라포 단계의 자랑이 돌아와 거짓말을 깨는 장면이었습니다.
