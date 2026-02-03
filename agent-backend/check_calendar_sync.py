import os
import datetime
import json
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

TOKEN_FILE = 'token.json'

def check_calendar():
    print("--- Calendar Sync Diagnostic ---")
    
    # 1. Check Credentials
    if not os.path.exists(TOKEN_FILE):
        print("Error: 'token.json' not found. You are not logged in.")
        return

    try:
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, ['https://www.googleapis.com/auth/calendar'])
        print("Credentials found.")
    except Exception as e:
        print(f"Error loading credentials: {e}")
        return

    # 2. Connect to API
    try:
        service = build('calendar', 'v3', credentials=creds)
        print("Connected to Google Calendar API.")
    except Exception as e:
        print(f"Error connecting to API: {e}")
        return

    # 3. Create Test Event
    now = datetime.datetime.now().astimezone()
    start_time = now + datetime.timedelta(minutes=10)
    end_time = start_time + datetime.timedelta(minutes=30)
    
    event = {
        'summary': f'Agent Diagnostic Test {now.strftime("%H:%M")}',
        'description': 'If you see this, the API connection is working.',
        'start': {
            'dateTime': start_time.isoformat(),
        },
        'end': {
            'dateTime': end_time.isoformat(),
        },
    }

    print(f"Attempting to create event: '{event['summary']}'...")
    try:
        event_result = service.events().insert(calendarId='primary', body=event).execute()
        print("\nSUCCESS! Event created.")
        print(f"Link: {event_result.get('htmlLink')}")
        print("Check your Google Calendar now.")
    except Exception as e:
        print(f"\nFAILED to create event: {e}")

if __name__ == "__main__":
    check_calendar()
