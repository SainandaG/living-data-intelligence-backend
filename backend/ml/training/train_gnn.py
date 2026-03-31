import torch
import torch.nn.functional as F
from torch_geometric.data import Data
import os
import sys

# Add backend to path to import GraphNeuralCore
sys.path.append(os.path.join(os.getcwd(), 'backend'))
try:
    from ml.graph_neural_core import GraphNeuralCore
except ImportError:
    # Fallback for direct execution
    from backend.ml.graph_neural_core import GraphNeuralCore

class GNNTrainer:
    def __init__(self, model: GraphNeuralCore, lr: float = 0.01):
        self.model = model
        self.optimizer = torch.optim.Adam(model.parameters(), lr=lr)
        self.criterion = torch.nn.MSELoss()
    
    def load_training_data(self):
        """Load data from collect_training_data.py output"""
        data_path = "backend/ml/models/training_data.pt"
        if not os.path.exists(data_path):
            print("❌ Training data not found. Run collect_training_data.py first.")
            return None
            
        data_dict = torch.load(data_path)
        return Data(
            x=data_dict['x'],
            y=data_dict['y'],
            edge_index=data_dict['edge_index']
        )
    
    def train(self, epochs: int = 100):
        """Execution of training loop"""
        data = self.load_training_data()
        if data is None: return

        print(f"🚀 Starting GNN training for {epochs} epochs...")
        self.model.train()
        
        for epoch in range(epochs):
            self.optimizer.zero_grad()
            
            # Forward pass
            # Note: GraphNeuralCore.forward might need x and edge_index
            out = self.model(data.x, data.edge_index)
            
            loss = self.criterion(out, data.y)
            loss.backward()
            self.optimizer.step()
            
            if (epoch + 1) % 10 == 0:
                print(f"Epoch {epoch+1}/{epochs} | Loss: {loss.item():.6f}")
                
        self.save_model()
        
    def save_model(self):
        """Save model state dict"""
        model_path = "backend/ml/models/gnn_trained.pt"
        torch.save(self.model.state_dict(), model_path)
        print(f"✅ Model weights saved to {model_path}")

if __name__ == "__main__":
    # Initialize model
    model = GraphNeuralCore()
    
    # Train
    trainer = GNNTrainer(model)
    trainer.train(epochs=50)
