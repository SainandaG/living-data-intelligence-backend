import google.generativeai as genai
import os
import json
from app.services.schema_analyzer import schema_analyzer

class ChatService:
    def __init__(self):
        api_key = os.getenv("GOOGLE_API_KEY")
        if api_key:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel('gemini-1.5-flash')
            self.has_ai = True
        else:
            self.has_ai = False
            print("⚠️ ChatService: No GOOGLE_API_KEY found.")

    async def generate_response(self, message: str, connection_id: str, history: list = []) -> dict:
        if not self.has_ai:
            return {
                "response": "I'm sorry, but I can't help you right now because the AI service is not configured (missing API Key).",
                "related_nodes": []
            }

        # 1. Fetch Context (Schema & Analytics)
        print(f"DEBUG: Fetching schema for connection: {connection_id}")
        # schema_analyzer.analysis_results is a dict keyed by connection_id
        schema_context = schema_analyzer.get_analysis_result(connection_id)
        
        print(f"DEBUG: Schema context found: {schema_context is not None}")
        
        if not schema_context:
            return {
                "response": "I'm still analyzing the database schema. Please try again in a few moments.",
                "related_nodes": []
            }

        # 2. Construct System Prompt
        system_prompt = self._build_system_prompt(schema_context)
        
        # Safe schema serialization
        try:
            print("DEBUG: Serializing schema...")
            if hasattr(schema_context, 'model_dump'):
                 schema_dict = schema_context.model_dump()
            elif hasattr(schema_context, 'dict'):
                 schema_dict = schema_context.dict()
            else:
                 schema_dict = schema_context
            
            schema_str = json.dumps(schema_dict, default=str)[:15000] # Increased limit, safer serialization
            print(f"DEBUG: Schema serialized successfully. Length: {len(schema_str)}")
        except Exception as e:
            print(f"⚠️ Schema serialization warning: {e}")
            import traceback
            traceback.print_exc()
            schema_str = "Schema details unavailable due to serialization error."

        # 3. Construct Chat History
        chat_history = []
        
        formatted_history = []
        for msg in history:
            role = "user" if msg['role'] == 'user' else "model"
            formatted_history.append({"role": role, "parts": [msg['content']]})

        # Start a chat session
        try:
            chat = self.model.start_chat(history=formatted_history)
        except Exception as e:
            print(f"⚠️ Failed to start chat with history: {e}")
            chat = self.model.start_chat(history=[])
        
        # 4. Send Message with Context
        full_message = f"""
        [Context: You are an expert Data Analyst AI. Here is the database schema you are analyzing:
        {schema_str} 
        ]
        
        User Question: {message}
        
        Provide a helpful, concise answer. If the user asks for SQL, provide it in markdown.
        """

        try:
            import asyncio
            response = await asyncio.to_thread(chat.send_message, full_message)
            
            return {
                "response": response.text,
                "related_nodes": [] # TODO: Implement logic to extract related table names from response
            }
        except Exception as e:
            print(f"❌ Chat Error: {e}")
            return {
                "response": "I encountered an error while processing your request. Please try again.",
                "related_nodes": []
            }

    def _build_system_prompt(self, schema: any) -> str:
        # This helper is used if we want to pre-format schema string
        return ""

chat_service = ChatService()
