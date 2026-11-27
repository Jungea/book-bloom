# 개발 문서 목록

| 파일 | 내용 |
| --- | --- |
| 00-ai-guide.md | AI 개발 시작 가이드 |
| 01-project-overview.md | 프로젝트 개요 |
| 02-game-design.md | 게임 기획 |
| 03-reading-management.md | 독서 관리 기획 |
| 04-ui-ux.md | UI/UX 설계 |
| 05-asset-guide.md | 그래픽 및 에셋 |
| 06-architecture.md | 기술 설계 |
| 06-4-reuse-guide.md | 기존 프로젝트 참조 및 재사용 |
| 07-database.md | 데이터베이스 설계 |
| 08-roadmap.md | MVP 및 로드맵 |
| 09-development-log.md | 개발 기록 양식 |
| 10-ideas.md | 아이디어 및 레퍼런스 |
| 11-reference-review.md | 기존 저장소와 에셋 실제 확인 기록 |
| conventions.md | 개발 규칙 초안 |
| game-rules.md | v0.1 중심 게임 규칙 초안 |

2026-11-26에 기획 문서를 이관했습니다. 각 문서 첫머리에 확인 날짜를 기록했습니다. 오래된 제안과 이후 확정 사항이 함께 남아 있으므로 제목의 순서만으로 최신 결정을 판단하지 않습니다. `00-ai-guide.md`의 해석 원칙과 문서 안의 명시적 확정·보완 문구를 따릅니다.

노션 변경이 생기면 해당 문서의 차이를 검토하고 Markdown에 반영합니다. 반영 후 확인 날짜와 Git 변경 이력을 갱신합니다. 문서별 `r1` 버전표는 현재 노션 원문에서 확인되지 않아 생성하지 않았습니다. 실제 버전표가 마련되면 동기화 상태 파일을 추가합니다.

초기 화면 에셋은 V4로 선택했습니다. 현재 미확정: 최종 논리 해상도, 기존 코드의 파일별 재사용 범위. Android 화면 방향 전환은 앱 안의 로컬 Capacitor 플러그인으로 구현했으나 컴파일·실기기 검증 전이다(`09-development-log.md`). 기존 저장소와 에셋의 실제 게임 적용 검증은 별도 단계입니다.
