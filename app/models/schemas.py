from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

class DatabaseConfig(BaseModel):
    db_type: str
    host: str
    port: int
    database: str
    username: str
    password: str

class ConnectionResponse(BaseModel):
    success: bool
    message: str
    connection_id: Optional[str] = None

class Column(BaseModel):
    name: str
    type: str
    nullable: bool
    default: Optional[str] = None
    max_length: Optional[int] = None
    is_pk: bool = False
    is_fk: bool = False

class ForeignKey(BaseModel):
    column: str
    referenced_table: str
    referenced_column: str

class Table(BaseModel):
    name: str
    schema_name: Optional[str] = None
    columns: List[Column]
    primary_keys: List[str]
    foreign_keys: List[ForeignKey]
    row_count: int
    numeric_columns: List[str]
    table_type: Optional[str] = None  # 'fact' or 'dimension'
    business_entity: Optional[str] = None
    importance_score: Optional[int] = None

class Relationship(BaseModel):
    from_table: str
    to_table: str
    from_column: str
    to_column: str

class Schema(BaseModel):
    database: str
    tables: List[Table]
    relationships: List[Relationship]

class GraphNode(BaseModel):
    id: str
    name: str
    type: str  # 'fact', 'dimension', 'unknown'
    entity: str
    size: float
    color: str
    row_count: int
    metrics: List[str]
    columns: Optional[List[Column]] = None
    x: Optional[float] = None
    y: Optional[float] = None
    z: Optional[float] = None

class GraphEdge(BaseModel):
    source: str
    target: str
    type: str

class Graph(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]

class Metrics(BaseModel):
    connection_id: str
    timestamp: datetime
    transaction_rate: float
    total_transactions: int
    fraud_alerts: int
    average_amount: float
    failed_transactions: int
    active_connections: int

class RealtimeUpdate(BaseModel):
    type: str  # 'transaction', 'fraud', 'metric'
    data: Dict[str, Any]
    timestamp: datetime
