from googleapiclient.discovery import build
import auth_service
import base64
import logging
from typing import List, Dict, Optional

def fetch_recent_unread_emails(limit: int = 10) -> List[Dict[str, str]]:
    """
    Fetches the most recent unread emails from the user's inbox.
    Returns a list of dictionaries with 'subject', 'sender', and 'snippet'.
    """
    creds = auth_service.get_credentials()
    if not creds:
        logging.error("Gmail Service: Not authenticated.")
        return None

    try:
        service = build('gmail', 'v1', credentials=creds)

        # List unread messages
        logging.info("Gmail Service: Attempting to list messages...")
        results = service.users().messages().list(userId='me', q='is:unread', maxResults=limit).execute()
        logging.info("Gmail Service: List messages call successful.")
        messages = results.get('messages', [])

        email_data = []

        if not messages:
            print("No new messages.")
            return []

        for message in messages:
            msg = service.users().messages().get(userId='me', id=message['id'], format='full').execute()
            
            headers = msg['payload']['headers']
            subject = next((header['value'] for header in headers if header['name'] == 'Subject'), '(No Subject)')
            sender = next((header['value'] for header in headers if header['name'] == 'From'), '(Unknown Sender)')
            snippet = msg.get('snippet', '')

            email_data.append({
                'subject': subject,
                'sender': sender,
                'snippet': snippet
            })

        return email_data

    except Exception as e:
        import traceback
        logging.error(f"Gmail Service Error: {str(e)}")
        logging.error(traceback.format_exc())
        return None

def search_emails(query: str, limit: int = 5) -> List[Dict[str, str]]:
    """
    Searches for emails matching the query.
    """
    creds = auth_service.get_credentials()
    if not creds:
        logging.error("Gmail Search: Not authenticated.")
        return None

    try:
        service = build('gmail', 'v1', credentials=creds)
        logging.info(f"Gmail Search: Searching for '{query}'...")
        results = service.users().messages().list(userId='me', q=query, maxResults=limit).execute()
        messages = results.get('messages', [])

        email_data = []
        for message in messages:
            msg = service.users().messages().get(userId='me', id=message['id'], format='minimal').execute()
            
            # Get snippet and ID
            email_data.append({
                'id': message['id'],
                'snippet': msg.get('snippet', ''),
                'threadId': msg.get('threadId', '')
            })
            
            # For search results, we might want subjects too, but let's keep it light
            # and fetch full details only when "reading" a specific one.
            # However, for the agent to choose, subject is better.
            full_msg = service.users().messages().get(userId='me', id=message['id'], format='metadata', metadataHeaders=['Subject', 'From', 'Date']).execute()
            headers = full_msg['payload']['headers']
            subject = next((header['value'] for header in headers if header['name'] == 'Subject'), '(No Subject)')
            sender = next((header['value'] for header in headers if header['name'] == 'From'), '(Unknown Sender)')
            date = next((header['value'] for header in headers if header['name'] == 'Date'), '')
            
            email_data[-1].update({
                'subject': subject,
                'sender': sender,
                'date': date
            })

        return email_data

    except Exception as e:
        logging.error(f"Gmail Search Error: {str(e)}")
        return None

def get_email_content(message_id: str) -> Dict[str, str]:
    """
    Fetches the full content of a specific email.
    """
    creds = auth_service.get_credentials()
    if not creds:
        return None

    try:
        service = build('gmail', 'v1', credentials=creds)
        msg = service.users().messages().get(userId='me', id=message_id, format='full').execute()
        
        headers = msg['payload']['headers']
        subject = next((header['value'] for header in headers if header['name'] == 'Subject'), '(No Subject)')
        sender = next((header['value'] for header in headers if header['name'] == 'From'), '(Unknown Sender)')
        
        # Parse body
        parts = [msg['payload']]
        body = ""
        
        while parts:
            part = parts.pop(0)
            if 'parts' in part:
                parts.extend(part['parts'])
            if part.get('mimeType') == 'text/plain':
                data = part['body'].get('data')
                if data:
                    body += base64.urlsafe_b64decode(data).decode('utf-8')
            elif part.get('mimeType') == 'text/html' and not body:
                # Fallback to HTML if plain text not found yet, but we prefer plain
                data = part['body'].get('data')
                if data:
                    # Simple HTML clean might be needed, but for now just decode
                    html_body = base64.urlsafe_b64decode(data).decode('utf-8')
                    # Very crude HTML to text if needed, but let's just return it for now
                    # body = html_body 
        
        if not body:
            body = msg.get('snippet', '')

        return {
            'subject': subject,
            'sender': sender,
            'body': body,
            'snippet': msg.get('snippet', '')
        }

    except Exception as e:
        logging.error(f"Gmail Content Error: {str(e)}")
        return None
