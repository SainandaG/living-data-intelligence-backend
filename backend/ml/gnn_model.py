import torch
import torch.nn as nn
import torch.nn.functional as F

class GATLayer(nn.Module):
    """
    Graph Attention Network Layer.
    """
    def __init__(self, in_features, out_features, dropout=0.6, alpha=0.2):
        super(GATLayer, self).__init__()
        self.dropout = dropout
        self.in_features = in_features
        self.out_features = out_features
        self.alpha = alpha
        
        self.W = nn.Parameter(torch.empty(size=(in_features, out_features)))
        nn.init.xavier_uniform_(self.W.data, gain=1.414)
        self.a = nn.Parameter(torch.empty(size=(2*out_features, 1)))
        nn.init.xavier_uniform_(self.a.data, gain=1.414)
        
        self.leakyrelu = nn.LeakyReLU(self.alpha)

    def forward(self, h, adj):
        Wh = torch.mm(h, self.W) 
        e = self._prepare_attentional_mechanism_input(Wh)

        zero_vec = -9e15*torch.ones_like(e)
        attention = torch.where(adj > 0, e, zero_vec)
        attention = F.softmax(attention, dim=1)
        attention = F.dropout(attention, self.dropout, training=self.training)
        h_prime = torch.matmul(attention, Wh)

        return F.elu(h_prime)

    def _prepare_attentional_mechanism_input(self, Wh):
        N = Wh.size()[0] 
        Wh_repeated_in_chunks = Wh.repeat_interleave(N, dim=0)
        Wh_repeated_alternating = Wh.repeat(N, 1)
        all_combinations_matrix = torch.cat([Wh_repeated_in_chunks, Wh_repeated_alternating], dim=1)
        return self.leakyrelu(torch.matmul(all_combinations_matrix, self.a).view(N, N))

class GNNModel(nn.Module):
    """
    Full GNN Model composed of GAT layers.
    """
    def __init__(self, in_features, hidden_features, out_features, dropout=0.6, alpha=0.2, n_heads=1):
        super(GNNModel, self).__init__()
        self.dropout = dropout
        
        # Simple single-head GAT for now
        self.layer1 = GATLayer(in_features, hidden_features, dropout=dropout, alpha=alpha)
        self.layer2 = GATLayer(hidden_features, out_features, dropout=dropout, alpha=alpha)

    def forward(self, x, adj):
        x = F.dropout(x, self.dropout, training=self.training)
        x = self.layer1(x, adj)
        x = F.dropout(x, self.dropout, training=self.training)
        x = self.layer2(x, adj)
        return F.log_softmax(x, dim=1)
