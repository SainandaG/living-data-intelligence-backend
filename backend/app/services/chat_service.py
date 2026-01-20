import os
import json
import re
from dotenv import load_dotenv

# Load environment variables FIRST
load_dotenv()

from app.services.schema_analyzer import schema_analyzer
from app.services.db_connector import db_connector

class ChatService:
    def __init__(self):
        # Try Groq first (better free tier), then fall back to Google
        groq_key = os.getenv("GROQ_API_KEY")
        google_key = os.getenv("GOOGLE_API_KEY")
        
        # Try Groq first (better free tier), then fall back to Google dynamically
        groq_key = os.getenv("GROQ_API_KEY")
        google_key = os.getenv("GOOGLE_API_KEY")
        
        # DEBUG: Verify keys are loaded
        print(f"🔑 DEBUG: Loaded GROQ_KEY: {groq_key[:10] if groq_key else 'None'}...")
        print(f"🔑 DEBUG: Loaded GOOGLE_KEY: {google_key[:10] if google_key else 'None'}...")

        self.groq_client = None
        self.google_model = None
        self.provider = None

        if groq_key:
            try:
                from groq import Groq
                self.groq_client = Groq(api_key=groq_key)
                print("✅ ChatService: Groq API initialized (llama-3.3-70b-versatile)")
                if not self.provider: self.provider = "groq"
            except Exception as e:
                print(f"⚠️ Failed to initialize Groq: {e}")

        if google_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=google_key)
                self.google_model = genai.GenerativeModel('models/gemini-2.0-flash-lite')
                print("✅ ChatService: Google Gemini initialized (backup)")
                if not self.provider: self.provider = "google"
            except Exception as e:
                print(f"⚠️ Failed to initialize Google Gemini: {e}")
        
        if not self.groq_client and not self.google_model:
            print("⚠️ ChatService: No working API clients found")
            self.has_ai = False
        else:
            self.has_ai = True

    async def _execute_sql_from_response(self, response_text: str, connection_id: str) -> str:
        """Extract and execute SQL queries from AI response"""
        try:
            # Find SQL queries in markdown code blocks
            sql_pattern = r'```sql\n(.*?)\n```'
            sql_queries = re.findall(sql_pattern, response_text, re.DOTALL | re.IGNORECASE)
            
            if not sql_queries:
                return response_text  # No SQL to execute
            
            # Check if connection exists
            try:
                db_connector.get_connection(connection_id)
            except:
                return response_text + "\n\n⚠️ Could not execute query: Database connection not found."
            
            results = []
            for query in sql_queries:
                query = query.strip()
                # Only allow SELECT queries for safety
                if not query.upper().startswith('SELECT'):
                    results.append(f"⚠️ Skipped non-SELECT query for safety")
                    continue
                
                try:
                    # Use the async query method
                    result = await db_connector.query(connection_id, query)
                    
                    # Format as Markdown Table Programmatically
                    if result and isinstance(result, list) and len(result) > 0:
                        headers = list(result[0].keys())
                        
                        # Create header row
                        md_table = f"| {' | '.join(headers)} |\n"
                        md_table += f"| {' | '.join(['---'] * len(headers))} |\n"
                        
                        # Create data rows (limit to 10 for display logic)
                        for row in result[:10]:
                            row_values = [str(row.get(h, '')) for h in headers]
                            md_table += f"| {' | '.join(row_values)} |\n"
                            
                        result_text = f"\n**Query Results ({len(result)} rows):**\n\n{md_table}"
                        if len(result) > 10:
                            result_text += f"\n*(...and {len(result)-10} more rows)*"
                        
                        results.append(result_text)
                    else:
                        results.append(f"\n**Query Results:**\n```json\n{json.dumps(result, default=str, indent=2)}\n```")
                        
                except Exception as e:
                    results.append(f"\n⚠️ Query error: {str(e)}")
            
            # Append results to response
            if results:
                return response_text + "\n\n---\n" + "\n".join(results)
            return response_text
            
        except Exception as e:
            return response_text + f"\n\n⚠️ SQL execution error: {str(e)}"

    async def generate_response(self, message: str, connection_id: str, history: list = []) -> dict:
        if not self.has_ai:
            return {
                "response": "I'm sorry, but I can't help you right now because the AI service is not configured (missing API Key).",
                "related_nodes": []
            }

        # 1. Fetch Context (Schema & Analytics)
        schema_context = schema_analyzer.get_analysis_result(connection_id)
        
        if not schema_context:
            return {
                "response": "No database connection found! Please connect to a database first by clicking 'Load Connected System' in the sidebar.",
                "related_nodes": []
            }

        # 2. Build compact schema summary
        try:
            if hasattr(schema_context, 'model_dump'):
                schema_dict = schema_context.model_dump()
            elif hasattr(schema_context, 'dict'):
                schema_dict = schema_context.dict()
            else:
                schema_dict = schema_context
            
            # Extract table names and columns
            tables = schema_dict.get('tables', [])
            table_summary = []
            for table in tables:
                table_info = {
                    'name': table.get('name'),
                    'columns': [col.get('name') for col in table.get('columns', [])],
                    'row_count': table.get('row_count', 0)
                }
                table_summary.append(table_info)
            
            schema_str = json.dumps(table_summary, indent=2)
        except Exception as e:
            schema_str = "Schema details unavailable."

        # 3. Build system prompt for professional, direct responses
        system_prompt = f"""You are a PROFESSIONAL DATA ANALYST. Give DIRECT, CONFIDENT answers.

DATABASE SCHEMA:
{schema_str}

HOW TO ANSWER:

**For schema questions** (primary keys, columns, structure):
- Answer directly from the schema above
- Don't write SQL - just state the answer
- Example: "The primary key is `staff_id`."

**For data questions** (counts, values, analysis):
- ALWAYS write SQL to query the LIVE database
- Don't use row_count from schema (it may be outdated)
- Write ONE correct SQL query in ```sql blocks
- Don't explain or show multiple attempts
- I'll execute it and show results

MYSQL QUERY EXAMPLES:
- Total records in one table: `SELECT COUNT(*) FROM customer`
- Total across all tables: Write UNION ALL of all table counts
  ```sql
  SELECT 
    (SELECT COUNT(*) FROM actor) +
    (SELECT COUNT(*) FROM address) +
    (SELECT COUNT(*) FROM customer) AS total_records
  ```

RESPONSE STYLE:
✅ "The primary key of `staff` is `staff_id` (tinyint, NOT NULL)."
❌ "To determine the primary key, I will write a query... Let me try..."

RULES:
- Be DIRECT - no "Let me...", "I will...", "Assuming..."
- For schema: Just answer
- For data: Write SQL
- One query only - make it correct
- Professional and concise

Format SQL in ```sql blocks."""

        user_message = message

        # 4. Call AI to get initial response with SQL
        try:
            ai_response = None
            
            # Try Groq first if available
            if self.provider == "groq" or (self.groq_client and not self.provider):
                print(f"🚀 ATTEMPTING PROVIDER: GROQ (Model: llama-3.3-70b-versatile)")
                try:
                    ai_response = await self._call_groq(system_prompt, user_message, history)
                    self.provider = "groq" # Confirm provider
                    print(f"✅ GROQ SUCCESS")
                except Exception as e:
                    print(f"⚠️ Groq failed: {e}")
                    if "429" in str(e) or "rate limit" in str(e).lower():
                        print("🔄 Rate limit hit. Switching to Google Gemini fallback...")
                        if self.google_model:
                            print(f"🚀 ATTEMPTING PROVIDER: GOOGLE (Model: gemini-2.0-flash-lite)")
                            ai_response = await self._call_google(system_prompt, user_message, history)
                            self.provider = "google" # Switch provider
                            print(f"✅ GOOGLE SUCCESS")
                        else:
                            raise e # No fallback available
                    else:
                        raise e

            # If no response yet (e.g. was using Google or Groq failed caught above)
            if not ai_response and self.google_model:
                print(f"🚀 ATTEMPTING PROVIDER: GOOGLE (Primary/Fallback)")
                ai_response = await self._call_google(system_prompt, user_message, history)
                self.provider = "google" 
                print(f"✅ GOOGLE SUCCESS") 

            if not ai_response:
                return {"response": "System Error: No AI provider available.", "related_nodes": []}
            
            # 5. Execute any SQL queries in the response
            response_with_results = await self._execute_sql_from_response(ai_response['response'], connection_id)
            
            # 6. If we executed SQL and got results, send back to AI for interpretation
            # 6. If we executed SQL and got results, send back to AI for interpretation
            # extract the part that contains the markdown table (start with \n**Query ...)
            if "**Query Results" in response_with_results:
                parts = response_with_results.split("\n**Query Results", 1)
                sql_part = parts[0]
                results_part = "**Query Results" + parts[1] if len(parts) > 1 else ""

                interpretation_prompt = f"""The SQL query was executed successfully. Here are the results:

{results_part}

Your task: Interpret these results for the user. Return ONLY a concise summary text.
- summarize the finding (e.g., "There are 10 cities listed.")
- DO NOT repeat the table or data list.
- I will append the data table myself.
- BE CONCISE.
"""

                # Call AI for summary (using current successful provider)
                if self.provider == "groq":
                     try:
                        ai_summary = await self._call_groq("You are a data analyst. Summarize results concisely.", interpretation_prompt, [])
                     except Exception:
                        # If summary fails on Groq, try Google
                        if self.google_model:
                             ai_summary = await self._call_google("You are a data analyst. Summarize results concisely.", interpretation_prompt, [])
                        else:
                            ai_summary = {'response': "Here are the results:"}
                else:
                    ai_summary = await self._call_google("You are a data analyst. Summarize results concisely.", interpretation_prompt, [])
                
                # Combine AI summary with the ORIGINAL formatted table
                final_response = ai_summary['response'] + "\n\n" + results_part
                
                return {
                    "response": final_response,
                    "related_nodes": []
                }
            
            return {
                "response": response_with_results,
                "related_nodes": []
            }
        except Exception as e:
            print(f"❌ Chat Error: {e}")
            import traceback
            traceback.print_exc()
            return {
                "response": f"I encountered an error: {str(e)}",
                "related_nodes": []
            }

    async def _call_groq(self, system_prompt: str, user_message: str, history: list) -> dict:
        import asyncio
        
        messages = [{"role": "system", "content": system_prompt}]
        
        # Add history
        for msg in history:
            role = "user" if msg.get('role') == 'user' else "assistant"
            messages.append({"role": role, "content": msg.get('content', '')})
        
        # Add current message
        messages.append({"role": "user", "content": user_message})
        
        # Call Groq
        response = await asyncio.to_thread(
            self.groq_client.chat.completions.create,
            model="llama-3.3-70b-versatile",
            messages=messages,
            temperature=0.7,
            max_tokens=1024
        )
        
        return {
            "response": response.choices[0].message.content,
            "related_nodes": []
        }

    async def _call_google(self, system_prompt: str, user_message: str, history: list) -> dict:
        import asyncio
        import google.generativeai as genai
        
        formatted_history = []
        for msg in history:
            role = "user" if msg['role'] == 'user' else "model"
            formatted_history.append({"role": role, "parts": [msg['content']]})
        
        try:
            chat = self.google_model.start_chat(history=formatted_history)
        except:
            chat = self.google_model.start_chat(history=[])
        
        full_message = f"{system_prompt}\n\nUser Question: {user_message}"
        
        # Persistent Retry logic for Google API rate limits
        max_retries = 2  # Reduce to 2 retries to fail faster
        
        for attempt in range(max_retries):
            try:
                response = await asyncio.to_thread(chat.send_message, full_message)
                return {
                    "response": response.text,
                    "related_nodes": []
                }
            except Exception as e:
                error_str = str(e).lower()
                if "429" in error_str or "quota" in error_str:
                    
                     # Try to find specific wait time in error message
                    wait_time = 10 # Reduced default
                    import re
                    match = re.search(r'retry in (\d+\.?\d*)', error_str)
                    if match:
                        suggested_wait = float(match.group(1))
                        wait_time = min(suggested_wait + 2, 15) # Cap at 15 seconds
                    
                    if attempt < max_retries - 1:
                        print(f"⏳ Google Quota Hit. Waiting {wait_time:.1f}s before retry {attempt+1}/{max_retries}...")
                        await asyncio.sleep(wait_time)
                        continue
                        
                raise e # Re-raise if not rate limit or out of retries

    def _build_system_prompt(self, schema: any) -> str:
        # Format schema for the prompt
        schema_str = "DATABASE SCHEMA:\n"
        
        if isinstance(schema, dict) and 'tables' in schema:
            for table_name, table_info in schema['tables'].items():
                schema_str += f"\nTABLE: {table_name}\n"
                if 'columns' in table_info:
                     columns = [f"{col['name']} ({col['type']})" for col in table_info['columns']]
                     schema_str += f"COLUMNS: {', '.join(columns)}\n"
        else:
            schema_str += json.dumps(schema, indent=2)

        return f"""You are a High-Performance SQL Data Analyst.
        
Your GOAL: Answer user questions by querying the LIVE database.

{schema_str}

RULES:
1. **Always Check Data**: Use SQL queries to find the real answer. Do not guess.
2. **Write Executable SQL**: Output a valid MySQL `SELECT` query in a ```sql``` block.
3. **No Explain**: Do not explain your plan. Just write the SQL.
4. **Direct Answers**: For schema questions, answer directly. for data, write SQL.

EXAMPLE:
User: "How many cities?"
You:
```sql
SELECT COUNT(*) FROM city;
```
"""

chat_service = ChatService()
