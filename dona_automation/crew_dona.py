import os
from dotenv import load_dotenv
from crewai import Agent, Crew, Process, Task

load_dotenv()

if os.getenv("GOOGLE_API_KEY") and not os.getenv("GEMINI_API_KEY"):
    os.environ["GEMINI_API_KEY"] = os.getenv("GOOGLE_API_KEY")

gemini_model = "gemini/gemini-1.5-flash-latest"

cmo_agent = Agent(
    role="최고 마케팅 책임자 (CMO)",
    goal="선택 피로도를 줄여주는 데이트 코스 제안이라는 핵심 가치에 맞춘 숏폼 콘텐츠 기획",
    backstory="인스타그램 릴스 알고리즘과 2030 극 P 유저 타겟팅 전문가. 매니챗(ManyChat)을 활용한 자동화 유입 설계가 주특기.",
    llm=gemini_model,
    verbose=True,
)

cto_agent = Agent(
    role="최고 기술 책임자 (CTO)",
    goal="마케팅 자동화의 기술적 타당성 검증 및 리소스 통제",
    backstory="Next.js 14, React Native(Expo), Prisma 전문가. 1인 개발 체제에서 마케팅 툴 개발로 인한 코어 앱 업데이트 지연을 엄격히 감시함.",
    llm=gemini_model,
    verbose=True,
)

cbo_agent = Agent(
    role="최고 비즈니스 전략가 (CBO)",
    goal="수익화 달성을 위한 최종 의사결정 및 주간 전략 보고서 작성",
    backstory="초기창업자의 수익화 모델 구축 및 자원 최적화 전문가. 외주 없이 고정비를 최소화하며 월 수익 1천만 원 달성을 목표로 함.",
    llm=gemini_model,
    verbose=True,
)

task_plan = Task(
    description="망원동 4시간 풀코스 데이터(나하, 숲터, 디스커버 굿 굿즈, 당도 등)를 활용하여 2030 무계획 P 커플을 타겟으로 한 15초 릴스 대본 작성 및 댓글 DM 자동화 유입 기획안을 도출하라.",
    expected_output="숏폼 카피라이팅 및 전환 퍼널 초안",
    agent=cmo_agent,
)

task_review = Task(
    description="CMO 기획안을 바탕으로 현재 스택(Next.js 백엔드, PostgreSQL) 내에서 내부 어드민 툴로 구현할 수 있는 데이터 호출 연동 범위를 확정하고, 기회비용을 계산하라.",
    expected_output="기술 검토 의견서",
    agent=cto_agent,
)

task_report = Task(
    description="두 임원의 의견을 종합하여 이번 주 실행할 'DoNa 개발 및 마케팅 연동 최종 전략 보고서'를 작성하라. 불필요한 수식어는 배제하고 객관적인 Action Plan 위주로 작성할 것.",
    expected_output="대표님 결재용 통합 주간 보고서 (Markdown 형식)",
    agent=cbo_agent,
    output_file="weekly_dona_report.md",
)

dona_crew = Crew(
    agents=[cmo_agent, cto_agent, cbo_agent],
    tasks=[task_plan, task_review, task_report],
    process=Process.sequential,
)

print("DoNa AI 임원진 회의를 시작합니다...")
result = dona_crew.kickoff()
print("\n## 회의 완료. 'weekly_dona_report.md' 파일이 생성되었습니다.")
