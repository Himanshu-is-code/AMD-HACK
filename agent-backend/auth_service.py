import os
import json
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request

# Constants
CLIENT_SECRETS_FILE = "client_secret.json"
TOKEN_FILE = "token.json"
SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/gmail.readonly",
    # Google Meet — create/manage spaces you own
    "https://www.googleapis.com/auth/meetings.space.created",
    # Google Meet — read-only access for participants & transcripts
    "https://www.googleapis.com/auth/meetings.space.readonly",
    # Google Classroom
    "https://www.googleapis.com/auth/classroom.courses.readonly",
    "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
    "https://www.googleapis.com/auth/classroom.announcements.readonly",
]
REDIRECT_URI = "http://localhost:5173" # Must match frontend URL

def get_flow():
    """Initializes the OAuth flow from client secrets."""
    if not os.path.exists(CLIENT_SECRETS_FILE):
        raise FileNotFoundError(f"Missing {CLIENT_SECRETS_FILE}")
        
    flow = Flow.from_client_secrets_file(
        CLIENT_SECRETS_FILE,
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI
    )
    print(f"Auth Service: Flow initialized with scopes: {SCOPES}")
    return flow

def exchange_code_for_token(code: str):
    """Exchanges the authorization code for tokens."""
    flow = get_flow()
    flow.fetch_token(code=code)
    creds = flow.credentials
    save_credentials(creds)
    return {
        "token": creds.token,
        "refresh_token": creds.refresh_token,
        "expiry": creds.expiry.isoformat() if creds.expiry else None
    }

def save_credentials(creds):
    """Saves credentials to a file."""
    with open(TOKEN_FILE, "w") as token:
        token.write(creds.to_json())

def get_credentials():
    """Loads valid credentials, refreshing if necessary."""
    creds = None
    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
        
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
        save_credentials(creds)
        
    return creds

def revoke_credentials():
    """Removes the token file to revoke access."""
    if os.path.exists(TOKEN_FILE):
        os.remove(TOKEN_FILE)
        return True
    return False

def is_connected():
    """Checks if valid credentials exist."""
    return os.path.exists(TOKEN_FILE)

def get_user_info():
    """Fetches the user's Google profile info."""
    creds = get_credentials()
    if not creds:
        return None
    
    try:
        from googleapiclient.discovery import build
        service = build('oauth2', 'v2', credentials=creds)
        user_info = service.userinfo().get().execute()
        return user_info
    except Exception as e:
        print(f"Error fetching user info: {e}")
        return None
