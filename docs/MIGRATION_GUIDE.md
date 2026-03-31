# Feature Migration Guide

## Safe Feature Enablement Process

This guide details how to safely enable the newly implemented features in the Living Data Intelligence Platform. All features are currently guarded by feature flags and default to `False`.

### Phase 1: Foundation (Ready)
**Status**: Implemented & Verified.
**Action**: None required. Foundation is active but features are dormant.

### Phase 2: Backend Agent Enhancements (Ready)
**Features**: T0 Agent V2 (Context), Modular Handlers.
**Rollout Steps**:
1. Enable `USE_ENHANCED_T0_AGENT = True` in `backend/app/config/feature_flags.py`.
2. Restart Backend.
3. Test voice commands.
4. If stable, enable `USE_MODULAR_HANDLERS = True`.

### Phase 3: ML Module (Ready)
**Features**: GNN Inference, Training Pipeline.
**Rollout Steps**:
1. Run training script: `python backend/ml/training/train_gnn.py` (ensure `gnn_checkpoint.pth` is created).
2. Enable `USE_GNN_INFERENCE = True` (if GNN inference integration is added to `neural_core.py`).
   *(Note: Current implementation focused on module existence. Integration is strictly optional).*

### Phase 4: Frontend Wrappers (Ready)
**Features**: Agent Classes, Advanced Audio.
**Rollout Steps**:
1. Enable `ENABLE_AGENT_CLASSES: true` in `frontend/src/config/features.ts`.
2. Enable `ENABLE_ADVANCED_AUDIO: true`.
3. Verify graph interactions and sound.

### Phase 5: Advanced Features (Ready)
**Features**: Glow, Events, Explainability.
**Rollout Steps**:
1. Enable `USE_BACKEND_GLOW_CALC = True`.
2. Enable `USE_ADVANCED_EVENT_PROCESSING = True`.
3. Enable `USE_ADVANCED_EXPLAINABILITY = True`.

## Rollback Procedure
If any issue arises:
1. Set the specific feature flag to `False`.
2. Restart the affected service (Backend or Frontend reload).
3. The system will revert to the legacy code path immediately.
