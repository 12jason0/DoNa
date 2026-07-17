import os
import sys
import queue
import threading
import time
import streamlit as st
from dotenv import load_dotenv
from crewai import Agent, Crew, LLM, Process, Task

load_dotenv()

if os.getenv("GOOGLE_API_KEY") and not os.getenv("GEMINI_API_KEY"):
    os.environ["GEMINI_API_KEY"] = os.getenv("GOOGLE_API_KEY")

gemini_model = LLM(
    model="gemini/gemini-2.0-flash-lite",
    api_key=os.getenv("GOOGLE_API_KEY"),
    temperature=0.7,
)

st.set_page_config(page_title="DoNa AI 임원진 회의실", layout="wide")
st.title("DoNa AI 임원진 가상 회의실")
st.caption("안건을 입력하면 CMO → CTO → CBO 순서로 회의 후 보고서를 도출합니다.")

topic = st.text_area(
    "이번 주 논의할 주제를 입력하세요",
    placeholder="예: 망원동 데이트 코스 릴스 기획\n예: 신규 유저 온보딩 흐름 개선\n예: 티켓 플랜 전환율 높이는 방법",
    height=100,
)


def format_log(lines: list[str]) -> str:
    """crewai verbose 출력을 사람이 회의하는 형식으로 포맷"""
    result = []
    for line in lines:
        if "Agent:" in line or "# Agent" in line:
            result.append(f"\n{'━'*50}")
            result.append(line.strip())
            result.append(f"{'━'*50}")
        elif "## Task" in line or "Task:" in line:
            result.append(f"\n[안건] {line.replace('## Task:', '').replace('Task:', '').strip()}")
        elif "## Thought" in line or "Thought:" in line:
            result.append(f"\n[생각 중...] {line.replace('## Thought:', '').replace('Thought:', '').strip()}")
        elif "## Final Answer" in line or "Final Answer:" in line:
            result.append(f"\n[최종 발언] ↓")
        elif line.strip():
            result.append(line.rstrip())
    return "\n".join(result)


def run_crew_in_thread(topic, log_queue, result_container):
    try:
        cmo_agent = Agent(
            role="최고 마케팅 책임자 (CMO)",
            goal="주제에 맞춘 타겟 맞춤형 마케팅 및 숏폼 유입 기획",
            backstory="인스타그램 릴스 알고리즘과 2030 극 P 유저 타겟팅 전문가. 매니챗을 활용한 자동화 유입 설계가 주특기.",
            llm=gemini_model,
            verbose=True,
        )
        cto_agent = Agent(
            role="최고 기술 책임자 (CTO)",
            goal="마케팅 기획안의 기술적 타당성 검증 및 리소스 통제",
            backstory="Next.js 14, React Native(Expo), Prisma 전문가. 1인 개발 체제에서의 기회비용을 엄격히 감시함.",
            llm=gemini_model,
            verbose=True,
        )
        cbo_agent = Agent(
            role="최고 비즈니스 전략가 (CBO)",
            goal="의견을 종합하여 수익화 달성을 위한 최종 전략 보고서 작성",
            backstory="스타트업 자원 최적화 전문가. 고정비 최소화 및 월 수익 목표 달성을 우선함.",
            llm=gemini_model,
            verbose=True,
        )

        task_plan = Task(
            description=f"반드시 한국어로만 작성하라. 다음 안건에 대한 마케팅 기획안 및 유입 전환 퍼널을 설계하라: [{topic}]",
            expected_output="한국어로 작성된 마케팅 카피라이팅 및 유입 기획 초안",
            agent=cmo_agent,
        )
        task_review = Task(
            description="반드시 한국어로만 작성하라. CMO의 기획안을 바탕으로 현재 스택(Next.js 백엔드, PostgreSQL) 내에서의 구현 난이도와 기회비용을 검토하라.",
            expected_output="한국어로 작성된 기술 검토 의견서",
            agent=cto_agent,
        )
        task_report = Task(
            description="반드시 한국어로만 작성하라. 두 임원의 논의를 종합하여 이번 주 실행할 객관적인 Action Plan 최종 보고서를 작성하라. 수식어 없이 실행 가능한 항목 위주로.",
            expected_output="한국어 마크다운 형식의 결재용 주간 보고서",
            agent=cbo_agent,
        )

        dona_crew = Crew(
            agents=[cmo_agent, cto_agent, cbo_agent],
            tasks=[task_plan, task_review, task_report],
            process=Process.sequential,
        )

        result_container["result"] = dona_crew.kickoff()

    except Exception as e:
        result_container["error"] = str(e)
    finally:
        result_container["done"] = True


if st.button("회의 시작", type="primary"):
    if not topic.strip():
        st.warning("주제를 입력해 주세요.")
    else:
        col_log, col_report = st.columns([1, 1])

        with col_log:
            st.markdown("### 🗣️ 회의 진행 과정")
            log_placeholder = st.empty()
            log_placeholder.text("회의를 시작합니다...")

        with col_report:
            st.markdown("### 📋 통합 전략 보고서")
            report_placeholder = st.empty()
            report_placeholder.info("회의가 끝나면 여기에 보고서가 출력됩니다.")

        log_queue = queue.Queue()
        result_container = {"result": None, "error": None, "done": False}

        # crewai verbose 출력을 큐로 보내는 writer
        class QueueWriter:
            def __init__(self, q):
                self.q = q
                self._original = sys.__stdout__

            def write(self, text):
                self._original.write(text)
                if text:
                    self.q.put(text)

            def flush(self):
                self._original.flush()

        old_stdout = sys.stdout
        sys.stdout = QueueWriter(log_queue)

        thread = threading.Thread(
            target=run_crew_in_thread,
            args=(topic, log_queue, result_container),
            daemon=True,
        )
        thread.start()

        # 메인 스레드에서 큐를 읽어 Streamlit UI 업데이트
        log_lines = []
        while not result_container["done"] or not log_queue.empty():
            updated = False
            try:
                while True:
                    text = log_queue.get_nowait()
                    log_lines.append(text)
                    updated = True
            except queue.Empty:
                pass

            if updated:
                log_placeholder.text(format_log(log_lines)[-6000:])  # 최근 6000자

            time.sleep(0.3)

        thread.join(timeout=10)
        sys.stdout = old_stdout

        if result_container["error"]:
            st.error(f"오류 발생: {result_container['error']}")
        else:
            result = result_container["result"]
            output = result.raw if hasattr(result, "raw") else str(result)
            report_placeholder.markdown(output)
            st.success("✅ 회의 완료 — 보고서가 오른쪽에 출력됐습니다.")
