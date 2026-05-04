"""
neural_core.py  backward-compatibility shim.
All implementation lives in app/services/neural_core/ package.
This file exists only so existing `from app.services.neural_core import ...` calls keep working.
"""
from app.services.neural_core.core import neural_core, NeuralCore

__all__ = ["neural_core", "NeuralCore"]

