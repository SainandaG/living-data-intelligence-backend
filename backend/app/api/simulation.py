from fastapi import APIRouter, HTTPException
from app.services.data_simulator import data_simulator
from pydantic import BaseModel

router = APIRouter()

class SimulationSettings(BaseModel):
    interval_seconds: int = 120

@router.get("/simulation/status")
async def get_status():
    """Get the current status of the data simulator."""
    return {
        "running": data_simulator.running,
        "cycle": data_simulator._cycle
    }

@router.post("/simulation/start")
async def start_simulation(settings: SimulationSettings = None):
    """Start the data simulator."""
    if data_simulator.running:
        return {"status": "already running"}
    
    # In a real app, we'd update the interval here if needed
    # For now, we just start it
    await data_simulator.start_simulation()
    return {"status": "started"}

@router.post("/simulation/stop")
async def stop_simulation():
    """Stop the data simulator."""
    if not data_simulator.running:
        return {"status": "not running"}
    
    await data_simulator.stop_simulation()
    return {"status": "stopped"}
