# BookBloom (북블룸)

실제 독서 활동으로 도서관을 성장시키는 게임 프로젝트입니다. 현재는 V4 에셋을 표시하는 PC 웹 정적 화면을 구현한 단계입니다.

## 로컬 실행

Node.js와 npm을 설치한 뒤 프로젝트 루트에서 실행합니다.

```sh
npm install
npm run dev
```

브라우저에서 Vite가 안내하는 로컬 주소를 엽니다. 타입 검사와 빌드는 `npm run build`로 확인합니다. 현재 화면은 가구 배치 검증용이며 독서 기록·손님·대출·저장은 아직 구현하지 않았습니다. 640×360은 V4 제작 좌표로 사용 중이며 최종 논리 해상도는 Android 실기기 검증 후 결정합니다.

## 개발자 테스트 패널

화면 왼쪽 아래의 테스트 패널(`도서 1권`, `도서 10권`, `책장 채우기`, `초기화`)로 도서 획득과 책장 진열을 반복 확인합니다. 패널은 실제 게임 코어(`src/core`)를 호출합니다. 도서관 상태(책장·보관함)는 변경될 때마다 브라우저 IndexedDB에 저장되어 새로고침이나 앱 재실행 후 복원됩니다. 디버그 빌드는 `bookbloom-debug`, 일반 빌드는 `bookbloom` 저장소를 써서 테스트 데이터가 섞이지 않습니다. 패널의 `초기화`는 현재 빌드의 저장 상태를 빈 도서관으로 되돌립니다. 패널은 `npm run dev`와 `npm run build:debug`(`--mode debug`)에서만 켜집니다. `npm run build`의 일반 빌드에는 패널 코드가 포함되지 않습니다. 책장 용량(`TEMP_SHELF_CAPACITY`)은 기획이 정해지지 않아 선반에 들어가는 개수를 쓰는 임시 상수입니다. 자동 테스트는 `npm test`로 실행합니다.

## Android 디버그 APK

Android Studio와 Android SDK가 설치된 환경에서 `npm run android:sync`로 웹 빌드를 Android 프로젝트에 반영합니다. 테스트 패널이 필요한 터치 검증용 디버그 APK는 `npm run android:sync:debug`로 반영하세요(패널 포함 빌드). 출시용 빌드는 항상 `npm run android:sync`를 사용합니다. 그 뒤 `android/`에서 `gradlew.bat assembleDebug`를 실행하면 `android/app/build/outputs/apk/debug/app-debug.apk`가 생성됩니다. Gradle이 SDK 경로를 찾지 못하면 `ANDROID_HOME`을 SDK 폴더로 지정합니다. `npm run android:open`으로 Android Studio에서 프로젝트를 열 수도 있습니다.

현재 Android 화면은 도서관 검증을 위해 가로 방향으로 고정했습니다. 독서관리 화면 추가 시 방향 전환 방식을 다시 결정해야 합니다. 앱 ID는 등록한 도메인 `bookbloom.kro.kr`을 뒤집은 `kr.kro.bookbloom`입니다. 에뮬레이터와 Android 13 실기기에서 설치·화면 표시를 확인했습니다. 긴 화면에서는 640×360 기본 장면을 가운데 두고 벽·바닥·상태바를 좌우로 확장해 앱 영역을 채웁니다. 개발자 패널의 Android 입력은 ADB 터치 명령으로 확인했으며 손가락 직접 조작은 아직 미실시입니다.

## 문서

- AI 개발 시작 가이드: `docs/00-ai-guide.md`
- 프로젝트 개요: `docs/01-project-overview.md`
- 기술 설계: `docs/06-architecture.md`
- 기존 프로젝트 참조 가이드: `docs/06-4-reuse-guide.md`
- v0.1 로드맵: `docs/08-roadmap.md`
- 전체 문서 목록과 동기화 원칙: `docs/README.md`
- 로컬 원본 에셋: `assets/source/README.md`

노션은 기획과 의사결정 공간, 이 저장소의 Markdown 문서는 개발 기준으로 사용합니다. 구현 전 관련 문서의 확정·제안·미정 상태를 확인합니다.
