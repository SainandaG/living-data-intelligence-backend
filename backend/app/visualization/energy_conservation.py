from typing import Dict

class EnergyConservation:
    """
    Validates that the total visual energy of the system remains conserved or bounded,
    preventing 'visual explosion' in the interface.
    """
    
    def __init__(self, max_total_energy: float = 100.0):
        self.max_total_energy = max_total_energy
        
    def validate_energy_budget(self, glow_map: Dict[str, float]) -> bool:
        """
        Check if total glow energy exceeds budget.
        """
        total_energy = sum(glow_map.values())
        return total_energy <= self.max_total_energy
        
    def normalize_energy(self, glow_map: Dict[str, float]) -> Dict[str, float]:
        """
        Scale down energy values if they exceed the budget.
        """
        total_energy = sum(glow_map.values())
        
        if total_energy <= self.max_total_energy or total_energy == 0:
            return glow_map
            
        scale_factor = self.max_total_energy / total_energy
        
        return {
            k: v * scale_factor
            for k, v in glow_map.items()
        }
