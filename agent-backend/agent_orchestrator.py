import logging
import json
import os
from typing import List, Optional, Callable
import calendar_service
import gmail_service
import meet_service
import classroom_service

class AgentCard:
    """Represents a specialized agent capability (ADK pattern)."""
    def __init__(self, name: str, description: str, triggers: List[str], execute_func: Callable, intent_id: str = None):
        self.name = name
        self.description = description
        self.triggers = triggers
        self.execute_func = execute_func
        self.intent_id = intent_id

class AgentOrchestrator:
    """Orchestrates multiple agents/tools based on user requests."""
    
    def __init__(self, llm_caller: Callable):
        self.llm_caller = llm_caller
        self.agents = []
        self._register_default_agents()

    def _register_default_agents(self):
        # Calendar Agent Card
        self.agents.append(AgentCard(
            name="Calendar Agent",
            description="Manages events, meetings, and appointments.",
            triggers=["calendar", "calender", "meeting", "appointment", "event", "remind", "mark"],
            execute_func=self._execute_calendar,
            intent_id="calendar"
        ))
        
        # Gmail Agent Card
        self.agents.append(AgentCard(
            name="Gmail Agent",
            description="Summarizes emails and searches for specific information in the inbox.",
            triggers=["email", "gmail", "inbox", "unread", "from", "about", "summarize"],
            execute_func=self._execute_gmail,
            intent_id="email"
        ))

        # Meet Agent Card
        self.agents.append(AgentCard(
            name="Meet Agent",
            description="Creates and manages Google Meet video conferences, and retrieves participants and transcripts.",
            triggers=["meet", "meeting link", "video call", "conference", "join meeting",
                      "create meet", "participants", "transcript", "google meet"],
            execute_func=self._execute_meet,
            intent_id="meet"
        ))

        # Classroom Agent Card
        self.agents.append(AgentCard(
            name="Classroom Agent",
            description="Retrieves Google Classroom courses, assignments, and announcements.",
            triggers=["classroom", "course", "courses", "assignment", "assignments", "homework", "announcement", "announcements", "grades", "class", "classes"],
            execute_func=self._execute_classroom,
            intent_id="classroom"
        ))

    @staticmethod
    def _matches_triggers(text: str, triggers: list) -> bool:
        """Word-boundary aware trigger matching so 'meet' doesn't fire on 'meeting'."""
        import re
        for trigger in triggers:
            pattern = r'\b' + re.escape(trigger) + r'\b'
            if re.search(pattern, text, re.IGNORECASE):
                return True
        return False

    def plan_and_execute(self, task_id: str, task_text: str, context: dict) -> str:
        """Decomposes task and routes to appropriate agents."""
        results = []
        
        # Simple routing based on triggers (can be enhanced with LLM routing)
        dismissed_intents = context.get("dismissed_intents", [])
        logging.info(f"Task {task_id}: dismissed_intents={dismissed_intents}")
        for agent in self.agents:
            if agent.intent_id and agent.intent_id in dismissed_intents:
                logging.info(f"Skipping {agent.name} — dismissed by user.")
                continue

            if self._matches_triggers(task_text, agent.triggers):
                logging.info(f"Routing task {task_id} to {agent.name}")
                result = agent.execute_func(task_id, task_text, context)
                if result:
                    results.append(result)
        
        if not results:
            return "\n\nℹ️ This request doesn't seem to trigger any specialized tools. I've noted it down."
            
        return "".join(results)

    def _execute_calendar(self, task_id: str, task_text: str, context: dict) -> Optional[str]:
        # Logic extracted from main.py's execute_task_logic
        # Note: In a full ADK implementation, this might call another service or LLM chain
        from main import extract_event_details, check_internet
        
        if not check_internet():
            return None # Re-queuing handled by main.py monitor
            
        details = extract_event_details(task_text, 
                                        client_time_str=context.get("client_time"), 
                                        extracted_time_override=context.get("extracted_time"))
        
        if details:
            cal_result = calendar_service.create_event(
                summary=details.get("summary", "New Event"),
                start_time_iso=details.get("start_time"),
                duration_minutes=details.get("duration_minutes", 30)
            )
            if "link" in cal_result:
                return f"\n\n✅ Event Created: **{details.get('summary')}**\n[View on Google Calendar]({cal_result['link']})"
            return f"\n\n❌ Event Creation Failed: {cal_result.get('error')}"
        return "\n\n❌ Could not understand event details."

    def _execute_gmail(self, task_id: str, task_text: str, context: dict) -> Optional[str]:
        # Logic extracted from main.py's execute_task_logic
        from main import call_llm, SMART_MODEL, FAST_MODEL, check_internet, clean_email_body
        
        if not check_internet():
            return None
            
        # Decision: SPECIFIC vs GENERAL
        decision_prompt = f"""
        [INST]
        Classify this user request: "{task_text}"
        
        Is the user asking for:
        1. SPECIFIC: Finding a particular email about a topic, person, or keyword.
        2. GENERAL: A broad summary of recent/unread emails (inbox summary).
        
        Answer with ONLY the word 'SPECIFIC' or 'GENERAL'.
        [/INST]
        """
        decision = call_llm(decision_prompt, model=FAST_MODEL).strip().upper()
        logging.info(f"Gmail classification: {decision}")
        
        result_update = ""
        if "SPECIFIC" in decision:
            search_prompt = f"""
            [INST]
            Task: Generate a simple Gmail search query for: "{task_text}"
            
            Rules:
            1. Response must be ONLY the query string.
            2. Use simple keywords.
            3. Use operators like 'from:', 'subject:', or 'after:' ONLY if certain.
            4. DO NOT use 'site:', 'is:search', or 'inbody:'.
            5. If searching for a topic, just return the topic keywords.
            
            Examples:
            - "emails from Bob" -> from:Bob
            - "meeting about project X" -> project X meeting
            - "is there any email regarding amd slingshot" -> amd slingshot
            
            Query:
            [/INST]
            """
            search_query = call_llm(search_prompt, model=FAST_MODEL).strip().replace('"', '').split('\n')[-1]
            logging.info(f"Generated search query: {search_query}")
            
            emails = gmail_service.search_emails(search_query, limit=3)
            if emails:
                email_id = emails[0]['id']
                content = gmail_service.get_email_content(email_id)
                if content:
                    cleaned_body = clean_email_body(content['body'])
                    read_prompt = f"Summarize this email for the user's request: '{task_text}'\n\nSubject: {content['subject']}\nBody: {cleaned_body[:2000]}"
                    email_summary = call_llm(read_prompt, model=SMART_MODEL)
                    email_link = f"https://mail.google.com/mail/u/0/#inbox/{email_id}"
                    result_update = f"\n\n📧 **Email Found**\n**Subject:** {content['subject']}\n\n{email_summary}\n\n[Open in Gmail]({email_link})"
            else:
                result_update = f"\n\n🔍 No emails found for: `{search_query}`"
        
        if "GENERAL" in decision or not result_update:
            emails = gmail_service.fetch_recent_unread_emails(limit=5)
            if emails:
                email_text = "\n".join([f"- From: {e['sender']} Subject: {e['subject']}" for e in emails])
                summary_prompt = f"Summarize these unread emails briefly:\n{email_text}"
                inbox_summary = call_llm(summary_prompt, model=SMART_MODEL)
                result_update += f"\n\n📧 **Inbox Summary**\n{inbox_summary}"
            else:
                result_update += "\n\n✅ No new emails."
                
        return result_update

    def _execute_meet(self, task_id: str, task_text: str, context: dict) -> Optional[str]:
        """Routes Meet-related tasks to the appropriate meet_service function."""
        from main import call_llm, FAST_MODEL, check_internet

        if not check_internet():
            return None

        # --- Fast keyword pre-check (avoids LLM safety filter misclassifying meeting codes) ---
        lowered = task_text.lower()
        if any(k in lowered for k in ["participant", "who joined", "who was in", "who attended", "attendee", "how many people"]):
            intent = "PARTICIPANTS"
        elif any(k in lowered for k in ["transcript", "what was said", "what did they say", "conversation"]):
            intent = "TRANSCRIPT"
        elif any(k in lowered for k in ["create", "start a meet", "new meet", "make a meet", "generate meet"]):
            intent = "CREATE"
        else:
            # Fallback to LLM classification for ambiguous requests
            intent_prompt = f"""
[INST]
Classify this request: "{task_text}"

Choose ONE:
1. CREATE  - User wants to create/start a new Google Meet
2. GET     - User wants to look up a specific meeting space by name/code
3. PARTICIPANTS - User wants to see who was in a meeting
4. TRANSCRIPT   - User wants the transcript or conversation from a meeting

Answer with ONLY one word: CREATE, GET, PARTICIPANTS, or TRANSCRIPT.
[/INST]
"""
            intent = call_llm(intent_prompt, model=FAST_MODEL).strip().upper()

        logging.info(f"Meet intent classified as: {intent}")

        # --- CREATE ---
        if "CREATE" in intent:
            result = meet_service.create_meeting_space()
            if "error" in result:
                return f"\n\n❌ Could not create meeting: {result['error']}"
            return (
                f"\n\n📹 **Google Meet Created!**\n"
                f"**Meeting Code:** `{result.get('meetingCode')}`\n"
                f"**Join Link:** [{result.get('meetingUri')}]({result.get('meetingUri')})"
            )

        # --- GET ---
        if "GET" in intent:
            # Try to extract a space name / code from the text
            extract_prompt = f"""
[INST]
Extract the Google Meet space resource name or meeting code from: "{task_text}"
Return ONLY the resource name (e.g. 'spaces/abc-xyz') or code. Nothing else.
[/INST]
"""
            space_name = call_llm(extract_prompt, model=FAST_MODEL).strip().strip('"').strip("'")
            # Ensure it starts with 'spaces/' if it looks like just a code
            if space_name and not space_name.startswith("spaces/"):
                space_name = f"spaces/{space_name}"
            result = meet_service.get_meeting_space(space_name)
            if "error" in result:
                return f"\n\n❌ Could not retrieve meeting: {result['error']}"
            return (
                f"\n\n📹 **Meeting Space: `{result.get('meetingCode')}`**\n"
                f"**Link:** [{result.get('meetingUri')}]({result.get('meetingUri')})\n"
                f"**Resource Name:** `{result.get('name')}`"
            )

        # --- PARTICIPANTS ---
        if "PARTICIPANT" in intent:
            extract_prompt = f"""
[INST]
Extract the conference record ID or Google Meet meeting code from: "{task_text}"
Return ONLY the raw value. Examples:
- If text says 'conferenceRecords/abc123' → return 'conferenceRecords/abc123'
- If text says meeting code 'ake-qiws-zsx' → return 'ake-qiws-zsx'
- If text says 'spaces/abc' → return 'spaces/abc'
Nothing else.
[/INST]
"""
            raw = call_llm(extract_prompt, model=FAST_MODEL).strip().strip('"').strip("'").lstrip("/")
            conf_name = self._resolve_conference_record(raw)
            if conf_name is None:
                return f"\n\n❌ Could not find a completed meeting for `{raw}`. Make sure the meeting has ended."
            result = meet_service.list_participants(conf_name)
            if "error" in result:
                return f"\n\n❌ Could not list participants: {result['error']}"
            participants = result.get("participants", [])
            if not participants:
                return f"\n\n👥 No participants found for `{conf_name}`."
            lines = []
            for p in participants:
                name = (p.get("signedinUser") or {}).get("displayName") \
                    or (p.get("anonymousUser") or {}).get("displayName", "Unknown")
                lines.append(f"- {name}")
            return f"\n\n👥 **Participants ({len(participants)})**\n" + "\n".join(lines)

        # --- TRANSCRIPT ---
        if "TRANSCRIPT" in intent:
            extract_prompt = f"""
[INST]
Extract the conference record ID or Google Meet meeting code from: "{task_text}"
Return ONLY the raw value. Examples:
- If text says 'conferenceRecords/abc123' → return 'conferenceRecords/abc123'
- If text says meeting code 'ake-qiws-zsx' → return 'ake-qiws-zsx'
- If text says 'spaces/abc' → return 'spaces/abc'
Nothing else.
[/INST]
"""
            raw = call_llm(extract_prompt, model=FAST_MODEL).strip().strip('"').strip("'").lstrip("/")
            conf_name = self._resolve_conference_record(raw)
            if conf_name is None:
                return (
                    f"\n\n📄 No completed meetings found for `{raw}`.\n"
                    "_Make sure: 1) The meeting has ended. 2) Transcription was enabled during the meeting._"
                )
            result = meet_service.get_transcripts(conf_name)
            if "error" in result:
                return f"\n\n❌ Could not retrieve transcripts: {result['error']}"
            transcripts = result.get("transcripts", [])
            if not transcripts:
                return (
                    f"\n\n📄 No transcripts in `{conf_name}`.\n"
                    "_Transcription must be enabled by the host (Activities → Transcripts → Start) before the meeting ends._"
                )
            first_transcript = transcripts[0].get("name", "")
            entries_result = meet_service.get_transcript_entries(first_transcript)
            entries = entries_result.get("entries", [])
            if not entries:
                return f"\n\n📄 Transcript found but has no entries yet (may still be processing)."
            lines = []
            for e in entries[:20]:
                speaker = (e.get("participant") or {}).get("signedinUser", {}).get("displayName", "Unknown")
                lines.append(f"**{speaker}**: {e.get('text', '')}")
            return f"\n\n📄 **Transcript Entries** (first {len(lines)})\n" + "\n".join(lines)

        return "\n\n❓ I understood this is about Google Meet but couldn't determine what action to take. Try saying 'create a google meet' or 'show participants for ake-qiws-zsx'."

    def _resolve_conference_record(self, raw: str) -> Optional[str]:
        """
        Resolves a raw string to a valid conferenceRecords/... name.
        Handles:
          - Already valid: 'conferenceRecords/abc'
          - Meeting code:  'ake-qiws-zsx'  → looks up space → finds latest conference record
          - Space name:    'spaces/abc'     → finds latest conference record
        Returns None if no conference record found.
        """
        raw = raw.lstrip("/").strip()

        # Already a conference record name — but verify the ID isn't actually a meeting code.
        # Meeting codes look like: xxx-xxxx-xxx (3 groups separated by dashes)
        # Real conference IDs are long opaque strings (no dashes or only one segment).
        import re
        if raw.startswith("conferenceRecords/"):
            record_id = raw[len("conferenceRecords/"):]
            # If it looks like a Meet code (e.g. ake-qiws-zsx), treat as meeting code instead
            if re.match(r'^[a-z]{3}-[a-z]{4}-[a-z]{3}$', record_id):
                raw = record_id  # Fall through to meeting-code resolution below
            else:
                return raw

        # Resolve space name from meeting code or spaces/... string
        if raw.startswith("spaces/"):
            space_name = raw
        else:
            # Treat as meeting code — build space name and look it up
            space_name = f"spaces/{raw}"
            space_result = meet_service.get_meeting_space(space_name)
            if "error" in space_result:
                logging.warning(f"Could not resolve space for code '{raw}': {space_result['error']}")
                return None
            space_name = space_result.get("name", space_name)

        # Find most recent conference record for this space
        records_result = meet_service.list_conference_records(space_name)
        records = records_result.get("conferenceRecords", [])
        if not records:
            logging.info(f"No conference records found for space '{space_name}'")
            return None

        # Return the first (most recent) record
        return records[0]["name"]

    def _execute_classroom(self, task_id: str, task_text: str, context: dict) -> Optional[str]:
        from main import call_llm, FAST_MODEL, check_internet

        if not check_internet():
            return None

        # Intent classification
        intent_prompt = f"""
        [INST]
        Classify this request: "{task_text}"
        Choose ONE:
        1. COURSES - User wants to see their enrolled classes/courses.
        2. ASSIGNMENTS - User wants to see their coursework/homework/assignments.
        3. ANNOUNCEMENTS - User wants to see announcements/posts for a class.
        
        Answer with ONLY one word: COURSES, ASSIGNMENTS, or ANNOUNCEMENTS.
        [/INST]
        """
        intent = call_llm(intent_prompt, model=FAST_MODEL).strip().upper()
        logging.info(f"Classroom intent classified as: {intent}")

        # COURSES
        if "COURSE" in intent:
            result = classroom_service.list_courses()
            if "error" in result:
                return f"\n\n❌ Could not retrieve courses: {result['error']}"
            courses = result.get("courses", [])
            if not courses:
                return "\n\n🏫 You are not enrolled in any active Google Classroom courses."
            lines = [f"🏫 **Your Google Classroom Courses:**"]
            for c in courses:
                lines.append(f"- **{c.get('name')}** (Section: {c.get('section', 'N/A')}) - [Link]({c.get('alternateLink')})")
            return "\n".join(lines)

        # Helper to find a specific course if they asked for assignments or announcements
        extract_course_prompt = f"""
        [INST]
        Extract the course or class name from: "{task_text}"
        Return ONLY the name of the class (e.g. 'Math', 'History', 'Physics').
        If none mentioned, return NONE.
        [/INST]
        """
        course_name_query = call_llm(extract_course_prompt, model=FAST_MODEL).strip().strip('"').strip("'")
        
        # Need to fetch courses to resolve ID
        courses_res = classroom_service.list_courses()
        if "error" in courses_res:
             return f"\n\n❌ Error fetching courses: {courses_res['error']}"
        courses = courses_res.get("courses", [])
        
        target_course = None
        
        # 1. Exact direct match from query text (best for complex course names)
        task_text_lower = task_text.lower()
        for c in courses:
            c_name_lower = c.get("name", "").lower()
            if c_name_lower and c_name_lower in task_text_lower:
                target_course = c
                break
                
        # 2. Fallback to LLM extracted matching
        if not target_course and course_name_query.upper() != "NONE":
             course_query_lower = course_name_query.lower()
             for c in courses:
                 c_name_lower = c.get("name", "").lower()
                 if course_query_lower in c_name_lower or c_name_lower in course_query_lower:
                     target_course = c
                     break
        
        if not target_course and courses:
            if len(courses) == 1:
                target_course = courses[0]
            else:
                return "\n\n❓ Please specify which course you'd like to check (e.g., 'assignments for Math')."
        elif not courses:
            return "\n\n🏫 You are not enrolled in any active Google Classroom courses."

        course_id = target_course["id"]
        course_name = target_course["name"]

        # ASSIGNMENTS
        if "ASSIGNMENT" in intent:
            result = classroom_service.list_coursework(course_id)
            if "error" in result:
                return f"\n\n❌ Could not retrieve assignments: {result['error']}"
            work = result.get("courseWork", [])
            if not work:
                return f"\n\n✅ No assignments found for **{course_name}**."
            lines = [f"📚 **Assignments for {course_name}:**"]
            for w in work[:5]:
                due_date_str = "No due date"
                if "dueDate" in w:
                    d = w["dueDate"]
                    due_date_str = f"Due: {d.get('year')}-{d.get('month'):02d}-{d.get('day'):02d}"
                lines.append(f"- **{w.get('title')}** ({due_date_str}) - [View]({w.get('alternateLink')})")
            return "\n".join(lines)

        # ANNOUNCEMENTS
        if "ANNOUNCEMENT" in intent:
            result = classroom_service.list_announcements(course_id)
            if "error" in result:
                return f"\n\n❌ Could not retrieve announcements: {result['error']}"
            ann = result.get("announcements", [])
            if not ann:
                return f"\n\n📣 No announcements found for **{course_name}**."
            lines = [f"📣 **Announcements for {course_name}:**"]
            for a in ann[:5]:
                text = a.get("text", "").replace('\\n', ' ')[:100] + "..."
                lines.append(f"- {text} - [View]({a.get('alternateLink')})")
            return "\n".join(lines)

        return "\n\n❓ I understand this is about Google Classroom but I wasn't sure what you needed. Try asking 'what are my courses' or 'assignments for math'."
