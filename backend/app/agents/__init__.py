"""
Agent Package

All agent-related components consolidated here per Priority 4C:
  - t0_agent.py           : Tier-0 fast intent → action dispatcher
  - t1_agent.py           : Tier-1 agent with full action registry
  - agent_service.py      : Agent lifecycle orchestration
  - state_manager.py      : Conversation state persistence
  - analyst.py            : In-agent analytical tools
  - command_registry.py   : Command → handler mapping
  - context_manager.py    : Conversation context window building
  - intent_classifier.py  : Rule-based + LLM intent classification
  - wezu_agents.py        : WEZU energy domain agent
  - intent_classifier_v2.py : Improved intent classifier
  - unified_classifier.py : Unified classifier orchestrator
  - protocol.py           : Shared agent protocol schema
  - handlers/             : Individual action handler modules
"""
