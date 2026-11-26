# BookBloom (북블룸)

실제 독서 활동으로 도서관을 성장시키는 게임 프로젝트입니다. 현재는 V4 에셋을 표시하는 PC 웹 정적 화면을 구현한 단계입니다.

## 로컬 실행

Node.js와 npm을 설치한 뒤 프로젝트 루트에서 실행합니다.

```sh
npm install
npm run dev
```

브라우저에서 Vite가 안내하는 로컬 주소를 엽니다. 타입 검사와 빌드는 `npm run build`로 확인합니다. 현재 화면은 가구 배치 검증용이며 독서 기록·손님·대출·저장은 아직 구현하지 않았습니다. 640×360은 V4 제작 좌표로 사용 중이며 최종 논리 해상도는 Android 실기기 검증 후 결정합니다.

## 문서

- AI 개발 시작 가이드: `docs/00-ai-guide.md`
- 프로젝트 개요: `docs/01-project-overview.md`
- 기술 설계: `docs/06-architecture.md`
- 기존 프로젝트 참조 가이드: `docs/06-4-reuse-guide.md`
- v0.1 로드맵: `docs/08-roadmap.md`
- 전체 문서 목록과 동기화 원칙: `docs/README.md`
- 로컬 원본 에셋: `assets/source/README.md`

노션은 기획과 의사결정 공간, 이 저장소의 Markdown 문서는 개발 기준으로 사용합니다. 구현 전 관련 문서의 확정·제안·미정 상태를 확인합니다.
