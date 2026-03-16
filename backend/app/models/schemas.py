from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime

class ErrorResponse(BaseModel):
    error: str
    code: str

class StatusResponse(BaseModel):
    success: bool
    message: str

class ConnectionRequest(BaseModel):
    db_type: Literal["postgresql", "mysql", "mongodb", "neon", "neon_db"]
    host: str = Field(..., min_length=3, max_length=253)
    port: int = Field(..., ge=1, le=65535)
    database: str = Field(..., min_length=1, max_length=128, pattern=r'^[a-zA-Z0-9_\-]+$')
    username: str = Field(..., min_length=1, max_length=128)
    password: str = Field(..., min_length=1, max_length=256)
    
    @validator('host')
    def no_injection_in_host(cls, v):
        if any(c in v for c in [';', "'", '"', '--', '/*']):
            raise ValueError('Invalid host')
        return v

class AIQueryRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    connection_id: str = Field(..., pattern=r'^[a-zA-Z0-9_\-]+$')

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
    decision_provenance: Optional[str] = None
    property_mapping: Optional[Dict[str, str]] = None

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
    decision_provenance: Optional[str] = None
    property_mapping: Optional[Dict[str, str]] = None
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
