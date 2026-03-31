"""
Agent Executor — runs an AgentPlan step by step, streaming events via
an async generator that can be forwarded directly to an SSE endpoint.

Parallel steps (those with no unresolved depends_on) are run concurrently
using asyncio.gather, keeping wall-clock time minimal.
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, AsyncGenerator, Dict, List, Set

from .planner import AgentPlan, AgentStep
from .memory import AgentMemory
from .tools import TOOL_REGISTRY

logger = logging.getLogger(__name__)


class AgentExecutor:
    """
    Executes an AgentPlan and yields AgentEvents as Server-Sent Events.

    Event schema (JSON-serialisable dict):
        type:       "plan_start" | "step_start" | "step_status" | "step_result" | "step_error" | "plan_done" | "error"
        step_index: int (for step events)
        tool:       str
        text:       str   (human-readable progress message)
        data:       dict  (structured result, optional)
        summary:    str   (one-liner for collapsed view)
    """

    async def execute(
        self,
        plan: AgentPlan,
        connection_id: str,
        memory: AgentMemory,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        memory.set("original_query", plan.query, source="executor")

        yield {
            "type":        "plan_start",
            "session_id":  plan.session_id,
            "intent":      plan.intent,
            "step_count":  len(plan.steps),
            "text":        f"Plan ready ({len(plan.steps)} steps) — {plan.reasoning[:120]}",
            "steps":       [{"index": s.index, "tool": s.tool, "description": s.description} for s in plan.steps],
        }

        completed: Set[int] = set()
        failed:    Set[int] = set()
        _results:   Dict[int, Any] = {}

        start_time = time.time()

        # Topological wave execution
        pending = list(plan.steps)
        while pending:
            # Find all steps whose dependencies are satisfied
            ready = [
                s for s in pending
                if all(d in completed for d in s.depends_on)
                and not any(d in failed for d in s.depends_on)
            ]
            if not ready:
                # Blocked — mark remaining as skipped
                for s in pending:
                    yield {"type": "step_error", "step_index": s.index,
                           "tool": s.tool, "text": f"Step {s.index} skipped — dependency failed."}
                    failed.add(s.index)
                break

            # Run ready steps concurrently
            if len(ready) == 1:
                async for event in self._run_step(ready[0], connection_id, memory):
                    yield event
                idx = ready[0].index
                if any(e.get("type") == "error" for e in []):
                    failed.add(idx)
                else:
                    completed.add(idx)
            else:
                # Parallel execution — merge streams
                async for event in self._run_parallel(ready, connection_id, memory):
                    yield event
                for s in ready:
                    completed.add(s.index)

            for s in ready:
                pending.remove(s)

        elapsed = round(time.time() - start_time, 1)
        report  = memory.get("final_report", {})

        yield {
            "type":       "plan_done",
            "session_id": plan.session_id,
            "elapsed_s":  elapsed,
            "steps_done": len(completed),
            "text":       f"Analysis complete in {elapsed}s.",
            "report":     report,
        }

    # ── Step execution ────────────────────────────────────────────────────────

    async def _run_step(
        self, step: AgentStep, connection_id: str, memory: AgentMemory
    ) -> AsyncGenerator[Dict, None]:
        yield {
            "type":       "step_start",
            "step_index": step.index,
            "tool":       step.tool,
            "text":       step.description or f"Running {step.tool}...",
        }

        tool = TOOL_REGISTRY.get(step.tool)
        if not tool:
            yield {"type": "step_error", "step_index": step.index,
                   "tool": step.tool, "text": f"Unknown tool: {step.tool}"}
            return

        t0 = time.time()
        try:
            async for event in tool.execute(step.params, memory, connection_id):
                yield {"step_index": step.index, "tool": step.tool, **event}
        except Exception as exc:
            logger.error("step %d (%s) raised: %s", step.index, step.tool, exc, exc_info=True)
            yield {"type": "step_error", "step_index": step.index,
                   "tool": step.tool, "text": str(exc)}
        finally:
            elapsed_ms = round((time.time() - t0) * 1000)
            yield {
                "type":       "step_done",
                "step_index": step.index,
                "tool":       step.tool,
                "elapsed_ms": elapsed_ms,
                "text":       f"Step {step.index} done ({elapsed_ms}ms)",
            }

    async def _run_parallel(
        self, steps: List[AgentStep], connection_id: str, memory: AgentMemory
    ) -> AsyncGenerator[Dict, None]:
        """Merge event streams from concurrent steps into one ordered stream."""
        queue: asyncio.Queue = asyncio.Queue()

        async def run_one(step: AgentStep) -> None:
            async for event in self._run_step(step, connection_id, memory):
                await queue.put(event)
            await queue.put({"__step_done__": step.index})

        tasks = [asyncio.create_task(run_one(s)) for s in steps]
        done_count = 0
        target = len(steps)

        while done_count < target:
            event = await queue.get()
            if "__step_done__" in event:
                done_count += 1
            else:
                yield event

        # Ensure all tasks are awaited
        await asyncio.gather(*tasks, return_exceptions=True)
