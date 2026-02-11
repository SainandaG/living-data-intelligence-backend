import json
try:
    with open('graph_conn_1_new.json', 'r') as f:
        data = json.load(f)
    nodes = data.get('nodes', [])
    for n in nodes:
        if n.get('color') == '#F44336':
            print(f"RED NODE: {n.get('id')} | ENTITY: {n.get('entity')} | TYPE: {n.get('table_type')}")
            # Print everything that might influence color
            filtered = {k: v for k, v in n.items() if k in ['id', 'entity', 'business_entity', 'color', 'table_type', 'cluster']}
            print(f"  DATA: {filtered}")
except Exception as e:
    print(f"Error: {e}")
