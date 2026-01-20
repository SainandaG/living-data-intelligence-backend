"""
Evolution API Endpoints
Endpoints for temporal database genesis playback.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Dict, List, Any, Optional
from datetime import datetime
from app.services.temporal_analyzer import temporal_analyzer
from app.services.evolution_engine import evolution_engine

router = APIRouter(prefix="/api/evolution", tags=["Evolution"])

@router.get("/analyze/{connection_id}")
async def analyze_evolution(connection_id: str):
    """Analyze the evolution timeline of a connected database."""
    try:
        data = await temporal_analyzer.analyze_evolution(connection_id)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Evolution analysis failed: {str(e)}")

@router.get("/timeline/{connection_id}")
async def get_timeline(connection_id: str):
    """Get the full evolution timeline for a connection."""
    try:
        result = temporal_analyzer.get_result(connection_id)
        if not result:
            result = await temporal_analyzer.analyze_evolution(connection_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=f"Connection stale or not found: {str(e)}. Please reconnect.")
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(error_trace)
        raise HTTPException(status_code=500, detail=f"Timeline analysis failed: {str(e)}\n{error_trace}")

@router.get("/snapshot/{connection_id}")
async def get_snapshot(
    connection_id: str, 
    timestamp: str = Query(..., description="ISO 8601 timestamp")
):
    """Get a database state snapshot for a specific point in time."""
    try:
        target_time = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        snapshot = await evolution_engine.get_snapshot(connection_id, target_time)
        return snapshot
    except ValueError as e:
        error_msg = f"Invalid timestamp or connection: {str(e)}"
        print(f"[Evolution API] {error_msg}")
        raise HTTPException(status_code=400, detail=error_msg)
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[Evolution API] Snapshot generation failed:\n{error_trace}")
        raise HTTPException(status_code=500, detail=f"Snapshot generation failed: {str(e)}")

@router.get("/playback/{connection_id}")
async def get_playback_keyframes(
    connection_id: str,
    steps: int = Query(50, ge=10, le=200)
):
    """Get a sequence of keyframes for smooth evolution animation."""
    try:
        keyframes = await evolution_engine.generate_keyframes(connection_id, steps)
        return {
            "connection_id": connection_id,
            "keyframes": keyframes,
            "count": len(keyframes)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analysis/table/{connection_id}/{table_name}")
async def get_table_analysis(connection_id: str, table_name: str):
    """Get deep intelligence analysis for a specific table"""
    from app.services.analysis_engine import analysis_engine
    try:
        return await analysis_engine.get_table_intelligence(connection_id, table_name)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analysis/insight/{connection_id}/{table_name}")
async def get_ai_insight(connection_id: str, table_name: str):
    """
    Generate a Groq-powered sci-fi insight for a specific table node.
    """
    from app.services.analysis_engine import analysis_engine
    try:
        # 1. Get raw metrics first
        data = await analysis_engine.get_table_intelligence(connection_id, table_name)
        metrics = data.get("metrics", {})
        
        # 2. Derive Topology (Mirroring Frontend Logic)
        in_d = metrics.get('in_degree', 0)
        out_d = metrics.get('out_degree', 0)
        
        topology = "Ring" # Default
        if in_d > out_d:
            topology = "Nucleus"
        elif out_d > in_d + 1:
            topology = "Helix"
            
        # 3. Call AI
        insight = await analysis_engine.generate_ai_insight(table_name, metrics, topology)
        
        return {
            "table_name": table_name,
            "topology": topology,
            "insight": insight
        }
    except Exception as e:
        print(f"Insight Generation Failed: {e}")
        import traceback
        traceback.print_exc()
        # Fallback response so UI doesn't break
        return {
            "table_name": table_name,
            "topology": "Unknown",
            "insight": "Neural Link Unstable. Unable to process semantic narrative."
        }
