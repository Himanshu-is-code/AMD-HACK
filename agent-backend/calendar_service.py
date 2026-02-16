from datetime import datetime, timedelta
from googleapiclient.discovery import build
import auth_service
import logging

def create_event(summary: str, start_time_iso: str, duration_minutes: int = 30):
    """Creates a calendar event with specific details."""
    creds = auth_service.get_credentials()
    if not creds:
        return {"error": "Not authenticated"}

    try:
        service = build('calendar', 'v3', credentials=creds)

        # Parse ISO string (handle offset if present)
        # datetime.fromisoformat handles offsets in Python 3.7+
        start_dt = datetime.fromisoformat(start_time_iso.replace("Z", "+00:00"))
        end_dt = start_dt + timedelta(minutes=duration_minutes)

        event = {
            'summary': summary,
            'description': 'Created by Agent.',
            'start': {
                'dateTime': start_dt.isoformat(), 
                # 'timeZone': 'UTC', <--- REMOVED to let Google infer from offset or user's calendar setting
            },
            'end': {
                'dateTime': end_dt.isoformat(),
                # 'timeZone': 'UTC',
            },
        }

        created_event = service.events().insert(calendarId='primary', body=event).execute()
        return {"status": "success", "link": created_event.get('htmlLink')}

    except Exception as e:
        error_details = str(e)
        if hasattr(e, 'content'):
            try:
                error_details = e.content.decode('utf-8')
            except:
                pass
        logging.error(f"Calendar Error: {error_details}")
        return {"error": error_details}

def create_test_event():
    """Creates a hardcoded test event: 'Agent Test Event' in 10 minutes."""
    start_time = datetime.utcnow() + timedelta(minutes=10)
    return create_event("Agent Test Event", start_time.isoformat())
