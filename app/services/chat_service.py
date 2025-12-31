import google.generativeai as genai
import os
import json
from datetime import datetime
from app.services.schema_analyzer import schema_analyzer

class ChatService:
    def __init__(self):
        self.api_key = os.getenv("GOOGLE_API_KEY")
        self.openai_key = os.getenv("OPENAI_API_KEY")
        self.model_name = os.getenv("AI_MODEL", "gemini-1.5-flash")
        self.model = None
        self.openai_client = None
        self.has_ai = False
        
        with open("chat_debug.txt", "a", encoding="utf-8") as f:
            f.write(f"\n--- ChatService Init at {datetime.now().isoformat()} ---\n")
            f.write(f"GOOGLE_API_KEY present: {bool(self.api_key)}\n")
            f.write(f"OPENAI_API_KEY present: {bool(self.openai_key)}\n")
        
        self._initialize_ai()

    def _initialize_ai(self):
        # 1. Initialize Gemini
        if self.api_key:
            try:
                genai.configure(api_key=self.api_key)
                self.model = genai.GenerativeModel(self.model_name)
                self.has_ai = True
                print(f"✨ ChatService: Gemini AI initialized with {self.model_name}")
            except Exception as e:
                print(f"❌ ChatService: Failed to initialize Gemini: {e}")

        # 2. Initialize OpenAI (as fallback or alternative)
        if self.openai_key:
            try:
                from openai import OpenAI
                self.openai_client = OpenAI(api_key=self.openai_key)
                self.has_ai = True
                print("✨ ChatService: OpenAI client initialized")
            except Exception as e:
                print(f"❌ ChatService: Failed to initialize OpenAI: {e}")
        
        if not self.has_ai:
            print("⚠️ ChatService: No AI keys found. Using heuristics.")

    async def generate_response(self, message: str, target_connection_id: str, history: list = []) -> dict:
        """
        Generate a response using the available AI models (Gemini -> OpenAI -> Heuristic).
        """
        try:
            # Re-check key in case it was added to env without restart
            if not self.has_ai:
                self.api_key = os.getenv("GOOGLE_API_KEY")
                self.openai_key = os.getenv("OPENAI_API_KEY")
                self._initialize_ai()

            # Initialize variables
            from app.services.db_connector import db_connector
            final_cid = target_connection_id
            schema_context = None

            # 1. Fetch Context
            try:
                connection = db_connector.get_safe_connection(target_connection_id)
                if connection:
                    final_cid = connection.get('id', target_connection_id)
                schema_context = await schema_analyzer.analyze_schema(final_cid)
            except Exception as e:
                print(f"⚠️ ChatService: Context fetch warning: {e}")
            
            # 2. Neural Intelligence Metrics
            from app.services.neural_core import neural_core
            neural_metrics = neural_core.get_learning_metrics(final_cid)
            core_status = neural_core.get_core_metrics()
            
            intelligence_context = {
                "neural_status": core_status,
                "connection_metrics": neural_metrics.get('connection_metrics', {}),
                "learning_epsilon": neural_metrics.get('epsilon', 0),
                "model_state": neural_metrics.get('model_state', 'active'),
                "total_actions": neural_metrics.get('total_actions', 0),
                "avg_reward": neural_metrics.get('avg_reward', 0)
            }
            
            # --- Early Exit if No AI ---
            if not self.has_ai:
                from app.services.agent_analyst import agent_analyst
                response = await agent_analyst.process_query(message, final_cid)
                return {
                    "response": f"{response}\n\n*(Heuristic Mode - No AI Keys Detected)*",
                    "related_nodes": []
                }

            # 3. Safe schema serialization
            schema_str = "Schema details unavailable."
            try:
                if schema_context:
                    if hasattr(schema_context, 'model_dump'):
                        schema_dict = schema_context.model_dump()
                    elif hasattr(schema_context, 'dict'):
                        schema_dict = schema_context.dict()
                    else:
                        schema_dict = schema_context
                    schema_str = json.dumps(schema_dict, default=str)[:15000] 
            except Exception:
                pass

            # 4. Construct AI System Prompt
            full_message = f"""
            [SYSTEM ROLE: Expert Data Analyst for the 'Living Data Intelligence' platform.
            
            NEURAL CORE CONTEXT:
            {json.dumps(intelligence_context, indent=2)}
    
            SCHEMA CONTEXT:
            {schema_str}
            ]
            
            USER QUESTION: {message}
            
            INSTRUCTIONS:
            1. Use the provided context to answer the user's specific database questions.
            2. If they ask for SQL, provide clean, optimized SELECT statements in markdown.
            3. If they ask about AI learning, refer to the 'Neural Status'.
            4. Keep answers professional, concise, and insightful.
            """

            # 5. Attempt Gemini Response
            try:
                formatted_history = []
                for msg in history:
                    role = "user" if msg['role'] == 'user' else "model"
                    formatted_history.append({"role": role, "parts": [msg['content']]})

                chat = self.model.start_chat(history=formatted_history)
                import asyncio
                response = await asyncio.to_thread(chat.send_message, full_message)
                
                return {
                    "response": response.text,
                    "related_nodes": [] 
                }
            except Exception as e:
                # Fallback to OpenAI if Gemini fails
                print(f"🔄 ChatService: Gemini failed ({type(e).__name__}). Checking OpenAI fallback...")
                
                if self.openai_client:
                    try:
                        messages = [{"role": "system", "content": "You are a Data Analyst AI."}]
                        for msg in history:
                            messages.append({"role": msg['role'], "content": msg['content']})
                        messages.append({"role": "user", "content": full_message})

                        completion = self.openai_client.chat.completions.create(
                            model="gpt-4-turbo-preview",
                            messages=messages,
                            timeout=30.0
                        )
                        
                        if completion.choices:
                            return {
                                "response": completion.choices[0].message.content,
                                "related_nodes": []
                            }
                    except Exception as openai_err:
                        print(f"❌ ChatService: OpenAI fallback failed: {openai_err}")
                
                # Final Fallback: Heuristic Agent
                print("🔄 ChatService: All AI APIs unavailable. Using Heuristic Agent.")
                from app.services.agent_analyst import agent_analyst
                response = await agent_analyst.process_query(message, final_cid)
                return {
                    "response": f"{response}\n\n*(Heuristic Mode - AI currently unavailable)*",
                    "related_nodes": []
                }

        except Exception as top_err:
            import traceback
            print(f"🔥 ChatService Critical Error: {top_err}")
            traceback.print_exc()
            return {
                "response": "I encountered a processing error. Please check the backend logs.",
                "related_nodes": []
            }

    def _build_system_prompt(self, schema: any) -> str:
        # This helper is used if we want to pre-format schema string
        return ""

chat_service = ChatService()
