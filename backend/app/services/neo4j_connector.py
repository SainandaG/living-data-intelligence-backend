import os
import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

# Note: neo4j library is an optional dependency
try:
    from neo4j import GraphDatabase
    NEO4J_AVAILABLE = True
except ImportError:
    NEO4J_AVAILABLE = False
    logger.warning("neo4j driver not installed. Neo4j features will be disabled.")

class Neo4jConnector:
    """
    Neo4j Connector for advanced graph operations.
    Used for path tracing, cycle detection, and large-scale graph analytics.
    """
    def __init__(self):
        self.uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
        self.user = os.getenv("NEO4J_USER", "neo4j")
        self.password = os.getenv("NEO4J_PASSWORD", "password")
        self.driver = None
        
        if NEO4J_AVAILABLE:
            try:
                self.driver = GraphDatabase.driver(self.uri, auth=(self.user, self.password))
                logger.info("Neo4j Registry Initialized")
            except Exception as e:
                logger.error(f"Failed to connect to Neo4j: {e}")

    def execute_query(self, query: str, parameters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Execute a Cypher query."""
        if not self.driver:
            return []
        
        try:
            with self.driver.session() as session:
                result = session.run(query, parameters or {})
                return [record.data() for record in result]
        except Exception as e:
            logger.error(f"Neo4j Query Error: {e}")
            return []

    def close(self):
        if self.driver:
            self.driver.close()

# Global Instance
neo4j_connector = Neo4jConnector()
