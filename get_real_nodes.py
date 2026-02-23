import sys
import os
import asyncio
import json

sys.path.append(os.path.abspath('backend'))
os.chdir('backend') # change dir so env loading works

try:
    from app.services.schema_analyzer import schema_analyzer
    async def main():
        # get schema
        class DummyConn:
            def __init__(self, c_id):
                self.id = c_id
        
        try:
            schema = await schema_analyzer.analyze_schema("test_connection")
            if hasattr(schema, "dict"):
                print(json.dumps(schema.dict(), indent=2)[:3000])
            else:
                print(json.dumps(schema, indent=2)[:3000])
        except Exception as e:
            print("Failed schema:", e)

    asyncio.run(main())
except Exception as e:
    print("Error:", e)
