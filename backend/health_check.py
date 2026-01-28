import requests
import json

# Quick health check
print("Testing backend health...\n")

# Test 1: Check if server is responding
try:
    response = requests.get("http://localhost:8001/api/connections", timeout=5)
    print(f" Server is responding (Status: {response.status_code})")
    
    if response.status_code == 200:
        connections = response.json()
        print(f"   Active connections: {len(connections)}")
        
        if connections:
            # Test 2: Try to get timeline for first connection
            conn_id = connections[0]['id']
            print(f"\n Testing timeline for {conn_id}...")
            
            timeline_response = requests.get(f"http://localhost:8001/api/evolution/timeline/{conn_id}", timeout=10)
            print(f"   Timeline Status: {timeline_response.status_code}")
            
            if timeline_response.status_code == 200:
                timeline = timeline_response.json()
                print(f"    Timeline loaded successfully!")
                print(f"      Tables: {len(timeline.get('table_evolution', []))}")
                print(f"      Start: {timeline.get('start_date', 'N/A')[:10]}")
                print(f"      End: {timeline.get('end_date', 'N/A')[:10]}")
                
                # Test 3: Try to get a snapshot
                if timeline.get('end_date'):
                    print(f"\n Testing snapshot...")
                    snapshot_response = requests.get(
                        f"http://localhost:8001/api/evolution/snapshot/{conn_id}",
                        params={"timestamp": timeline['end_date']},
                        timeout=10
                    )
                    print(f"   Snapshot Status: {snapshot_response.status_code}")
                    
                    if snapshot_response.status_code == 200:
                        snapshot = snapshot_response.json()
                        print(f"    Snapshot generated successfully!")
                        print(f"      Tables in snapshot: {len(snapshot.get('tables', []))}")
                        if snapshot.get('tables'):
                            t = snapshot['tables'][0]
                            print(f"      Sample: {t['name']} - rows={t['row_count']}, vitality={t['vitality']}")
                    else:
                        print(f"    Snapshot failed: {snapshot_response.text[:200]}")
            else:
                print(f"    Timeline failed: {timeline_response.text[:200]}")
        else:
            print("    No active connections. Please connect to a database first.")
    
except requests.exceptions.Timeout:
    print(" Server timeout - backend may still be starting up")
except Exception as e:
    print(f" Error: {e}")

print("\n" + "="*50)
print("Backend health check complete!")
