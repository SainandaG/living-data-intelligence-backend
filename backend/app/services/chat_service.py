"""
Chat Service

Provides LLM-powered conversational analysis over connected databases, executing SQL from AI responses.
"""
import os
import json
import re
import logging
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Load environment variables FIRST
load_dotenv()

from app.services.schema_analyzer import schema_analyzer
from app.services.db_connector import db_connector

class ChatService:
    def __init__(self):
        groq_key = os.getenv("GROQ_API_KEY")
        google_key = os.getenv("GOOGLE_API_KEY")

        if groq_key:
            logger.debug("GROQ_API_KEY detected")
        if google_key:
            logger.debug("GOOGLE_API_KEY detected")

        self.groq_client = None
        self.google_model = None
        self.provider = None

        if groq_key:
            try:
                from groq import Groq
                self.groq_client = Groq(api_key=groq_key)
                logger.info("ChatService: Groq API initialized (llama-3.3-70b-versatile)")
                if not self.provider: self.provider = "groq"
            except Exception as e:
                logger.warning(f"Failed to initialize Groq: {e}")

        if google_key:
            try:
                from google import genai
                self.google_client = genai.Client(api_key=google_key)
                self.google_model_id = 'gemini-2.0-flash-lite'
                logger.info(f"ChatService: Google Gemini initialized (backup: {self.google_model_id})")
                if not self.provider: self.provider = "google"
            except Exception as e:
                logger.warning(f"Failed to initialize Google Gemini: {e}")
        
        if not self.groq_client and not getattr(self, 'google_client', None):
            logger.warning("ChatService: No working API clients found")
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
            except Exception as e:
                logger.warning(f"DB connection check failed: {e}")
                return response_text + "\n\n Could not execute query: Database connection not found."
            
            results = []
            for query in sql_queries:
                query = query.strip()
                # Only allow SELECT queries for safety
                if not query.upper().startswith('SELECT'):
                    results.append(" Skipped non-SELECT query for safety")
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
                    logger.debug(f"Schema serialization failed: {e}")
                    results.append(f"\n Query error: {str(e)}")
            
            # Append results to response
            if results:
                return response_text + "\n\n---\n" + "\n".join(results)
            return response_text
            
        except Exception as e:
            logger.debug(f"Schema serialization failed: {e}")
            return response_text + f"\n\n SQL execution error: {str(e)}"


    def _build_schema_str(self, schema_context) -> str:
        """Serialize schema context to a compact JSON string for LLM prompts."""
        try:
            if hasattr(schema_context, 'model_dump'):
                schema_dict = schema_context.model_dump()
            elif hasattr(schema_context, 'dict'):
                schema_dict = schema_context.dict()
            else:
                schema_dict = schema_context
            tables = schema_dict.get('tables', [])
            table_summary = [
                {'name': t.get('name'), 'columns': [c.get('name') for c in t.get('columns', [])], 'row_count': t.get('row_count', 0)}
                for t in tables
            ]
            return json.dumps(table_summary, indent=2)
        except Exception as e:
            logger.debug(f"[chat_service] Suppressed: {e}")
            return "Schema details unavailable."

    def _build_system_prompt(self, schema_str: str) -> str:
        """Build the analyst system prompt with the schema embedded."""
        return f"""You are a PROFESSIONAL DATA ANALYST. Give DIRECT, CONFIDENT answers.

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
 "The primary key of `staff` is `staff_id` (tinyint, NOT NULL)."
 "To determine the primary key, I will write a query... Let me try..."

RULES:
- Be DIRECT - no "Let me...", "I will...", "Assuming..."
- For schema: Just answer
- For data: Write SQL
- One query only - make it correct
- Professional and concise

Format SQL in ```sql blocks."""

    async def _call_ai_providers(self, system_prompt: str, user_message: str, history: list) -> tuple:
        """Run all configured AI providers in parallel, return (source, response) for first success."""
        import asyncio
        tasks = []
        if self.groq_client:
            tasks.append(self._call_groq(system_prompt, user_message, history))
        if hasattr(self, 'google_client'):
            tasks.append(self._call_google(system_prompt, user_message, history))
        if not tasks:
            return None, None
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for i, res in enumerate(results):
            if isinstance(res, dict) and "response" in res:
                source = "groq" if i == 0 and self.groq_client else "google"
                return source, res
            else:
                logger.warning(f"AI Provider Task failed: {res}")
        return None, None

    async def _interpret_sql_results(self, response_with_results: str) -> str:
        """If the response contains query results, send them back to AI for a concise summary."""
        if "**Query Results" not in response_with_results:
            return response_with_results
        parts = response_with_results.split("\n**Query Results", 1)
        results_part = "**Query Results" + parts[1] if len(parts) > 1 else ""
        interpretation_prompt = f"""The SQL query was executed successfully. Here are the results:

{results_part}

Your task: Interpret these results for the user. Return ONLY a concise summary text.
- summarize the finding (e.g., "There are 10 cities listed.")
- DO NOT repeat the table or data list.
- I will append the data table myself.
- BE CONCISE.
"""
        try:
            if self.provider == "groq":
                try:
                    ai_summary = await self._call_groq("You are a data analyst. Summarize results concisely.", interpretation_prompt, [])
                except Exception as e:
                    logger.debug(f"[chat_service] Suppressed: {e}")
                    if hasattr(self, 'google_client'):
                        ai_summary = await self._call_google("You are a data analyst. Summarize results concisely.", interpretation_prompt, [])
                    else:
                        ai_summary = {'response': "Here are the results:"}
            else:
                ai_summary = await self._call_google("You are a data analyst. Summarize results concisely.", interpretation_prompt, [])
            return ai_summary['response'] + "\n\n" + results_part
        except Exception as e:
            logger.warning(f"SQL result interpretation failed: {e}")
            return response_with_results

    async def generate_response(self, message: str, connection_id: str, history: list = []) -> dict:
        """Generate an AI-powered response, executing any SQL queries found in the reply."""
        if not self.has_ai:
            return {"response": "I'm sorry, but I can't help you right now because the AI service is not configured (missing API Key).", "related_nodes": []}

        schema_context = schema_analyzer.get_analysis_result(connection_id)
        if not schema_context:
            return {"response": "No database connection found! Please connect to a database first by clicking 'Load Connected System' in the sidebar.", "related_nodes": []}

        schema_str = self._build_schema_str(schema_context)
        system_prompt = self._build_system_prompt(schema_str)

        try:
            source, ai_response = await self._call_ai_providers(system_prompt, message, history)
            if not ai_response:
                return {"response": "System Error: All AI providers failed.", "related_nodes": []}

            self.provider = source
            logger.info(f"Using AI response from provider: {source}")

            response_with_results = await self._execute_sql_from_response(ai_response['response'], connection_id)
            final_response = await self._interpret_sql_results(response_with_results)

            return {"response": final_response, "related_nodes": []}

        except Exception as e:
            logger.error(f"Chat service error: {e}", exc_info=True)
            return {"response": "I encountered an error processing your request.", "related_nodes": []}

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
        
        # Format history for new SDK
        contents = []
        for msg in history:
            role = "user" if msg['role'] == 'user' else "model"
            contents.append({"role": role, "parts": [{"text": msg['content']}]})
        
        # Add current message (System prompt as prefix for simplicity in this SDK version)
        full_message = f"{system_prompt}\n\nUser Question: {user_message}"
        contents.append({"role": "user", "parts": [{"text": full_message}]})
        
        # Persistent Retry logic for Google API rate limits
        max_retries = 2
        
        for attempt in range(max_retries):
            try:
                response = await asyncio.to_thread(
                    self.google_client.models.generate_content,
                    model=self.google_model_id,
                    contents=contents
                )
                return {
                    "response": response.text,
                    "related_nodes": []
                }
            except Exception as e:
                logger.debug(f"[chat_service] AI provider error (checking rate limit): {e}")
                error_str = str(e).lower()
                if "429" in error_str or "quota" in error_str:
                    wait_time = 10
                    import re
                    match = re.search(r'retry in (\d+\.?\d*)', error_str)
                    if match:
                        suggested_wait = float(match.group(1))
                        wait_time = min(suggested_wait + 2, 15)
                    
                    if attempt < max_retries - 1:
                        logger.warning(f"Google Quota Hit. Waiting {wait_time:.1f}s before retry {attempt+1}/{max_retries}...")
                        await asyncio.sleep(wait_time)
                        continue
                        
                raise e


chat_service = ChatService()
