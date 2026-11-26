# 기존 저장소 및 에셋 확인 기록

확인일: 2026-11-26. 기존 저장소는 임시 폴더에 얕게 복제하여 읽기 전용으로 확인했다. 이 문서는 실제 파일을 확인한 범위만 기록한다. 코드 이식, 실행 테스트, 에셋 시각 검수는 아직 하지 않았다.

## 확인한 버전

| 자료 | 확인한 버전 | 상태 |
| --- | --- | --- |
| [Bookhive](https://github.com/Jungea/Bookhive) | `82ee1e3` | React, Vite, Phaser, TypeScript |
| [my-library](https://github.com/Jungea/my-library) | `7f846fe` | Expo, React Native, SQLite |
| [PageRoom](https://github.com/Jungea/PageRoom) | `fe5e0c2` | Next.js, Supabase |
| assets_v4 | 2026-11-26 갱신 파일 | README, manifest, ZIP, 미리보기 및 폴더 존재 확인 |

## 재사용 후보

| 출처 파일 | 분류 | 이유와 적용 조건 |
| --- | --- | --- |
| Bookhive `src/components/GameCanvas.tsx` | 수정 재사용 후보 | React에서 Phaser를 생성·파기하고 부모 크기 변화를 관찰한다. 현재 화면 비율 계산은 `9 / 20`이며 BookBloom의 16:9 가로 화면에 맞게 다시 설계해야 한다. |
| Bookhive `src/game/config.ts` | 설계 참조 | Phaser 설정의 출발점으로 볼 수 있다. 현재 `Scale.RESIZE`와 Arcade Physics 사용은 고정 논리 해상도 후보 및 최소 게임 로직 원칙에 맞춰 검토해야 한다. |
| Bookhive `src/game/scenes/PreloadScene.ts` | 설계 참조 | 에셋 로딩 흐름은 참고할 수 있다. 실제 경로와 프레임은 새 에셋 manifest를 기준으로 작성해야 한다. |
| Bookhive `src/game/scenes/MainScene.ts` | 제외 | 초기 생성부터 손님·대출·재고·UI 이벤트를 함께 처리한다. v0.1에 없는 기능이 포함되고 배치가 현재 초기 4슬롯 구성과 다르다. |
| my-library `src/game/engine.ts` 및 `__tests__/engine.test.ts` | 설계 참조 | 순수 함수와 단위 테스트 구성은 참고할 수 있다. 현재 보상은 포인트 기반이며 오프라인 대출 건수를 시간만으로 계산해 현재 재고·8시간 보상 정책에 맞지 않는다. v0.1 범위도 아니다. |
| my-library `src/game/visitor.ts` | 후속 설계 참조 | 시간 기반 손님 상태 전환 예시다. 현재 경로에는 BookBloom의 대출 데스크·대기열 단계가 없다. v0.2 이후 관련 작업에서 검토한다. |
| PageRoom `lib/types.ts` | 설계 참조 | 도서·독서 기록 타입의 출발점이다. 기존 콘텐츠 유형과 장르 배열은 BookBloom의 일반 도서 우선, 대표 장르 1개와 보조 장르 체계에 맞춰 재설계해야 한다. |
| PageRoom `components/content-form.tsx` | 수정 재사용 후보 | 도서 입력 UI와 상태 선택 흐름을 참고할 수 있다. Next.js Server Action 의존성과 기존 장르 목록을 제거·변경해야 한다. |
| PageRoom `lib/actions/reading-record.ts` | 설계 참조 | 독서 진행 기록과 활동 이력 분리 예시다. Next.js 서버 전용이며, 확인한 `updateProgress`는 기록 수정과 활동 로그 삽입을 각각 수행한다. BookBloom의 로컬 저장·중복 보상 일관성 설계가 별도로 필요하다. |

위 분류는 코드 검토 결과이며 직접 재사용 승인이 아니다. 실제 이식 시 대상 기능별 테스트와 PC·Android 검증이 필요하다.

## 에셋과 환경

- V4 에셋을 `assets/source/v4/`에 내려받았다. `README.md`, `manifest.json`, `preview.png`, `reference_original.png`와 하위 에셋 폴더가 있다. README에는 640×360 논리 화면, 4개 균등 슬롯, 초기 데스크 / 책장 / 빈 슬롯 / 반납 트레이 구성이 적혀 있다.
- V4 manifest의 에셋 경로 34개가 모두 로컬 파일과 일치한다. 2026-11-26에 V4를 초기 화면 에셋으로 선택했다. 각 PNG의 실제 게임 적용 적합성은 PC·Android 화면에서 검증한다.
- 로컬 도구: Node `v26.13.0`, npm `11.20.0` (`npm.cmd`로 실행 가능), Git `2.53.0`, Java 21 확인. `adb`, `gradle`, Android Studio 명령과 Android SDK 환경 변수는 현재 셸에서 확인되지 않았다. Android 빌드 가능 여부는 아직 미검증이다.

## 다음 판단

v0.1 첫 구현은 React·Vite·Phaser로 PC에서 **V4 에셋을 사용한 정적 4슬롯 화면**을 띄우는 작은 작업부터 시작한다. 최종 논리 해상도는 화면 비교 및 Android 실기기 검증 후 결정한다. Bookhive의 화면 설정은 그대로 복사하지 않는다. 독서 기록과 게임 도서 보상은 정적 화면 검증 이후 별도 작업으로 설계한다.
