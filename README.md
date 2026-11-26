# BookBloom (북블룸)

실제 독서 활동으로 도서관을 성장시키는 게임 프로젝트입니다. 현재는 V4 에셋을 표시하는 PC 웹 정적 화면을 구현한 단계입니다.

## 로컬 실행

Node.js와 npm을 설치한 뒤 프로젝트 루트에서 실행합니다.

```sh
npm install
npm run dev
```

브라우저에서 Vite가 안내하는 로컬 주소를 엽니다. 타입 검사와 빌드는 `npm run build`로 확인합니다. 현재 화면은 가구 배치 검증용이며 독서 기록·손님·대출·저장은 아직 구현하지 않았습니다. 640×360은 V4 제작 좌표로 사용 중이며 최종 논리 해상도는 Android 실기기 검증 후 결정합니다.

## Android 디버그 APK

Android Studio와 Android SDK가 설치된 환경에서 `npm run android:sync`로 웹 빌드를 Android 프로젝트에 반영합니다. 그 뒤 `android/`에서 `gradlew.bat assembleDebug`를 실행하면 `android/app/build/outputs/apk/debug/app-debug.apk`가 생성됩니다. Gradle이 SDK 경로를 찾지 못하면 `ANDROID_HOME`을 SDK 폴더로 지정합니다. `npm run android:open`으로 Android Studio에서 프로젝트를 열 수도 있습니다.

현재 Android 화면은 도서관 검증을 위해 가로 방향으로 고정했습니다. 독서관리 화면 추가 시 방향 전환 방식을 다시 결정해야 합니다. 앱 ID는 등록한 도메인 `bookbloom.kro.kr`을 뒤집은 `kr.kro.bookbloom`입니다. 에뮬레이터와 Android 13 실기기에서 설치·화면 표시를 확인했습니다. 긴 화면에서는 640×360 기본 장면을 가운데 두고 벽·바닥·상태바를 좌우로 확장해 앱 영역을 채웁니다. 터치 입력은 아직 검증하지 않았습니다.

## 문서

- AI 개발 시작 가이드: `docs/00-ai-guide.md`
- 프로젝트 개요: `docs/01-project-overview.md`
- 기술 설계: `docs/06-architecture.md`
- 기존 프로젝트 참조 가이드: `docs/06-4-reuse-guide.md`
- v0.1 로드맵: `docs/08-roadmap.md`
- 전체 문서 목록과 동기화 원칙: `docs/README.md`
- 로컬 원본 에셋: `assets/source/README.md`

노션은 기획과 의사결정 공간, 이 저장소의 Markdown 문서는 개발 기준으로 사용합니다. 구현 전 관련 문서의 확정·제안·미정 상태를 확인합니다.
