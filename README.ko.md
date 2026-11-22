# 대화 심문 엔진 (Interrogation Engine)

**한 사람과 주고받는 긴장된 대화** — 심문, 자백 유도, 협상, 설득 — 를 만드는 작은 엔진입니다.
장면 하나를 자바스크립트 객체 하나로 쓰면, 엔진이 진행하고, 모바일 우선 기본 화면이 그리고,
시뮬레이터가 아무도 해 보기 전에 어떻게 굴러갈지 알려 줍니다.

[English README](README.md)

- **증거로, 또는 상대가 한 말로 깨는 거짓말.** 마디 하나가 거짓말(`claim`)이 될 수 있고, 맞는 증거로만 반박됩니다.
  상대가 앞에서 자랑한 말은 수첩에 남아 그 사람의 거짓말을 깨는 데 쓰입니다. 엉뚱한 때 증거를 내밀면 대화가 끝납니다.
- **구조로 지키는 개연성.** 관문(`gate`)이 걸린 거짓말은 건너뛸 수 없어서, 상대는 늘 이미 인정한 사실만 전제로 말합니다.
- **읽을 수 있는 계기.** 구역마다 버릇이 있는 주 계기(긴장·예민함 등)와 보조 계기(라포·인내심·의심 등).
  계기를 숨기고 버릇만 보고 판단하는 "탐정 모드"도 있습니다.
- **신호로 끼어드는 동료(선택).**
- **마지막 한 끗은 침묵.** 코너 마디에서 다그치는 대신 기다리면 상대가 스스로 털어놓게 만들 수 있습니다.
- **시뮬레이터.** 처음 하는 사람처럼 수천 판을 돌려 결과 비율을 목표와 비교하고, 반례("맞장구만으로는 못 이긴다")를
  검사하고, 대화를 글로 뽑아 이음새를 확인합니다.
- **의존성·빌드·`eval` 없음.** 압축하지 않은 순수 자바스크립트와 CSS 약 65KB. 브라우저와 Node 모두.

## 해 보기

**[브라우저에서 바로 연습장 열기](https://psxbgc-creator.github.io/interrogation-engine/)** — 또는 [`playground/index.html`](playground/index.html)을 내려받아 브라우저로 여세요(서버 필요 없음).
예제 두 개(영어·한국어판)를 직접 해 보고, 시뮬레이션하고, 대화를 뽑아 보고, 직접 쓴 시나리오 파일을 불러올 수 있습니다.

## 빠른 시작

```html
<link rel="stylesheet" href="src/interrogation-view.css">
<script src="src/interrogation.js"></script>
<script src="src/interrogation-view.js"></script>
<script src="scenarios/ko/office-envelope.js"></script>
<script>
  InterrogationView.open({
    scenario: Interrogation.scenarios['office-envelope-ko'],
    preset: 'A',
    evidence: ['keybook', 'badge', 'cctv', 'atm', 'receipt'],
    host: { bust: (id, mood) => `busts/${id}-${mood}.png` },
  }).then((r) => console.log(r.outcome, r.count));
</script>
```

화면 문구는 시나리오의 `lang`(`en`·`ko`)을 따르고, 시나리오 `ui`에서 바꿀 수 있습니다.

## 들어 있는 것

| 경로 | |
|---|---|
| `src/interrogation.js` | 엔진: 상태·규칙·식·저장/불러오기·검사·시뮬레이션 |
| `src/interrogation-view.js` | 기본 화면(모바일 우선, 영어·한국어 문구) |
| `src/interrogation-view.css` | 화면 스타일 |
| `scenarios/` | 영어 예제 `office-envelope.js`(거의 모든 기능), `parking-scrape.js`(최소), 한국어판은 `ko/` |
| `tools/check.js`, `tools/transcript.js` | 검사·시뮬레이션, 대화 예시 |
| `playground/` | 연습장 |
| `docs/authoring.ko.md` | 시나리오 쓰는 법(한국어). 전체 필드 표는 [영어판](docs/authoring.md) |

## 명령

```
npm test
node tools/check.js scenarios/ko/내장면.js --n 3000
node tools/transcript.js scenarios/ko/office-envelope.js --preset B --noise 0.5 --seed 7
```

## 출처

한국어 추리 게임 「21시 40분 — 첫 방문」의 공장장실 자백 장면에서 떼어 냈습니다.

## 라이선스

[MIT](LICENSE)
